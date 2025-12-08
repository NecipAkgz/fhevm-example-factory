Common FHE mistakes and their correct alternatives. Covers: branching, permissions, require/revert, re-encryption, loops, noise, and deprecated APIs.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="FHEAntiPatterns.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint32,
    ebool,
    externalEuint32
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * ❌ Common FHE mistakes and ✅ their correct alternatives
 *
 * @dev ANTI-PATTERNS COVERED:
 *      1. Branching on encrypted values (causes decryption!)
 *      2. Returning encrypted values without permissions
 *      3. Using require/revert with encrypted conditions
 *      4. Encrypted computation without permission grants
 *      5. Leaking information through gas/timing
 *      6. Unauthenticated re-encryption (security critical!)
 *      7. Encrypted loop iterations (gas/timing leak)
 *      8. Too many chained operations (noise accumulation)
 *      9. Using deprecated FHEVM APIs
 */
contract FHEAntiPatterns is ZamaEthereumConfig {
    euint32 private _secretBalance;
    euint32 private _threshold;

    // solhint-disable-next-line no-empty-blocks
    constructor() {}

    function initialize(
        externalEuint32 balance,
        externalEuint32 threshold,
        bytes calldata inputProof
    ) external {
        _secretBalance = FHE.fromExternal(balance, inputProof);
        _threshold = FHE.fromExternal(threshold, inputProof);

        FHE.allowThis(_secretBalance);
        FHE.allowThis(_threshold);
        FHE.allow(_secretBalance, msg.sender);
        FHE.allow(_threshold, msg.sender);
    }

    // ========================================================================
    // ANTI-PATTERN 1: Branching on encrypted values
    // ========================================================================

    /**
     * ❌ WRONG: if/else on encrypted value causes decryption
     * @dev This pattern LEAKS information by decrypting on-chain
     *
     * DO NOT USE THIS PATTERN - It defeats the purpose of encryption!
     */
    // function wrongBranching() external {
    //     // ❌ This would compile but LEAK the comparison result!
    //     // if (_secretBalance > _threshold) {  // WRONG: decrypts!
    //     //     // do something
    //     // }
    // }

    /**
     * ✅ CORRECT: Use FHE.select for conditional logic
     * @dev All computation stays encrypted
     */
    function correctConditional() external {
        // Compare encrypted values - result is encrypted boolean
        ebool isAboveThreshold = FHE.gt(_secretBalance, _threshold);

        // Use select for encrypted branching
        // If above threshold: result = balance - 10
        // Else: result = balance
        euint32 penaltyAmount = FHE.asEuint32(10);
        euint32 balanceMinusPenalty = FHE.sub(_secretBalance, penaltyAmount);

        // ✅ Encrypted conditional - no information leaked
        _secretBalance = FHE.select(
            isAboveThreshold,
            balanceMinusPenalty,
            _secretBalance
        );

        FHE.allowThis(_secretBalance);
        FHE.allow(_secretBalance, msg.sender);
    }

    // ========================================================================
    // ANTI-PATTERN 2: View function returning encrypted without permissions
    // ========================================================================

    /**
     * ❌ WRONG: Returns encrypted value but caller can't decrypt
     * @dev Without prior allow(), the returned handle is useless
     */
    function wrongGetBalance() external view returns (euint32) {
        // ❌ Caller has no permission to decrypt this!
        return _secretBalance;
    }

    /**
     * ✅ CORRECT: Ensure permissions were granted before returning
     * @dev Caller must have been granted access in a previous transaction
     */
    function correctGetBalance() external view returns (euint32) {
        // ✅ Caller should have been granted access via allow()
        // The initialize() function grants access to msg.sender
        return _secretBalance;
    }

    // ========================================================================
    // ANTI-PATTERN 3: Using require/revert with encrypted conditions
    // ========================================================================

    /**
     * ❌ WRONG: Cannot use require with encrypted values
     * @dev This pattern doesn't even compile - encrypted bools can't be used in require
     */
    // function wrongRequire() external {
    //     ebool hasEnough = FHE.gte(_secretBalance, FHE.asEuint32(100));
    //     // ❌ COMPILE ERROR: require expects bool, not ebool
    //     // require(hasEnough, "Insufficient balance");
    // }

    /**
     * ✅ CORRECT: Use encrypted flags instead of require
     * @dev Store result and let client check after decryption
     */
    function correctValidation() external returns (ebool) {
        // ✅ Return encrypted boolean for client to check
        ebool hasEnough = FHE.gte(_secretBalance, FHE.asEuint32(100));

        FHE.allowThis(hasEnough);
        FHE.allow(hasEnough, msg.sender);

        return hasEnough;
    }

    // ========================================================================
    // ANTI-PATTERN 4: Encrypted computation without permission grants
    // ========================================================================

    /**
     * ❌ WRONG: Compute but forget to grant permissions
     * @dev Result exists but no one can ever decrypt it
     */
    function wrongCompute() external {
        euint32 doubled = FHE.mul(_secretBalance, FHE.asEuint32(2));
        _secretBalance = doubled;
        // ❌ Missing FHE.allowThis and FHE.allow!
        // This value is now locked forever
    }

    // ✅ CORRECT: Always grant permissions after computation
    function correctCompute() external {
        euint32 doubled = FHE.mul(_secretBalance, FHE.asEuint32(2));
        _secretBalance = doubled;

        // ✅ Grant permissions
        FHE.allowThis(_secretBalance);
        FHE.allow(_secretBalance, msg.sender);
    }

    // ========================================================================
    // ANTI-PATTERN 5: Leaking information through gas/timing
    // ========================================================================

    /**
     * ⚠️ CAUTION: Be aware of side-channel attacks
     * @dev Even with FHE.select, be careful about operations that might
     *      have different gas costs based on values
     *
     * BEST PRACTICES:
     * - Use constant-time operations when possible
     * - Avoid loops with encrypted iteration counts
     * - Don't make external calls conditionally based on encrypted values
     */
    function cautionSideChannels() external pure returns (string memory) {
        return "Be aware of gas/timing side channels";
    }

    // ========================================================================
    // ANTI-PATTERN 6: Unauthenticated Re-encryption (SECURITY CRITICAL)
    // ========================================================================

    /**
     * ❌ WRONG: Re-encrypt for any provided public key
     * @dev This allows impersonation attacks - anyone can request re-encryption
     *      for any public key and pretend to be that user
     *
     * ATTACK SCENARIO:
     * 1. Alice has encrypted balance
     * 2. Eve calls wrongReencrypt(evePublicKey)
     * 3. Eve gets Alice's balance re-encrypted for her key
     * 4. Eve decrypts and learns Alice's secret balance!
     */
    // function wrongReencrypt(bytes calldata userPublicKey) external view {
    //     // ❌ NO AUTHENTICATION! Anyone can provide any public key
    //     // Re-encrypt _secretBalance for userPublicKey
    //     // This leaks information to unauthorized users
    // }

    /**
     * ✅ CORRECT: Require cryptographic proof of identity
     * @dev Use EIP-712 signature to prove the requester owns the public key
     *
     * CLIENT-SIDE:
     * 1. User signs a message: "I authorize re-encryption for contract X"
     * 2. Signature is verified on-chain before re-encryption
     *
     * Note: In practice, this is handled by the FHEVM SDK's userDecrypt flow
     */
    function correctReencryptPattern() external pure returns (string memory) {
        return
            "Always verify EIP-712 signature before re-encryption. "
            "Use fhevm.js userDecrypt which handles this automatically.";
    }

    // ========================================================================
    // ANTI-PATTERN 7: Encrypted Loop Iterations (GAS/TIMING LEAK)
    // ========================================================================

    /// ❌ WRONG: Using encrypted value as loop count
    /// @dev Loop count is visible through gas consumption and timing
    ///
    /// PROBLEM: If we loop `encryptedCount` times, the gas cost reveals the count!
    // function wrongEncryptedLoop(euint32 encryptedCount) external {
    //     // ❌ GAS LEAK: Number of iterations visible!
    //     // for (uint i = 0; i < decrypt(encryptedCount); i++) {
    //     //     // Each iteration costs gas
    //     // }
    // }

    /// ✅ CORRECT: Use fixed iteration count with select
    /// @dev Always iterate the maximum possible times, use FHE.select to
    ///      conditionally apply operations
    function correctFixedIterations() external {
        // ✅ Fixed iteration count - no information leaked
        uint256 MAX_ITERATIONS = 10;

        euint32 accumulator = FHE.asEuint32(0);
        euint32 counter = FHE.asEuint32(0);

        for (uint256 i = 0; i < MAX_ITERATIONS; i++) {
            // Check if we should still be iterating
            ebool shouldContinue = FHE.lt(counter, _secretBalance);

            // Conditionally add (add 1 if continuing, add 0 otherwise)
            euint32 increment = FHE.select(
                shouldContinue,
                FHE.asEuint32(1),
                FHE.asEuint32(0)
            );
            accumulator = FHE.add(accumulator, increment);
            counter = FHE.add(counter, FHE.asEuint32(1));
        }

        FHE.allowThis(accumulator);
        FHE.allow(accumulator, msg.sender);
    }

    // ========================================================================
    // ANTI-PATTERN 8: Too Many Chained Operations (Noise Accumulation)
    // ========================================================================

    /// ⚠️ CAUTION: FHE operations accumulate "noise"
    /// @dev Each FHE operation adds noise to the ciphertext. After too many
    ///      operations, the ciphertext becomes corrupted and undecryptable.
    ///
    /// FHEVM handles this via "bootstrapping" which is expensive.
    /// Best practice: minimize operation chains where possible.
    ///
    /// EXAMPLE OF NOISE ACCUMULATION:
    /// - Each add/sub: +1 noise
    /// - Each mul: +10 noise (roughly)
    /// - Bootstrapping threshold: ~100 noise (varies by scheme)
    function cautionNoiseAccumulation() external pure returns (string memory) {
        return
            "Keep FHE operation chains short. Multiplications add more noise than additions. "
            "If you need many operations, consider batching or restructuring logic.";
    }

    // ========================================================================
    // ANTI-PATTERN 9: Using Deprecated FHEVM APIs
    // ========================================================================

     *
     * OLD (v0.8 and earlier):
     * - Decryption went through Zama Oracle
     * - Used TFHE.decrypt() directly
     *
     * NEW (v0.9+):
     * - Self-relaying public decryption
     * - Use FHE.makePubliclyDecryptable() + off-chain relay
     */
    function cautionDeprecatedAPIs() external pure returns (string memory) {
        return
            "Use FHEVM v0.9+ APIs. Old TFHE.decrypt() is deprecated. "
            "Use FHE.makePubliclyDecryptable() for public decryption, "
            "or userDecrypt pattern via fhevm.js for user decryption.";
    }

    // ========================================================================
    // SUMMARY: Key Rules (Always check before deploying!)
    // ========================================================================

    /**
     * @notice Quick reference for FHE best practices
     * @return rules Summary of all 9 key rules
     */
    function getRules() external pure returns (string memory rules) {
        return
            "1. Never branch (if/else) on encrypted values - use FHE.select\n"
            "2. Always call FHE.allowThis() AND FHE.allow(user) after computation\n"
            "3. Cannot use require/revert with encrypted conditions\n"
            "4. Return ebool for validations, let client decrypt and check\n"
            "5. Be aware of gas/timing side channels\n"
            "6. Always authenticate re-encryption requests (use EIP-712 signatures)\n"
            "7. Never use encrypted values as loop iteration counts\n"
            "8. Avoid chaining too many FHE operations (noise accumulation)\n"
            "9. Use FHEVM v0.9+ APIs, avoid deprecated TFHE.decrypt()";
    }
}

```

{% endtab %}

{% tab title="FHEAntiPatterns.ts" %}

```typescript
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEAntiPatterns, FHEAntiPatterns__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEAntiPatterns")) as FHEAntiPatterns__factory;
  const contract = (await factory.deploy()) as FHEAntiPatterns;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Tests for FHE anti-patterns
 * Demonstrates correct patterns for common FHE mistakes
 */
describe("FHEAntiPatterns", function () {
  let contract: FHEAntiPatterns;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.contractAddress;
    contract = deployment.contract;
  });

  describe("Initialization", function () {
    it("should initialize with encrypted balance and threshold", async function () {
      const fhevm = hre.fhevm;
      const balance = 100;
      const threshold = 50;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(balance)
        .add32(threshold)
        .encrypt();

      await contract
        .connect(signers.alice)
        .initialize(input.handles[0], input.handles[1], input.inputProof);

      // Contract should now have encrypted values
      // We can't directly verify values without decryption, but tx should succeed
    });
  });

  describe("Correct Conditional Pattern", function () {
    it("should handle conditional logic with FHE.select", async function () {
      const fhevm = hre.fhevm;

      // Initialize with balance=100, threshold=50
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(100) // balance
        .add32(50)  // threshold
        .encrypt();

      await contract
        .connect(signers.alice)
        .initialize(input.handles[0], input.handles[1], input.inputProof);

      // Execute correct conditional - should not revert
      await expect(
        contract.connect(signers.alice).correctConditional()
      ).to.not.be.reverted;
    });
  });

  describe("Correct Computation Pattern", function () {
    it("should compute with proper permission grants", async function () {
      const fhevm = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(50)  // balance
        .add32(25)  // threshold
        .encrypt();

      await contract
        .connect(signers.alice)
        .initialize(input.handles[0], input.handles[1], input.inputProof);

      // correctCompute grants proper permissions
      await expect(
        contract.connect(signers.alice).correctCompute()
      ).to.not.be.reverted;
    });
  });

  describe("Rules Reference", function () {
    it("should return the key rules summary", async function () {
      const rules = await contract.getRules();
      expect(rules).to.include("FHE.select");
      expect(rules).to.include("FHE.allowThis");
      expect(rules).to.include("require/revert");
    });
  });
});

```

{% endtab %}

{% endtabs %}
