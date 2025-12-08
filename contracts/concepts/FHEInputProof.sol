// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint32,
    euint64,
    externalEuint32,
    externalEuint64
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Demonstrates input proof validation - how users securely submit encrypted data
 *
 * @dev Why proofs? They ensure:
 *      1. Ciphertext is valid (not garbage data)
 *      2. Value is in valid range for the type
 *      3. Sender knows the plaintext (proof of knowledge)
 */
contract FHEInputProof is ZamaEthereumConfig {
    euint32 private _singleValue;
    euint32 private _valueA;
    euint64 private _valueB;

    constructor() {}

    // ==================== SINGLE INPUT ====================

    /// @notice Receive single encrypted value with proof
    function setSingleValue(
        externalEuint32 encryptedInput,
        bytes calldata inputProof
    ) external {
        // 📥 FHE.fromExternal validates proof automatically
        // If proof is invalid → transaction reverts
        // Proof ensures:
        //   ✓ Valid euint32 ciphertext
        //   ✓ Encrypted for THIS contract
        //   ✓ Sender knows the plaintext
        _singleValue = FHE.fromExternal(encryptedInput, inputProof);

        FHE.allowThis(_singleValue);
        FHE.allow(_singleValue, msg.sender);
    }

    // ==================== MULTIPLE INPUTS (BATCHED) ====================

    /// @notice Receive multiple encrypted values with SINGLE proof
    /// @dev Client-side batching is more gas-efficient!
    ///
    /// Client code:
    ///   const input = fhevm.createEncryptedInput(contractAddr, userAddr);
    ///   input.add32(valueA);  // → handles[0]
    ///   input.add64(valueB);  // → handles[1]
    ///   const enc = await input.encrypt();
    ///   // enc.inputProof covers BOTH values!
    function setMultipleValues(
        externalEuint32 inputA,
        externalEuint64 inputB,
        bytes calldata inputProof // ← Single proof covers both!
    ) external {
        // Both validated by same proof
        _valueA = FHE.fromExternal(inputA, inputProof);
        _valueB = FHE.fromExternal(inputB, inputProof);

        // ⚠️ Each value needs its own permission grants
        FHE.allowThis(_valueA);
        FHE.allowThis(_valueB);
        FHE.allow(_valueA, msg.sender);
        FHE.allow(_valueB, msg.sender);
    }

    // ==================== COMPUTATION WITH NEW INPUT ====================

    /// @notice Add new encrypted input to existing stored value
    function addToValue(
        externalEuint32 addend,
        bytes calldata inputProof
    ) external {
        // Validate the new input
        euint32 validatedAddend = FHE.fromExternal(addend, inputProof);

        // Combine with stored value
        _singleValue = FHE.add(_singleValue, validatedAddend);

        FHE.allowThis(_singleValue);
        FHE.allow(_singleValue, msg.sender);
    }

    // ==================== GETTERS ====================

    function getSingleValue() external view returns (euint32) {
        return _singleValue;
    }

    function getValueA() external view returns (euint32) {
        return _valueA;
    }

    function getValueB() external view returns (euint64) {
        return _valueB;
    }
}
