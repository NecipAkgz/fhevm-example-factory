// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, externalEuint32, euint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice FHE encryption mechanism with single values, including common pitfalls and best practices for developers.
 *
 * @dev Shows the complete flow: receiving encrypted input from user, validating proof,
 *      storing the encrypted value, and granting permissions for decryption.
 */
contract EncryptSingleValue is ZamaEthereumConfig {
    // 🔐 Stored encrypted - only authorized users can decrypt
    euint32 private _encryptedEuint32;

    constructor() {}

    /// @notice Store an encrypted value submitted by the user
    /// @dev inputEuint32: Encrypted value (created client-side with fhevm.createEncryptedInput())
    ///      inputProof: Zero-knowledge proof that the encryption is valid
    function initialize(
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) external {
        // Convert external input to internal handle
        // 📋 The proof ensures:
        //    - Value was encrypted for THIS contract address
        //    - Value was encrypted by THIS user (msg.sender)
        //    - Prevents replay attacks from other contracts/users
        _encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);

        // ⚠️ CRITICAL: Grant permissions for future decryption
        // Without BOTH of these, user decryption will fail!
        FHE.allowThis(_encryptedEuint32); // Contract can operate on it
        FHE.allow(_encryptedEuint32, msg.sender); // User can decrypt it
    }

    /// @notice Returns the encrypted handle (not the actual value!)
    /// @dev To decrypt, use fhevm.userDecryptEuint() on the client side
    function encryptedUint32() public view returns (euint32) {
        return _encryptedEuint32;
    }
}
