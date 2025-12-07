// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title UserDecryptMultipleValues
 * @notice Demonstrates user decryption of multiple encrypted values
 */
contract UserDecryptMultipleValues is ZamaEthereumConfig {
    // 🔐 Multiple encrypted values of different types
    ebool private _encryptedBool;
    euint32 private _encryptedUint32;
    euint64 private _encryptedUint64;

    constructor() {}

    /// @notice Initialize multiple encrypted values from plaintext
    /// @dev Uses FHE.asEuintX() to create encrypted constants from plaintext
    ///      (The plaintext IS visible on-chain, but result is encrypted)
    function initialize(bool a, uint32 b, uint64 c) external {
        // Create encrypted values from plaintext constants
        // FHE.asEbool(a) encrypts a boolean value
        _encryptedBool = FHE.xor(FHE.asEbool(a), FHE.asEbool(false));

        // FHE.asEuint32(b) + 1 creates an encrypted (b + 1)
        _encryptedUint32 = FHE.add(FHE.asEuint32(b), FHE.asEuint32(1));
        _encryptedUint64 = FHE.add(FHE.asEuint64(c), FHE.asEuint64(1));

        // ⚠️ CRITICAL: Grant permissions for EACH value separately
        // You cannot batch permission grants!
        FHE.allowThis(_encryptedBool);
        FHE.allowThis(_encryptedUint32);
        FHE.allowThis(_encryptedUint64);

        FHE.allow(_encryptedBool, msg.sender);
        FHE.allow(_encryptedUint32, msg.sender);
        FHE.allow(_encryptedUint64, msg.sender);
    }

    // Getters return encrypted handles
    // Client decrypts with: fhevm.userDecryptEuint(FhevmType.euint32, handle, ...)

    function encryptedBool() public view returns (ebool) {
        return _encryptedBool;
    }

    function encryptedUint32() public view returns (euint32) {
        return _encryptedUint32;
    }

    function encryptedUint64() public view returns (euint64) {
        return _encryptedUint64;
    }
}
