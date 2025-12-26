Comprehensive edge case demonstrations for FHE operations. Tests boundary conditions, overflow/underflow, empty inputs, maximum values, gas consumption, and encrypted revert scenarios.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (23 items)</summary>

**Types:** `ebool` · `euint128` · `euint16` · `euint256` · `euint32` · `euint64` · `euint8` · `externalEuint32` · `externalEuint64` · `externalEuint8`

**Functions:**
- `FHE.add()` - Homomorphic addition: result = a + b (overflow wraps)
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.asEbool()` - Encrypts a plaintext boolean into ebool
- `FHE.asEuint32()` - Encrypts a plaintext uint32 value into euint32
- `FHE.asEuint8()` - Encrypts a plaintext uint8 value into euint8
- `FHE.div()` - Homomorphic division: result = a / b (plaintext divisor only)
- `FHE.eq()` - Encrypted equality: returns ebool(a == b)
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.gt()` - Encrypted greater-than: returns ebool(a > b)
- `FHE.mul()` - Homomorphic multiplication: result = a * b
- `FHE.select()` - Encrypted if-then-else: select(cond, a, b) → returns a if true, b if false
- `FHE.sub()` - Homomorphic subtraction: result = a - b (underflow wraps)

</details>

{% tabs %}

{% tab title="FHEEdgeCases.sol" %}

```solidity
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

```

{% endtab %}

{% tab title="FHEEdgeCases.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEEdgeCases, FHEEdgeCases__factory } from "../types";

/** Common signers interface */
interface Signers {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
}

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEEdgeCases"
  )) as FHEEdgeCases__factory;
  const contract = (await factory.deploy()) as FHEEdgeCases;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * FHE Edge Cases Tests
 *
 * Tests boundary conditions, overflows, and technical limits of FHEVM.
 * Validates encrypted logic behavior in extreme scenarios compared to standard EVM.
 */
describe("FHEEdgeCases", function () {
  let contract: FHEEdgeCases;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.contractAddress;
    contract = deployment.contract;
  });

  // ============================================
  // 1️⃣ EMPTY INPUT TESTS
  // ============================================

  describe("Empty Input Tests", function () {
    it("should handle zero addition correctly", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const zeroInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(0)
        .encrypt();

      await contract
        .connect(signers.alice)
        .testZeroAddition(zeroInput.handles[0], zeroInput.inputProof);

      const encrypted = await contract.getResult();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      // 0 + 5 = 5
      expect(decrypted).to.equal(5);
    });

    it("should handle zero multiplication correctly", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const zeroInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(0)
        .encrypt();

      await contract
        .connect(signers.alice)
        .testZeroMultiplication(zeroInput.handles[0], zeroInput.inputProof);

      const encrypted = await contract.getResult();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      // 0 * 999 = 0
      expect(decrypted).to.equal(0);
    });

    it("should handle division with plaintext divisor", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      await contract.connect(signers.alice).testDivisionByPlaintext(10);

      const encrypted = await contract.getResult();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      // 100 / 10 = 10
      expect(decrypted).to.equal(10);
    });
  });

  // ============================================
  // 2️⃣ OVERFLOW & MAXIMUM VALUE TESTS
  // ============================================

  describe("Overflow & Maximum Value Tests", function () {
    it("should handle euint32 maximum value overflow", async function () {
      // ⚠️ Overflow Warning:
      // FHEVM arithmetic is modular. For instance, adding 1 to the maximum
      // value of a `euint32` will wrap around to 0, just like standard `uint32`.
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      await contract.connect(signers.alice).testMaxEuint32();

      const encrypted = await contract.getResult();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      // max + 1 wraps to 0
      expect(decrypted).to.equal(0);
    });

    describe("Overflow Scenarios", function () {
      it("should handle multiplication overflow", async function () {
        const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

        await contract.connect(signers.alice).testMultiplicationOverflow();

        const encrypted = await contract.getResult();
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        );

        // Overflow wraps around - actual result may vary
        expect(decrypted).to.be.greaterThan(0);
      });

      it("should handle chained operations leading to overflow", async function () {
        const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

        await contract.connect(signers.alice).testChainedOverflow();

        const encrypted = await contract.getResult();
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        );

        // (max/4) * 2 * 2 * 2 = overflow, result wraps
        expect(decrypted).to.be.greaterThan(0);
      });
    });

    // ============================================
    // 4️⃣ UNDERFLOW SCENARIOS
    // ============================================

    describe("Underflow Scenarios", function () {
      it("should handle subtraction underflow", async function () {
        const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

        await contract.connect(signers.alice).testSubtractionUnderflow();

        const encrypted = await contract.getResult();
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        );

        // 5 - 10 wraps around to max - 5
        const expected = 2 ** 32 - 5;
        expect(decrypted).to.equal(expected);
      });

      it("should handle zero minus one underflow", async function () {
        const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

        const zeroInput = await fhevm
          .createEncryptedInput(contractAddress, signers.alice.address)
          .add32(0)
          .encrypt();

        await contract
          .connect(signers.alice)
          .testZeroMinusOne(zeroInput.handles[0], zeroInput.inputProof);

        const encrypted = await contract.getResult();
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        );

        // 0 - 1 = max uint32
        expect(decrypted).to.equal(2 ** 32 - 1);
      });
    });

    // ============================================
    // 5️⃣ COMPARISON EDGE CASES
    // ============================================

    describe("Comparison Edge Cases", function () {
      it("should compare encrypted zero values correctly", async function () {
        const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

        const input = await fhevm
          .createEncryptedInput(contractAddress, signers.alice.address)
          .add32(0)
          .add32(0)
          .encrypt();

        await contract
          .connect(signers.alice)
          .testZeroComparison(
            input.handles[0],
            input.handles[1],
            input.inputProof
          );

        const encrypted = await contract.getBoolResult();
        const decrypted = await fhevm.userDecryptEbool(
          encrypted,
          contractAddress,
          signers.alice
        );

        // 0 == 0 should be true
        expect(decrypted).to.be.true;
      });
    });

    // ============================================
    // 6️⃣ TYPE STORAGE EDGE CASES
    // ============================================

    describe("Type Storage Edge Cases", function () {
      it("should store euint8 max value", async function () {
        const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

        await contract.connect(signers.alice).testStoreMaxEuint8();

        const encrypted = await contract.getValue8();
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint8,
          encrypted,
          contractAddress,
          signers.alice
        );

        expect(decrypted).to.equal(255);
      });

      it("should store large euint32 value", async function () {
        const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

        await contract.connect(signers.alice).testStoreLargeEuint32();

        const encrypted = await contract.getResult();
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        );

        expect(decrypted).to.equal(1000);
      });
    });

    // ============================================
    // 7️⃣ GAS CONSUMPTION MEASUREMENTS
    // ============================================

    describe("Gas Consumption Measurements", function () {
      it("should measure addition gas consumption", async function () {
        // ⛽ Gas Tip:
        // FHE operations are significantly more expensive than standard EVM operations.
        // Always measure and optimize the number of encrypted computations.
        const tx = await contract.connect(signers.alice).measureAdditionGas();
        const receipt = await tx.wait();

        const gasUsed = await contract.lastGasUsed();
        expect(gasUsed).to.be.greaterThan(0);
        console.log(`      ⛽ Addition gas: ${gasUsed}`);
      });

      it("should measure multiplication gas consumption", async function () {
        const tx = await contract
          .connect(signers.alice)
          .measureMultiplicationGas();
        const receipt = await tx.wait();

        const gasUsed = await contract.lastGasUsed();
        expect(gasUsed).to.be.greaterThan(0);
        console.log(`      ⛽ Multiplication gas: ${gasUsed}`);
      });

      it("should measure comparison gas consumption", async function () {
        const tx = await contract.connect(signers.alice).measureComparisonGas();
        const receipt = await tx.wait();

        const gasUsed = await contract.lastGasUsed();
        expect(gasUsed).to.be.greaterThan(0);
        console.log(`      ⛽ Comparison gas: ${gasUsed}`);
      });

      it("should measure select operation gas consumption", async function () {
        const tx = await contract.connect(signers.alice).measureSelectGas();
        const receipt = await tx.wait();

        const gasUsed = await contract.lastGasUsed();
        expect(gasUsed).to.be.greaterThan(0);
        console.log(`      ⛽ Select gas: ${gasUsed}`);
      });

      it("should measure chained operations gas consumption", async function () {
        const tx = await contract
          .connect(signers.alice)
          .measureChainedOperationsGas();
        const receipt = await tx.wait();

        const gasUsed = await contract.lastGasUsed();
        expect(gasUsed).to.be.greaterThan(0);
        console.log(`      ⛽ Chained operations gas: ${gasUsed}`);
      });
    });

    // ============================================
    // 8️⃣ PERMISSION EDGE CASES
    // ============================================

    describe("Permission Edge Cases", function () {
      it("should execute without permission grant (edge case)", async function () {
        // This test demonstrates what happens when permissions are missing
        await contract.connect(signers.alice).testMissingPermission();

        // Note: User won't be able to decrypt the result
        // This is intentional to demonstrate the edge case
      });

      it("should handle double permission grant (wasteful but safe)", async function () {
        await contract.connect(signers.alice).testDoublePermission();

        // Double permission is wasteful but doesn't break anything
      });
    });

    // ============================================
    // 9️⃣ ENCRYPTED REVERT SCENARIOS
    // ============================================

    describe("Encrypted Revert Scenarios", function () {
      it("should handle encrypted conditional with valid value", async function () {
        // 🛡️ Encrypted Conditional (Revert Simulation):
        // In FHE, you cannot "revert" based on a secret condition directly.
        // Instead, you typically use `FHE.select` to choose between a meaningful
        // result and a "zeroed out" or "null" result.
        const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

        const validInput = await fhevm
          .createEncryptedInput(contractAddress, signers.alice.address)
          .add32(150) // > 100 threshold
          .encrypt();

        await contract
          .connect(signers.alice)
          .testEncryptedRevert(validInput.handles[0], validInput.inputProof);

        const encrypted = await contract.getResult();
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        );

        // Value > 100, so result should be the value itself
        expect(decrypted).to.equal(150);
      });

      it("should handle encrypted conditional with invalid value", async function () {
        const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

        const invalidInput = await fhevm
          .createEncryptedInput(contractAddress, signers.alice.address)
          .add32(50) // < 100 threshold
          .encrypt();

        await contract
          .connect(signers.alice)
          .testEncryptedRevert(
            invalidInput.handles[0],
            invalidInput.inputProof
          );

        const encrypted = await contract.getResult();
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        );

        // Value <= 100, so result should be 0
        expect(decrypted).to.equal(0);
      });

      it("should handle plaintext revert correctly", async function () {
        const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

        await contract.connect(signers.alice).testPlaintextRevert(200);

        const encrypted = await contract.getResult();
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        );

        expect(decrypted).to.equal(200);
      });

      it("should revert with plaintext value below threshold", async function () {
        await expect(
          contract.connect(signers.alice).testPlaintextRevert(50)
        ).to.be.revertedWith("Value too small");
      });
    });
  });
});

```

{% endtab %}

{% endtabs %}
