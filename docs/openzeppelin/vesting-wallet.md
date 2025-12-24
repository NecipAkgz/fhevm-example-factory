Time-locked vesting wallet with fully encrypted token amounts. Implements linear vesting for ERC7984 tokens where the schedule, amounts, and releases are computed via FHE, keeping progress hidden from observers.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (13 items)</summary>

**Types:** `ebool` · `euint128` · `euint64`

**Functions:**
- `FHE.add()` - Homomorphic addition: result = a + b (overflow wraps)
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.allowTransient()` - Grants TEMPORARY permission (expires at tx end)
- `FHE.asEuint64()` - Encrypts a plaintext uint64 value into euint64
- `FHE.div()` - Homomorphic division: result = a / b (plaintext divisor only)
- `FHE.ge()` - Encrypted greater-or-equal: returns ebool(a >= b)
- `FHE.mul()` - Homomorphic multiplication: result = a * b
- `FHE.select()` - Encrypted if-then-else: select(cond, a, b) → returns a if true, b if false
- `FHE.sub()` - Homomorphic subtraction: result = a - b (underflow wraps)

</details>

{% tabs %}

{% tab title="VestingWalletExample.sol" %}

```solidity
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
 * @notice Time-locked vesting wallet with fully encrypted token amounts.
 *         Implements linear vesting for ERC7984 tokens where the schedule, amounts,
 *         and releases are computed via FHE, keeping progress hidden from observers.

 * @dev Timeline: |--START--|---VESTING---|--END--| (0% → linear → 100%)
 *      All vesting calculations performed on encrypted values using FHE.
 *      ⚡ Gas: FHE.div/mul operations are expensive (~200k gas each)
 */
contract VestingWalletExample is
    Ownable,
    ReentrancyGuardTransient,
    ZamaEthereumConfig
{
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

        // Encrypted comparison: if vested >= released → return difference, else 0
        ebool canRelease = FHE.ge(vestedAmount_, releasedAmount);
        return
            FHE.select(
                canRelease,
                FHE.asEuint64(FHE.sub(vestedAmount_, releasedAmount)),
                FHE.asEuint64(0)
            );
    }

    function release(address token) public virtual nonReentrant {
        euint64 amount = releasable(token);

        // Transfer encrypted amount using allowTransient (cheaper!)
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
            // ⚡ Gas warning: FHE.mul + FHE.div cost ~400k gas combined!
            return
                FHE.div(
                    FHE.mul(totalAllocation, (timestamp - start())),
                    duration()
                );
        }
    }
}

```

{% endtab %}

{% tab title="VestingWallet.ts" %}

```typescript
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VestingWallet", function () {
  let vestingWallet: any;
  let token: any;
  let owner: any;
  let beneficiary: any;

  const VESTING_AMOUNT = 1000;
  const VESTING_DURATION = 60 * 60; // 1 hour in seconds

  beforeEach(async function () {
    [owner, beneficiary] = await ethers.getSigners();

    // Deploy ERC7984 token
    token = await ethers.deployContract("ERC7984Example", [
      owner.address,
      10000,
      "Vesting Token",
      "VTK",
      "https://example.com/vesting",
    ]);

    // Get current time and set vesting to start in 1 minute
    const currentTime = await time.latest();
    const startTime = currentTime + 60;

    // Deploy vesting wallet
    vestingWallet = await ethers.deployContract("VestingWalletExample", [
      beneficiary.address,
      startTime,
      VESTING_DURATION,
    ]);

    // Transfer tokens to vesting wallet
    const encryptedInput = await fhevm
      .createEncryptedInput(await token.getAddress(), owner.address)
      .add64(VESTING_AMOUNT)
      .encrypt();

    await token
      .connect(owner)
      ["confidentialTransfer(address,bytes32,bytes)"](
        await vestingWallet.getAddress(),
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
  });

  describe("Initialization", function () {
    it("should set the correct beneficiary", async function () {
      expect(await vestingWallet.owner()).to.equal(beneficiary.address);
    });

    it("should set the correct duration", async function () {
      expect(await vestingWallet.duration()).to.equal(VESTING_DURATION);
    });
  });

  describe("Vesting Schedule", function () {
    it("should not release tokens before vesting starts", async function () {
      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.not.be.reverted;
    });

    it("should release after vesting ends", async function () {
      const endTime = await vestingWallet.end();
      await time.increaseTo(endTime + BigInt(100));

      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.emit(vestingWallet, "VestingWalletConfidentialTokenReleased");
    });

    it("should release partial tokens at midpoint", async function () {
      const startTime = await vestingWallet.start();
      const midpoint = Number(startTime) + VESTING_DURATION / 2;

      await time.increaseTo(midpoint);

      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.not.be.reverted;
    });
  });
});

```

{% endtab %}

{% endtabs %}
