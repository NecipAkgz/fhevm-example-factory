// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Critical access control patterns in FHEVM: FHE.allow, FHE.allowThis, FHE.allowTransient. Includes common mistakes and correct implementations.
 *
 * @dev Key functions:
 *      FHE.allow(handle, address) - permanent permission
 *      FHE.allowThis(handle)      - permission for contract itself
 *      FHE.allowTransient(handle, address) - temporary, expires at tx end
 */
contract FHEAccessControl is ZamaEthereumConfig {
    euint32 private _secretValue;
    mapping(address => bool) public hasAccess;

    constructor() {}

    // ==================== CORRECT PATTERN ====================

    /// @notice ✅ CORRECT: Full access pattern for user decryption
    function storeWithFullAccess(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ⚠️ CRITICAL: BOTH are required for user decryption!
        FHE.allowThis(_secretValue); // Contract can operate on it
        FHE.allow(_secretValue, msg.sender); // User can decrypt it

        // ❓ Why allowThis is needed for user decryption?
        // User decryption = re-encryption for user's key
        // This requires contract's permission to "release" the value

        hasAccess[msg.sender] = true;
    }

    /// @notice Grant access to additional users
    function grantAccess(address user) external {
        require(hasAccess[msg.sender], "Caller has no access to grant");

        // ✅ Works because contract has allowThis permission
        FHE.allow(_secretValue, user);
        hasAccess[user] = true;
    }

    function getSecretValue() external view returns (euint32) {
        return _secretValue;
    }

    // ==================== WRONG PATTERNS (EDUCATIONAL) ====================

    /// @notice ❌ WRONG: Missing allowThis → user decryption FAILS
    function storeWithoutAllowThis(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Missing: FHE.allowThis(_secretValue)
        // User has permission, but decryption will FAIL!
        FHE.allow(_secretValue, msg.sender);
    }

    /// @notice ❌ WRONG: Missing allow(user) → no one can decrypt
    function storeWithoutUserAllow(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        FHE.allowThis(_secretValue);
        // ❌ Missing: FHE.allow(_secretValue, msg.sender)
        // Contract can operate, but no one can decrypt!
    }

    // ==================== TRANSIENT ACCESS ====================

    /// @notice Temporary access - expires at end of transaction
    /// @dev Use for: passing values between contracts in same tx
    function computeAndShareTransient(
        address recipient
    ) external returns (euint32) {
        euint32 computed = FHE.add(_secretValue, FHE.asEuint32(1));

        // 💨 Transient = cheaper than permanent, auto-expires
        FHE.allowTransient(computed, recipient);

        return computed;
    }
}
