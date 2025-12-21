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
 * @notice Input proof validation and batching strategies in FHEVM.
 *         Explains why proofs are essential (prevent garbage data, wrong types,
 *         and replay attacks) and demonstrates the gas-efficient batching pattern
 *         where one proof validates multiple encrypted inputs, saving ~50k gas
 *         per additional value.
 *
 * @dev Proofs ensure: valid ciphertext + correct range + proof of knowledge.
 *      ⚡ Gas: Batching multiple values in ONE proof saves ~50k gas vs separate proofs!
 */
contract FHEInputProof is ZamaEthereumConfig {
    euint32 private _singleValue;
    euint32 private _valueA;
    euint64 private _valueB;

    /// @notice Receive single encrypted value with proof
    function setSingleValue(
        externalEuint32 encryptedInput,
        bytes calldata inputProof
    ) external {
        // 🔐 Why proof needed? Prevents: garbage data, wrong type, replay attacks
        _singleValue = FHE.fromExternal(encryptedInput, inputProof);

        FHE.allowThis(_singleValue);
        FHE.allow(_singleValue, msg.sender);
    }

    /// @notice Receive multiple values with SINGLE proof (gas efficient!)
    /// @dev Client batches: input.add32(a).add64(b).encrypt() → one proof for both!
    function setMultipleValues(
        externalEuint32 inputA,
        externalEuint64 inputB,
        bytes calldata inputProof // Single proof covers both!
    ) external {
        // 💡 Same proof validates both - saves ~50k gas!
        _valueA = FHE.fromExternal(inputA, inputProof);
        _valueB = FHE.fromExternal(inputB, inputProof);

        // Each value needs own permissions
        FHE.allowThis(_valueA);
        FHE.allowThis(_valueB);
        FHE.allow(_valueA, msg.sender);
        FHE.allow(_valueB, msg.sender);
    }

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
