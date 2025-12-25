// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint8,
    euint16,
    euint32,
    euint64,
    euint128,
    euint256,
    ebool,
    externalEuint8,
    externalEuint32,
    externalEuint64
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Comprehensive edge case demonstrations for FHE operations.
 *         Tests boundary conditions, overflow/underflow, empty inputs,
 *         maximum values, gas consumption, and encrypted revert scenarios.
 *
 * @dev Educational contract showing how FHE handles edge cases differently
 *      from standard Solidity. Critical for understanding FHE limitations.
 */
contract FHEEdgeCases is ZamaEthereumConfig {
    // Storage for different types
    euint8 private _value8;
    euint16 private _value16;
    euint32 private _value32;
    euint64 private _value64;
    euint128 private _value128;
    euint256 private _value256;

    // Result storage
    euint32 private _result;
    ebool private _boolResult;

    // Gas tracking
    uint256 public lastGasUsed;

    event GasMeasured(string operation, uint256 gasUsed, string description);

    // ============================================
    // 1️⃣ EMPTY INPUT TESTS
    // ============================================

    /// @notice Test zero value operations
    /// @dev Verifies 0 + 5 = 5 works correctly with encrypted zero
    function testZeroAddition(
        externalEuint32 encryptedZero,
        bytes calldata inputProof
    ) external {
        euint32 zero = FHE.fromExternal(encryptedZero, inputProof);
        euint32 five = FHE.asEuint32(5);

        _result = FHE.add(zero, five);

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    /// @notice Test zero multiplication
    /// @dev Verifies 0 * 999 = 0 (encrypted zero nullifies any value)
    function testZeroMultiplication(
        externalEuint32 encryptedZero,
        bytes calldata inputProof
    ) external {
        euint32 zero = FHE.fromExternal(encryptedZero, inputProof);
        euint32 value = FHE.asEuint32(999);

        _result = FHE.mul(zero, value);

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    /// @notice Test division with plaintext divisor
    /// @dev Demonstrates FHE.div requires plaintext divisor (encrypted not supported)
    function testDivisionByPlaintext(uint32 divisor) external {
        euint32 dividend = FHE.asEuint32(100);

        _result = FHE.div(dividend, divisor);

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    // ============================================
    // 2️⃣ OVERFLOW & MAXIMUM VALUE TESTS
    // ============================================

    /// @notice Test euint32 maximum value overflow
    /// @dev Verifies max uint32 + 1 wraps to 0 (demonstrates overflow behavior)
    function testMaxEuint32() external {
        euint32 maxValue = FHE.asEuint32(type(uint32).max);
        euint32 one = FHE.asEuint32(1);

        _result = FHE.add(maxValue, one);

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }



    /// @notice Multiplication overflow
    /// @dev Tests (max/2) * 3 causes overflow and wraps around
    function testMultiplicationOverflow() external {
        euint32 largeValue = FHE.asEuint32(type(uint32).max / 2);

        _result = FHE.mul(largeValue, FHE.asEuint32(3));

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    /// @notice Chained operations leading to overflow
    /// @dev Tests multiple multiplications: (max/4) * 2 * 2 * 2 overflows
    function testChainedOverflow() external {
        euint32 value = FHE.asEuint32(type(uint32).max / 4);

        euint32 step1 = FHE.mul(value, FHE.asEuint32(2));
        euint32 step2 = FHE.mul(step1, FHE.asEuint32(2));
        _result = FHE.mul(step2, FHE.asEuint32(2));

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    // ============================================
    // 4️⃣ UNDERFLOW SCENARIOS
    // ============================================

    /// @notice Subtraction underflow
    /// @dev Tests 5 - 10 wraps to (max - 5) due to underflow
    function testSubtractionUnderflow() external {
        euint32 small = FHE.asEuint32(5);
        euint32 large = FHE.asEuint32(10);

        _result = FHE.sub(small, large);

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    /// @notice Zero minus one underflow
    /// @dev Tests 0 - 1 wraps to max uint32 (underflow behavior)
    function testZeroMinusOne(
        externalEuint32 encryptedZero,
        bytes calldata inputProof
    ) external {
        euint32 zero = FHE.fromExternal(encryptedZero, inputProof);
        euint32 one = FHE.asEuint32(1);

        _result = FHE.sub(zero, one);

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    // ============================================
    // 5️⃣ COMPARISON EDGE CASES
    // ============================================

    /// @notice Compare encrypted zero values
    /// @dev Verifies two encrypted zeros are equal
    function testZeroComparison(
        externalEuint32 encryptedZero1,
        externalEuint32 encryptedZero2,
        bytes calldata inputProof
    ) external {
        euint32 zero1 = FHE.fromExternal(encryptedZero1, inputProof);
        euint32 zero2 = FHE.fromExternal(encryptedZero2, inputProof);

        _boolResult = FHE.eq(zero1, zero2);

        FHE.allowThis(_boolResult);
        FHE.allow(_boolResult, msg.sender);
    }

    // ============================================
    // 6️⃣ TYPE CONVERSION EDGE CASES
    // ============================================

    /// @notice Store euint8 max value
    /// @dev Tests storing and retrieving euint8 maximum (255)
    function testStoreMaxEuint8() external {
        _value8 = FHE.asEuint8(255);

        FHE.allowThis(_value8);
        FHE.allow(_value8, msg.sender);
    }

    /// @notice Store large euint32 value
    /// @dev Tests storing and retrieving a large euint32 (1000)
    function testStoreLargeEuint32() external {
        _result = FHE.asEuint32(1000);

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    // ============================================
    // 7️⃣ GAS CONSUMPTION MEASUREMENTS
    // ============================================

    /// @notice Measure gas for FHE addition
    /// @dev Benchmarks: euint32 + euint32 operation cost
    function measureAdditionGas() external returns (uint256) {
        uint256 gasBefore = gasleft();

        euint32 a = FHE.asEuint32(100);
        euint32 b = FHE.asEuint32(200);
        _result = FHE.add(a, b);

        lastGasUsed = gasBefore - gasleft();
        emit GasMeasured("FHE.add", lastGasUsed, "euint32 + euint32");

        FHE.allowThis(_result);
        return lastGasUsed;
    }

    /// @notice Measure gas for FHE multiplication
    /// @dev Benchmarks: euint32 * euint32 operation cost
    function measureMultiplicationGas() external returns (uint256) {
        uint256 gasBefore = gasleft();

        euint32 a = FHE.asEuint32(100);
        euint32 b = FHE.asEuint32(200);
        _result = FHE.mul(a, b);

        lastGasUsed = gasBefore - gasleft();
        emit GasMeasured("FHE.mul", lastGasUsed, "euint32 * euint32");

        FHE.allowThis(_result);
        return lastGasUsed;
    }

    /// @notice Measure gas for FHE comparison
    /// @dev Benchmarks: euint32 > euint32 operation cost
    function measureComparisonGas() external returns (uint256) {
        uint256 gasBefore = gasleft();

        euint32 a = FHE.asEuint32(100);
        euint32 b = FHE.asEuint32(200);
        _boolResult = FHE.gt(a, b);

        lastGasUsed = gasBefore - gasleft();
        emit GasMeasured("FHE.gt", lastGasUsed, "euint32 > euint32");

        FHE.allowThis(_boolResult);
        return lastGasUsed;
    }

    /// @notice Measure gas for FHE select operation
    /// @dev Benchmarks: encrypted if-then-else (ternary) cost
    function measureSelectGas() external returns (uint256) {
        uint256 gasBefore = gasleft();

        ebool condition = FHE.asEbool(true);
        euint32 ifTrue = FHE.asEuint32(100);
        euint32 ifFalse = FHE.asEuint32(200);

        _result = FHE.select(condition, ifTrue, ifFalse);

        lastGasUsed = gasBefore - gasleft();
        emit GasMeasured("FHE.select", lastGasUsed, "encrypted ternary");

        FHE.allowThis(_result);
        return lastGasUsed;
    }

    /// @notice Measure gas for chained FHE operations
    /// @dev Benchmarks: (10+5)*2-3 = three operations combined
    function measureChainedOperationsGas() external returns (uint256) {
        uint256 gasBefore = gasleft();

        euint32 value = FHE.asEuint32(10);

        euint32 step1 = FHE.add(value, FHE.asEuint32(5));
        euint32 step2 = FHE.mul(step1, FHE.asEuint32(2));
        _result = FHE.sub(step2, FHE.asEuint32(3));

        lastGasUsed = gasBefore - gasleft();
        emit GasMeasured("Chained ops", lastGasUsed, "add+mul+sub");

        FHE.allowThis(_result);
        return lastGasUsed;
    }

    // ============================================
    // 8️⃣ PERMISSION EDGE CASES
    // ============================================

    /// @notice Test operations without permission grant
    /// @dev Demonstrates forgotten permissions prevent decryption (common mistake)
    function testMissingPermission() external {
        euint32 value = FHE.asEuint32(42);

        _result = value;

        // ⚠️ Intentionally NOT granting permissions
        // User won't be able to decrypt this!
    }

    /// @notice Test double permission grant (safe but wasteful)
    /// @dev Shows redundant permissions don't break but waste gas
    function testDoublePermission() external {
        euint32 value = FHE.asEuint32(42);

        FHE.allowThis(value);
        FHE.allowThis(value); // Redundant

        FHE.allow(value, msg.sender);
        FHE.allow(value, msg.sender); // Redundant

        _result = value;
    }

    // ============================================
    // 9️⃣ ENCRYPTED REVERT SCENARIOS
    // ============================================

    /// @notice Conditional revert based on encrypted value
    /// @dev Demonstrates FHE.select pattern (can't use encrypted in require)
    function testEncryptedRevert(
        externalEuint32 encryptedValue,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(encryptedValue, inputProof);
        euint32 threshold = FHE.asEuint32(100);

        ebool isValid = FHE.gt(value, threshold);

        // If invalid, set result to 0; otherwise use value
        _result = FHE.select(isValid, value, FHE.asEuint32(0));

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    /// @notice Demonstrate plaintext revert (safe)
    /// @dev Shows plaintext values CAN be used in require statements
    function testPlaintextRevert(uint32 plaintextValue) external {
        require(plaintextValue > 100, "Value too small");

        _result = FHE.asEuint32(plaintextValue);

        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }



    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function getResult() external view returns (euint32) {
        return _result;
    }

    function getBoolResult() external view returns (ebool) {
        return _boolResult;
    }

    function getValue8() external view returns (euint8) {
        return _value8;
    }

    function getValue64() external view returns (euint64) {
        return _value64;
    }
}
