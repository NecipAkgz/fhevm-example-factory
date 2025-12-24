// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    externalEbool,
    externalEuint32,
    externalEaddress,
    ebool,
    euint32,
    eaddress
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Efficient handling of multiple encrypted values via batched inputs.
 *         Uses a single proof for multiple values (ebool, euint32, eaddress),
 *         saving significant gas compared to separate proofs.
 *
 * @dev Batching saves ~50k gas per additional value.
 */
contract EncryptMultipleValues is ZamaEthereumConfig {
    ebool private _encryptedEbool;
    euint32 private _encryptedEuint32;
    eaddress private _encryptedEaddress;

    /// @notice Store multiple encrypted values from single batched input
    /// @dev Client creates ONE proof for ALL values using createEncryptedInput().
    ///      Much cheaper than separate encrypt() calls!
    function initialize(
        externalEbool inputEbool,
        externalEuint32 inputEuint32,
        externalEaddress inputEaddress,
        bytes calldata inputProof // Single proof covers all!
    ) external {
        // 💡 Why one proof? Client batches all values before encrypt()
        // Saves ~50k gas per additional value!
        _encryptedEbool = FHE.fromExternal(inputEbool, inputProof);
        _encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);
        _encryptedEaddress = FHE.fromExternal(inputEaddress, inputProof);

        // 🔐 Each value needs own permissions (no batching here)
        FHE.allowThis(_encryptedEbool);
        FHE.allow(_encryptedEbool, msg.sender);

        FHE.allowThis(_encryptedEuint32);
        FHE.allow(_encryptedEuint32, msg.sender);

        FHE.allowThis(_encryptedEaddress);
        FHE.allow(_encryptedEaddress, msg.sender);
    }

    function encryptedBool() public view returns (ebool) {
        return _encryptedEbool;
    }

    function encryptedUint32() public view returns (euint32) {
        return _encryptedEuint32;
    }

    function encryptedAddress() public view returns (eaddress) {
        return _encryptedEaddress;
    }
}
