// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    ebool,
    euint32,
    externalEuint32
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Demonstrates all FHE comparison operations on encrypted integers.
 * @dev This contract shows how to compare encrypted values without decrypting them.
 *      Comparison results are returned as encrypted booleans (ebool).
 *
 * Available operations:
 * - FHE.eq(a, b)   : Equal (a == b)
 * - FHE.ne(a, b)   : Not equal (a != b)
 * - FHE.gt(a, b)   : Greater than (a > b)
 * - FHE.lt(a, b)   : Less than (a < b)
 * - FHE.ge(a, b)   : Greater or equal (a >= b)
 * - FHE.le(a, b)   : Less or equal (a <= b)
 * - FHE.select(cond, a, b) : Conditional selection (cond ? a : b)
 */
contract FHEComparison is ZamaEthereumConfig {
    euint32 private _a;
    euint32 private _b;
    ebool private _boolResult;
    euint32 private _selectedResult;

    // solhint-disable-next-line no-empty-blocks
    constructor() {}

    /// Sets the first operand (encrypted)
    function setA(externalEuint32 inputA, bytes calldata inputProof) external {
        _a = FHE.fromExternal(inputA, inputProof);
        FHE.allowThis(_a);
    }

    /// Sets the second operand (encrypted)
    function setB(externalEuint32 inputB, bytes calldata inputProof) external {
        _b = FHE.fromExternal(inputB, inputProof);
        FHE.allowThis(_b);
    }

    /// Computes encrypted equality: result = (a == b)
    function computeEq() external {
        _boolResult = FHE.eq(_a, _b);
        _grantBoolPermissions();
    }

    /// Computes encrypted inequality: result = (a != b)
    function computeNe() external {
        _boolResult = FHE.ne(_a, _b);
        _grantBoolPermissions();
    }

    /// Computes encrypted greater than: result = (a > b)
    function computeGt() external {
        _boolResult = FHE.gt(_a, _b);
        _grantBoolPermissions();
    }

    /// Computes encrypted less than: result = (a < b)
    function computeLt() external {
        _boolResult = FHE.lt(_a, _b);
        _grantBoolPermissions();
    }

    /// Computes encrypted greater or equal: result = (a >= b)
    function computeGe() external {
        _boolResult = FHE.ge(_a, _b);
        _grantBoolPermissions();
    }

    /// Computes encrypted less or equal: result = (a <= b)
    function computeLe() external {
        _boolResult = FHE.le(_a, _b);
        _grantBoolPermissions();
    }

    /// Computes encrypted maximum using select: result = (a > b) ? a : b
    /// @dev Demonstrates FHE.select for conditional logic on encrypted values
    function computeMaxViaSelect() external {
        ebool aGtB = FHE.gt(_a, _b);
        _selectedResult = FHE.select(aGtB, _a, _b);
        FHE.allowThis(_selectedResult);
        FHE.allow(_selectedResult, msg.sender);
    }

    /// Computes encrypted minimum using select: result = (a < b) ? a : b
    function computeMinViaSelect() external {
        ebool aLtB = FHE.lt(_a, _b);
        _selectedResult = FHE.select(aLtB, _a, _b);
        FHE.allowThis(_selectedResult);
        FHE.allow(_selectedResult, msg.sender);
    }

    /// Returns the encrypted boolean result
    function getBoolResult() public view returns (ebool) {
        return _boolResult;
    }

    /// Returns the encrypted selected result
    function getSelectedResult() public view returns (euint32) {
        return _selectedResult;
    }

    /// @dev Grants FHE permissions for boolean result
    function _grantBoolPermissions() internal {
        FHE.allowThis(_boolResult);
        FHE.allow(_boolResult, msg.sender);
    }
}
