// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    ReentrancyGuardTransient
} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {
    IERC7984
} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/**
 * @notice Linear vesting wallet for ERC7984 tokens - amounts stay encrypted!
 *
 * @dev Timeline: |--START--|---VESTING---|--END--|
 *                 0%        linear        100%
 *
 * All vesting calculations are performed on encrypted values using FHE operations.
 */
contract VestingWalletExample is
    Ownable,
    ReentrancyGuardTransient,
    ZamaEthereumConfig
{
    // 🔐 Track released amounts per token (encrypted)
    mapping(address token => euint128) private _tokenReleased;
    uint64 private _start;
    uint64 private _duration;

    /// @notice Emitted when vested tokens are released to beneficiary
    /// @param token The ERC7984 token address
    /// @param amount The encrypted amount released
    event VestingWalletConfidentialTokenReleased(
        address indexed token,
        euint64 amount
    );

    /// @notice Creates a new vesting wallet for a beneficiary
    /// @param beneficiary Address that will receive vested tokens
    /// @param startTimestamp Unix timestamp when vesting begins
    /// @param durationSeconds Duration of the vesting period in seconds
    constructor(
        address beneficiary,
        uint48 startTimestamp,
        uint48 durationSeconds
    ) Ownable(beneficiary) {
        _start = startTimestamp;
        _duration = durationSeconds;
    }

    // ==================== VIEW FUNCTIONS ====================

    function start() public view virtual returns (uint64) {
        return _start;
    }

    function duration() public view virtual returns (uint64) {
        return _duration;
    }

    function end() public view virtual returns (uint64) {
        return start() + duration();
    }

    /// @notice Encrypted amount already released for token
    function released(address token) public view virtual returns (euint128) {
        return _tokenReleased[token];
    }

    // ==================== CORE LOGIC ====================

    /// @notice Calculate how much can be released now
    /// @dev Returns encrypted amount - no one knows the actual value
    function releasable(address token) public virtual returns (euint64) {
        euint128 vestedAmount_ = vestedAmount(token, uint48(block.timestamp));
        euint128 releasedAmount = released(token);

        // 🔀 FHE.select: encrypted if-else
        // If vested >= released: return (vested - released)
        // Else: return 0
        ebool canRelease = FHE.ge(vestedAmount_, releasedAmount);
        return
            FHE.select(
                canRelease,
                FHE.asEuint64(FHE.sub(vestedAmount_, releasedAmount)),
                FHE.asEuint64(0)
            );
    }

    /// @notice Release vested tokens to beneficiary
    function release(address token) public virtual nonReentrant {
        euint64 amount = releasable(token);

        // Transfer encrypted amount to owner
        FHE.allowTransient(amount, token);
        euint64 amountSent = IERC7984(token).confidentialTransfer(
            owner(),
            amount
        );

        // Update released amount (encrypted)
        euint128 newReleasedAmount = FHE.add(released(token), amountSent);
        FHE.allow(newReleasedAmount, owner());
        FHE.allowThis(newReleasedAmount);
        _tokenReleased[token] = newReleasedAmount;

        emit VestingWalletConfidentialTokenReleased(token, amountSent);
    }

    /// @notice Calculate vested amount at timestamp
    function vestedAmount(
        address token,
        uint48 timestamp
    ) public virtual returns (euint128) {
        // Total = released + current balance
        euint128 totalAllocation = FHE.add(
            released(token),
            IERC7984(token).confidentialBalanceOf(address(this))
        );
        return _vestingSchedule(totalAllocation, timestamp);
    }

    // ==================== INTERNAL ====================

    /// @dev Linear vesting: (total * elapsed) / duration
    function _vestingSchedule(
        euint128 totalAllocation,
        uint48 timestamp
    ) internal virtual returns (euint128) {
        if (timestamp < start()) {
            // Before start: 0% vested
            return euint128.wrap(0);
        } else if (timestamp >= end()) {
            // After end: 100% vested
            return totalAllocation;
        } else {
            // During vesting: linear unlock
            return
                FHE.div(
                    FHE.mul(totalAllocation, (timestamp - start())),
                    duration()
                );
        }
    }
}
