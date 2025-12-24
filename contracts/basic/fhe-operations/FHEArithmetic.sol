// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice FHE arithmetic (add, sub, mul, div, rem, min, max) on encrypted values.
 *         Includes gas cost comparisons and key limitations, such as plaintext
 *         divisors for division and remainder operations.
 *
 * @dev div/rem only work with plaintext divisors (not encrypted).
 */
contract FHEArithmetic is ZamaEthereumConfig {
    euint32 private _a;
    euint32 private _b;
    euint32 private _result;

    function setA(externalEuint32 inputA, bytes calldata inputProof) external {
        _a = FHE.fromExternal(inputA, inputProof);
        FHE.allowThis(_a);
    }

    function setB(externalEuint32 inputB, bytes calldata inputProof) external {
        _b = FHE.fromExternal(inputB, inputProof);
        FHE.allowThis(_b);
    }

    /// @notice Encrypted addition: result = a + b
    function computeAdd() external {
        _result = FHE.add(_a, _b);
        _grantPermissions();
    }

    /// @notice Encrypted subtraction: result = a - b
    /// @dev ⚠️ No underflow protection! Wraps around at 0.
    function computeSub() external {
        _result = FHE.sub(_a, _b);
        _grantPermissions();
    }

    /// @notice Encrypted multiplication: result = a * b
    /// @dev ⚠️ No overflow protection! May wrap at type max.
    function computeMul() external {
        _result = FHE.mul(_a, _b);
        _grantPermissions();
    }

    /// @notice Encrypted division: result = a / divisor
    /// @dev ❌ WRONG: FHE.div(encryptedA, encryptedB) - not supported!
    ///      ✅ CORRECT: FHE.div(encryptedA, plaintextB)
    function computeDiv(uint32 divisor) external {
        _result = FHE.div(_a, divisor);
        _grantPermissions();
    }

    /// @notice Encrypted remainder: result = a % modulus
    /// @dev Modulus must be plaintext (same limitation as div)
    function computeRem(uint32 modulus) external {
        _result = FHE.rem(_a, modulus);
        _grantPermissions();
    }

    /// @notice Encrypted minimum: result = min(a, b)
    function computeMin() external {
        _result = FHE.min(_a, _b);
        _grantPermissions();
    }

    /// @notice Encrypted maximum: result = max(a, b)
    function computeMax() external {
        _result = FHE.max(_a, _b);
        _grantPermissions();
    }

    function getResult() public view returns (euint32) {
        return _result;
    }

    function _grantPermissions() internal {
        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }
}
