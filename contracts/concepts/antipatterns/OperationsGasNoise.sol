// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint32,
    euint256,
    externalEuint32
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Operations, gas, and noise anti-patterns in FHE development.
 *         Demonstrates performance issues, side-channel leaks, and
 *         inefficient encrypted computation patterns.
 *
 * @dev Covers 4 patterns: gas/timing side channels, noise accumulation,
 *      deprecated APIs, and type mismatches.
 */
contract FHEOperationsGasNoiseAntiPatterns is ZamaEthereumConfig {
    euint32 private _secretValue;

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 1: Gas/Timing Side Channel Attacks
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Different code paths have different gas costs
     * @dev Gas consumption reveals which branch was taken
     */
    function wrongGasLeak(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ❌ These operations have different gas costs!
        // If value > 100: expensive operation
        // If value <= 100: cheap operation
        // Gas cost reveals the comparison result!

        // Simulating different paths (commented to avoid actual leak)
        // if (decrypt(value > 100)) {
        //     // Expensive: 10 multiplications
        // } else {
        //     // Cheap: 1 addition
        // }

        _secretValue = value;
        FHE.allowThis(_secretValue);
    }

    /**
     * ✅ CORRECT: Constant-time operations
     * @dev All paths consume same gas
     */
    function correctConstantTime(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ✅ Always perform same operations regardless of value
        euint32 result = FHE.mul(value, FHE.asEuint32(2));

        _secretValue = result;
        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 2: Noise Accumulation (Too Many Operations)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Long chain of FHE operations
     * @dev Each operation adds noise, eventually corrupting ciphertext
     */
    function wrongNoiseAccumulation(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ❌ Too many chained operations!
        // Each mul adds significant noise
        euint32 result = value;
        for (uint i = 0; i < 5; i++) {
            result = FHE.mul(result, FHE.asEuint32(2)); // High noise per operation
        }

        _secretValue = result;
        FHE.allowThis(_secretValue);
    }

    /**
     * ✅ CORRECT: Minimize operation chains
     * @dev Use mathematical optimization to reduce operations
     */
    function correctMinimizeOperations(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ✅ Instead of 5 multiplications by 2, use single multiplication
        // 2^5 = 32
        euint32 result = FHE.mul(value, FHE.asEuint32(32));

        _secretValue = result;
        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 3: Using Deprecated FHEVM APIs
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Using old TFHE.decrypt() pattern
     * @dev Deprecated in FHEVM v0.9+
     */
    function wrongDeprecatedAPI() external pure returns (string memory) {
        // ❌ OLD (v0.8 and earlier):
        // TFHE.decrypt() - went through Zama Oracle
        //
        // This pattern is deprecated and no longer supported

        return "Don't use TFHE.decrypt() - it's deprecated";
    }

    /**
     * ✅ CORRECT: Use modern FHEVM v0.9+ APIs
     * @dev Use FHE.makePubliclyDecryptable() or userDecrypt pattern
     */
    function correctModernAPI() external pure returns (string memory) {
        // ✅ NEW (v0.9+):
        // - FHE.makePubliclyDecryptable() for public decryption
        // - userDecrypt pattern via fhevm.js for user decryption

        return "Use FHE.makePubliclyDecryptable() or fhevm.js userDecrypt()";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 4: Unnecessary Large Data Types
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Using euint256 when euint32 is sufficient
     * @dev Larger types = more gas + more noise
     */
    function wrongOversizedType(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ❌ Unnecessarily converting to euint256!
        // euint256 operations are limited and more expensive
        // This conversion is wasteful when euint32 would suffice
        euint256 largeValue = FHE.asEuint256(value);

        // Converting back to euint32 (double conversion waste!)
        _secretValue = FHE.asEuint32(largeValue);
        FHE.allowThis(_secretValue);
    }

    /**
     * ✅ CORRECT: Use smallest sufficient data type
     * @dev euint32 is cheaper than euint256
     */
    function correctRightSizedType(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ✅ Keep using euint32 if values fit
        euint32 result = FHE.mul(value, FHE.asEuint32(2));

        _secretValue = result;
        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);
    }

    /// @notice Helper to get value for testing
    function getValue() external view returns (euint32) {
        return _secretValue;
    }
}
