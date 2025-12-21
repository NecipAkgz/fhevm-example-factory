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
 * @notice Common FHE mistakes and correct alternatives: branching, permissions, require, loops, noise, deprecated APIs.
 *
 * @dev Covers 9 critical anti-patterns with ❌ WRONG and ✅ CORRECT examples.
 *      This is an educational contract - study each pattern before building production code!
 */
contract FHEAntiPatterns is ZamaEthereumConfig {
    euint32 private _secretBalance;
    euint32 private _threshold;

    /// @notice Initialize the contract with encrypted balance and threshold values
    /// @dev Both values are encrypted and permissions are granted to the caller
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

    // ANTI-PATTERN 1: Branching on encrypted values

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
     * @notice ✅ CORRECT: Use FHE.select for conditional logic
     * @dev All computation stays encrypted - demonstrates proper encrypted branching
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

    // ANTI-PATTERN 2: View function returning encrypted without permissions

    /**
     * @notice ❌ WRONG: Returns encrypted value but caller can't decrypt
     * @dev Without prior allow(), the returned handle is useless
     */
    function wrongGetBalance() external view returns (euint32) {
        // ❌ Caller has no permission to decrypt this!
        return _secretBalance;
    }

    /**
     * @notice ✅ CORRECT: Ensure permissions were granted before returning
     * @dev Caller must have been granted access in a previous transaction
     */
    function correctGetBalance() external view returns (euint32) {
        // ✅ Caller should have been granted access via allow()
        // The initialize() function grants access to msg.sender
        return _secretBalance;
    }

    // ANTI-PATTERN 3: Using require/revert with encrypted conditions

    /**
     * ❌ WRONG: Cannot use require with encrypted values
     * @dev This pattern doesn't even compile - encrypted bools can't be used in require
     */
    // function wrongRequire() external {
    //     ebool hasEnough = FHE.ge(_secretBalance, FHE.asEuint32(100));
    //     // ❌ COMPILE ERROR: require expects bool, not ebool
    //     // require(hasEnough, "Insufficient balance");
    // }

    /**
     * @notice ✅ CORRECT: Use encrypted flags instead of require
     * @dev Store result and let client check after decryption
     */
    function correctValidation() external returns (ebool) {
        // ✅ Return encrypted boolean for client to check
        ebool hasEnough = FHE.ge(_secretBalance, FHE.asEuint32(100));

        FHE.allowThis(hasEnough);
        FHE.allow(hasEnough, msg.sender);

        return hasEnough;
    }

    // ANTI-PATTERN 4: Encrypted computation without permission grants

    /**
     * @notice ❌ WRONG: Compute but forget to grant permissions
     * @dev Result exists but no one can ever decrypt it
     */
    function wrongCompute() external {
        euint32 doubled = FHE.mul(_secretBalance, FHE.asEuint32(2));
        _secretBalance = doubled;
        // ❌ Missing FHE.allowThis and FHE.allow!
        // This value is now locked forever
    }

    /// @notice ✅ CORRECT: Always grant permissions after computation
    function correctCompute() external {
        euint32 doubled = FHE.mul(_secretBalance, FHE.asEuint32(2));
        _secretBalance = doubled;

        // ✅ Grant permissions
        FHE.allowThis(_secretBalance);
        FHE.allow(_secretBalance, msg.sender);
    }

    // ANTI-PATTERN 5: Leaking information through gas/timing

    /**
     * @notice ⚠️ CAUTION: Be aware of side-channel attacks
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

    // ANTI-PATTERN 6: Unauthenticated Re-encryption (SECURITY CRITICAL)

    /**
     * @notice ❌ WRONG: Re-encrypt for any provided public key
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
     * @notice ✅ CORRECT: Require cryptographic proof of identity
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

    // ANTI-PATTERN 7: Encrypted Loop Iterations (GAS/TIMING LEAK)

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

    /// @notice ✅ CORRECT: Use fixed iteration count with select
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

    // ANTI-PATTERN 8: Too Many Chained Operations (Noise Accumulation)

    /// @notice ⚠️ CAUTION: FHE operations accumulate "noise"
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

    // ANTI-PATTERN 9: Using Deprecated FHEVM APIs

    /**
     * @notice Caution about deprecated FHEVM APIs
     * @dev OLD (v0.8 and earlier):
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

    // SUMMARY: Key Rules

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
