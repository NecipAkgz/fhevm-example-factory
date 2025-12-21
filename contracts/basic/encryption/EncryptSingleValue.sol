// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, externalEuint32, euint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Single value encryption with proof validation.
 *         Shows how to receive encrypted data from users, validate proofs,
 *         and grant proper permissions. Includes examples of common mistakes
 *         and the correct permission pattern (allowThis + allow).

 * @dev Shows the complete flow: receiving encrypted input from user, validating proof,
 *      storing the encrypted value, and granting permissions for decryption.
 */
contract EncryptSingleValue is ZamaEthereumConfig {
    euint32 private _encryptedEuint32;

    /// @notice Store an encrypted value submitted by the user
    /// @dev inputProof ensures: value encrypted for THIS contract + THIS user.
    ///      Prevents replay attacks from other contracts/users.
    function initialize(
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) external {
        // 🔐 Why proof?
        // Prevents: replay attacks, wrong contract, invalid ciphertext
        _encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);

        // 🔑 Why both?
        // - allowThis: Contract can store/compute with it
        // - allow(user): User can decrypt it
        FHE.allowThis(_encryptedEuint32);
        FHE.allow(_encryptedEuint32, msg.sender);
    }

    /// @notice Returns the encrypted handle (not the actual value!)
    /// @dev To decrypt, use fhevm.userDecryptEuint32() on client side
    function encryptedUint32() public view returns (euint32) {
        return _encryptedEuint32;
    }
}
