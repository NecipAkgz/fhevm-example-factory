// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Demonstrates conditional logic: max(a, b) using encrypted comparison
 *
 * @dev Shows how to use FHE.select() for encrypted if-then-else logic.
 */
contract FHEIfThenElse is ZamaEthereumConfig {
    euint8 private _a;
    euint8 private _b;
    euint8 private _max;

    constructor() {}

    /// @notice Sets the first operand (encrypted)
    function setA(externalEuint8 inputA, bytes calldata inputProof) external {
        _a = FHE.fromExternal(inputA, inputProof);
        FHE.allowThis(_a);
    }

    /// @notice Sets the second operand (encrypted)
    function setB(externalEuint8 inputB, bytes calldata inputProof) external {
        _b = FHE.fromExternal(inputB, inputProof);
        FHE.allowThis(_b);
    }

    /// @notice Compute max(a, b) without revealing which is larger
    /// @dev Uses FHE.select() - the encrypted "if-then-else"
    function computeMax() external {
        // 🔍 Compare encrypted values - result is encrypted boolean!
        // We don't know if a >= b, only the encrypted result
        ebool aIsGreaterOrEqual = FHE.ge(_a, _b);

        // 🔀 FHE.select(condition, ifTrue, ifFalse)
        // - BOTH branches are evaluated (no short-circuit)
        // - Result is encrypted - no one knows which was selected
        // - This is how you do "if-else" on encrypted values!
        _max = FHE.select(aIsGreaterOrEqual, _a, _b);

        // Grant permissions for decryption
        FHE.allowThis(_max);
        FHE.allow(_max, msg.sender);
    }

    /// @notice Returns the encrypted result
    function result() public view returns (euint8) {
        return _max;
    }
}
