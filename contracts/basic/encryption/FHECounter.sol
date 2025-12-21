// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Confidential counter implementation using FHEVM, compared with a standard counter to highlight encryption benefits.

 * @dev Demonstrates basic FHE workflow: fromExternal() → compute → allow permissions.
 *      All arithmetic happens on encrypted values without revealing the count.
 */
contract FHECounter is ZamaEthereumConfig {
    euint32 private _count;

    function getCount() external view returns (euint32) {
        return _count;
    }

    /// @notice Increments counter by encrypted amount
    /// @dev Why allowThis + allow? Contract needs permission to store,
    ///      user needs permission to decrypt. Both required!
    function increment(
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) external {
        // 🔐 Why proof? Ensures valid ciphertext encrypted for THIS contract
        euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);

        // 🧮 Homomorphic add: works on encrypted data
        _count = FHE.add(_count, encryptedValue);

        // 🔑 Both needed: allowThis = contract stores, allow = user decrypts
        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);
    }

    /// @notice Decrements counter by encrypted amount
    /// @dev ⚠️ No underflow protection! FHE.sub wraps around at 0.
    ///      ❌ WRONG: Checking result < 0 reveals information
    ///      ✅ CORRECT: Use application-level balance tracking or FHE.select()
    function decrement(
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) external {
        euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);

        _count = FHE.sub(_count, encryptedValue);

        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);
    }
}
