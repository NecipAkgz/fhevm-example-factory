// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Demonstrates all FHE arithmetic operations on encrypted integers.
 * @dev This contract shows how to perform mathematical operations on encrypted values
 *      without ever revealing the underlying data.
 *
 * Available operations:
 * - FHE.add(a, b)  : Addition
 * - FHE.sub(a, b)  : Subtraction
 * - FHE.mul(a, b)  : Multiplication
 * - FHE.div(a, b)  : Division (integer)
 * - FHE.rem(a, b)  : Remainder (modulo)
 * - FHE.min(a, b)  : Minimum of two values
 * - FHE.max(a, b)  : Maximum of two values
 */
contract FHEArithmetic is ZamaEthereumConfig {
    euint32 private _a;
    euint32 private _b;
    euint32 private _result;

    // solhint-disable-next-line no-empty-blocks
    constructor() {}

    /// @notice Sets the first operand (encrypted)
    /// @dev inputA: The encrypted value for operand A
    ///      inputProof: The proof validating the encrypted input
    function setA(externalEuint32 inputA, bytes calldata inputProof) external {
        _a = FHE.fromExternal(inputA, inputProof);
        FHE.allowThis(_a);
    }

    /// @notice Sets the second operand (encrypted)
    /// @dev inputB: The encrypted value for operand B
    ///      inputProof: The proof validating the encrypted input
    function setB(externalEuint32 inputB, bytes calldata inputProof) external {
        _b = FHE.fromExternal(inputB, inputProof);
        FHE.allowThis(_b);
    }

    /// @notice Computes encrypted addition: result = a + b
    function computeAdd() external {
        _result = FHE.add(_a, _b);
        _grantPermissions();
    }

    /// @notice Computes encrypted subtraction: result = a - b
    /// @dev No underflow protection - in production, add range checks
    function computeSub() external {
        _result = FHE.sub(_a, _b);
        _grantPermissions();
    }

    /// @notice Computes encrypted multiplication: result = a * b
    /// @dev No overflow protection - in production, add range checks
    function computeMul() external {
        _result = FHE.mul(_a, _b);
        _grantPermissions();
    }

    /// @notice Computes encrypted division: result = a / b (scalar)
    /// @dev Divisor must be a scalar (plaintext) because FHE division by encrypted value is not supported.
    ///      divisor: The scalar divisor
    function computeDiv(uint32 divisor) external {
        _result = FHE.div(_a, divisor);
        _grantPermissions();
    }

    /// @notice Computes encrypted remainder: result = a % b (scalar)
    /// @dev Divisor must be a scalar (plaintext).
    ///      modulus: The scalar modulus
    function computeRem(uint32 modulus) external {
        _result = FHE.rem(_a, modulus);
        _grantPermissions();
    }

    /// @notice Computes encrypted minimum: result = min(a, b)
    function computeMin() external {
        _result = FHE.min(_a, _b);
        _grantPermissions();
    }

    /// @notice Computes encrypted maximum: result = max(a, b)
    function computeMax() external {
        _result = FHE.max(_a, _b);
        _grantPermissions();
    }

    /// @notice Returns the encrypted result
    /// @dev Caller must have FHE permissions to decrypt
    function getResult() public view returns (euint32) {
        return _result;
    }

    /// @dev Grants FHE permissions to contract and caller for decryption
    function _grantPermissions() internal {
        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }
}
