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
 * @notice Complete guide to encrypted comparisons and conditional selection.
 *         Covers all comparison operators (eq, ne, gt, lt, ge, le) that return
 *         encrypted booleans (ebool), and demonstrates FHE.select for branching
 *         without information leakage. Critical for implementing logic like
 *         "find maximum" or "check threshold" without revealing values.
 *
 * @dev Results are encrypted booleans (ebool) - comparisons reveal nothing!
 *      ⚡ Gas: Comparisons ~100k, select ~120k
 *      ❌ WRONG: if (FHE.gt(a,b)) → decrypts! ✅ CORRECT: FHE.select()
 */
contract FHEComparison is ZamaEthereumConfig {
    euint32 private _a;
    euint32 private _b;
    ebool private _boolResult;
    euint32 private _selectedResult;

    function setA(externalEuint32 inputA, bytes calldata inputProof) external {
        _a = FHE.fromExternal(inputA, inputProof);
        FHE.allowThis(_a);
    }

    function setB(externalEuint32 inputB, bytes calldata inputProof) external {
        _b = FHE.fromExternal(inputB, inputProof);
        FHE.allowThis(_b);
    }

    function computeEq() external {
        _boolResult = FHE.eq(_a, _b);
        _grantBoolPermissions();
    }

    function computeNe() external {
        _boolResult = FHE.ne(_a, _b);
        _grantBoolPermissions();
    }

    function computeGt() external {
        _boolResult = FHE.gt(_a, _b);
        _grantBoolPermissions();
    }

    function computeLt() external {
        _boolResult = FHE.lt(_a, _b);
        _grantBoolPermissions();
    }

    function computeGe() external {
        _boolResult = FHE.ge(_a, _b);
        _grantBoolPermissions();
    }

    function computeLe() external {
        _boolResult = FHE.le(_a, _b);
        _grantBoolPermissions();
    }

    /// @notice Encrypted maximum using select: (a > b) ? a : b
    /// @dev 🔀 Why select? Using if(aGtB) would decrypt and leak the comparison!
    function computeMaxViaSelect() external {
        ebool aGtB = FHE.gt(_a, _b);
        // select evaluates both branches, picks one without revealing which
        _selectedResult = FHE.select(aGtB, _a, _b);
        FHE.allowThis(_selectedResult);
        FHE.allow(_selectedResult, msg.sender);
    }

    /// @notice Encrypted minimum using select: (a < b) ? a : b
    function computeMinViaSelect() external {
        ebool aLtB = FHE.lt(_a, _b);
        _selectedResult = FHE.select(aLtB, _a, _b);
        FHE.allowThis(_selectedResult);
        FHE.allow(_selectedResult, msg.sender);
    }

    function getBoolResult() public view returns (ebool) {
        return _boolResult;
    }

    function getSelectedResult() public view returns (euint32) {
        return _selectedResult;
    }

    function _grantBoolPermissions() internal {
        FHE.allowThis(_boolResult);
        FHE.allow(_boolResult, msg.sender);
    }
}
