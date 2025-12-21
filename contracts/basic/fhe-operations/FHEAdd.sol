// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Introduction to homomorphic addition on encrypted values.
 *         Demonstrates the most fundamental FHE operation: adding two encrypted
 *         numbers without decrypting them. Shows the complete flow from receiving
 *         encrypted inputs, performing the addition, and granting permissions
 *         for both contract storage and user decryption.

 * @dev Shows the most basic FHE operation and permission flow.
 *      ⚡ Gas: FHE.add() costs ~100k gas (coprocessor call)
 */
contract FHEAdd is ZamaEthereumConfig {
    euint8 private _a;
    euint8 private _b;
    euint8 private _result;

    /// @notice Set the first operand (encrypted)
    function setA(externalEuint8 inputA, bytes calldata inputProof) external {
        _a = FHE.fromExternal(inputA, inputProof);
        FHE.allowThis(_a);
    }

    /// @notice Set the second operand (encrypted)
    function setB(externalEuint8 inputB, bytes calldata inputProof) external {
        _b = FHE.fromExternal(inputB, inputProof);
        FHE.allowThis(_b);
    }

    /// @notice Compute a + b on encrypted values
    /// @dev Contract operates on ciphertexts - never sees actual values!
    function computeAPlusB() external {
        // 🧮 Homomorphic: operates on encrypted data without decrypting
        _result = FHE.add(_a, _b);

        // 🔑 Why both? allowThis = contract can use it, allow = user can decrypt
        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    /// @notice Returns the encrypted result handle
    function result() public view returns (euint8) {
        return _result;
    }
}
