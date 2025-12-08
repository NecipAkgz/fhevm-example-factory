// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Simple example: adding two encrypted values (a + b)
 *
 * @dev Demonstrates the most basic FHE operation and permission flow.
 */
contract FHEAdd is ZamaEthereumConfig {
    euint8 private _a;
    euint8 private _b;
    euint8 private _result;

    constructor() {}

    /// @notice Set the first operand (encrypted)
    function setA(externalEuint8 inputA, bytes calldata inputProof) external {
        _a = FHE.fromExternal(inputA, inputProof);
        // Only contract needs permission to use this for computation
        FHE.allowThis(_a);
    }

    /// @notice Set the second operand (encrypted)
    function setB(externalEuint8 inputB, bytes calldata inputProof) external {
        _b = FHE.fromExternal(inputB, inputProof);
        FHE.allowThis(_b);
    }

    /// @notice Compute a + b on encrypted values
    /// @dev The contract computes on ciphertexts - it never sees actual values!
    function computeAPlusB() external {
        // 🔐 Addition on encrypted values
        // Neither the contract nor anyone else knows what a, b, or result are
        _result = FHE.add(_a, _b);

        // 📋 PERMISSION FLOW:
        // During this function, contract has "ephemeral" permission on _result
        // When function ends, ephemeral permission is revoked
        // We need PERMANENT permissions for future access:
        FHE.allowThis(_result); // Contract can use result later
        FHE.allow(_result, msg.sender); // Caller can decrypt result
    }

    /// @notice Returns the encrypted result
    function result() public view returns (euint8) {
        return _result;
    }
}
