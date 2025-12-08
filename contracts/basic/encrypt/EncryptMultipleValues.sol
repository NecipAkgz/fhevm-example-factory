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
 * @notice Demonstrates encrypting multiple values of different types
 *
 * @dev Supported encrypted types:
 *   - euint8/16/32/64/128/256: encrypted integers
 *   - ebool: encrypted boolean
 *   - eaddress: encrypted address
 *   - ebytes64/128/256: encrypted bytes
 */
contract EncryptMultipleValues is ZamaEthereumConfig {
    // 🔐 Three different encrypted types stored together
    ebool private _encryptedEbool; // e.g., vote, permission flag
    euint32 private _encryptedEuint32; // e.g., amount, balance
    eaddress private _encryptedEaddress; // e.g., hidden recipient

    constructor() {}

    /// @notice Store multiple encrypted values from a single batched input
    /// @dev Client-side batching example:
    ///   const input = await fhevm.createEncryptedInput(contractAddr, userAddr)
    ///     .addBool(true).add32(123).addAddress(addr).encrypt();
    ///   // This creates ONE proof for ALL values - more gas efficient!
    function initialize(
        externalEbool inputEbool,
        externalEuint32 inputEuint32,
        externalEaddress inputEaddress,
        bytes calldata inputProof // Single proof covers all values
    ) external {
        // Convert each external input to internal handle
        _encryptedEbool = FHE.fromExternal(inputEbool, inputProof);
        _encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);
        _encryptedEaddress = FHE.fromExternal(inputEaddress, inputProof);

        // ⚠️ IMPORTANT: Each value needs its own permission grants!
        // You cannot batch permission grants

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
