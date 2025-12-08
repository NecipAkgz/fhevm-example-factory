// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Simple encrypted counter - the "Hello World" of FHEVM
 *
 * @dev Demonstrates basic FHE operations: encryption, computation, and permission management.
 *      Shows how to work with encrypted values without ever revealing the underlying data.
 */
contract FHECounter is ZamaEthereumConfig {
    // 🔐 The count is always encrypted - no one can see the actual value
    euint32 private _count;

    /// @notice Returns the encrypted count handle (not the actual value!)
    function getCount() external view returns (euint32) {
        return _count;
    }

    /// @notice Increments the counter by an encrypted value
    function increment(
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) external {
        // Convert external encrypted input to internal handle
        // The proof is verified automatically
        euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);

        // Add encrypted values - computation happens on ciphertexts
        // Neither the contract nor anyone else sees the actual numbers
        _count = FHE.add(_count, encryptedValue);

        // ⚠️ CRITICAL: Both permissions required for user decryption!
        FHE.allowThis(_count); // Contract can continue using this value
        FHE.allow(_count, msg.sender); // Caller can decrypt it
    }

    /// @notice Decrements the counter by an encrypted value
    function decrement(
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) external {
        euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);

        // Subtract encrypted values
        // ⚠️ No underflow protection here - add checks in production!
        _count = FHE.sub(_count, encryptedValue);

        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);
    }
}
