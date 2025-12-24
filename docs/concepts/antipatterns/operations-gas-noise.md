Operations, gas, and noise anti-patterns in FHE development. Covers performance issues, side-channel leaks, noise accumulation, and inefficient encrypted computation patterns.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (10 items)</summary>

**Types:** `euint256` · `euint32` · `externalEuint32`

**Functions:**
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.asEuint256()` - Encrypts a plaintext uint256 value into euint256
- `FHE.asEuint32()` - Encrypts a plaintext uint32 value into euint32
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.makePubliclyDecryptable()` - Marks ciphertext for public decryption via relayer
- `FHE.mul()` - Homomorphic multiplication: result = a * b

</details>

{% tabs %}

{% tab title="FHEOperationsGasNoiseAntiPatterns.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint32,
    euint256,
    externalEuint32
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Operations, gas, and noise anti-patterns in FHE development.
 *         Covers performance issues, side-channel leaks, noise accumulation,
 *         and inefficient encrypted computation patterns.
 *
 * @dev Explores timing side channels, noise, deprecated APIs, and type mismatches.
 */
contract FHEOperationsGasNoiseAntiPatterns is ZamaEthereumConfig {
    euint32 private _secretValue;

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 1: Gas/Timing Side Channel Attacks
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Different code paths have different gas costs
     * @dev Gas consumption reveals which branch was taken
     */
    function wrongGasLeak(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ❌ These operations have different gas costs!
        // If value > 100: expensive operation
        // If value <= 100: cheap operation
        // Gas cost reveals the comparison result!

        // Simulating different paths (commented to avoid actual leak)
        // if (decrypt(value > 100)) {
        //     // Expensive: 10 multiplications
        // } else {
        //     // Cheap: 1 addition
        // }

        _secretValue = value;
        FHE.allowThis(_secretValue);
    }

    /**
     * ✅ CORRECT: Constant-time operations
     * @dev All paths consume same gas
     */
    function correctConstantTime(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ✅ Always perform same operations regardless of value
        euint32 result = FHE.mul(value, FHE.asEuint32(2));

        _secretValue = result;
        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 2: Noise Accumulation (Too Many Operations)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Long chain of FHE operations
     * @dev Each operation adds noise, eventually corrupting ciphertext
     */
    function wrongNoiseAccumulation(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ❌ Too many chained operations!
        // Each mul adds significant noise
        euint32 result = value;
        for (uint i = 0; i < 5; i++) {
            result = FHE.mul(result, FHE.asEuint32(2)); // High noise per operation
        }

        _secretValue = result;
        FHE.allowThis(_secretValue);
    }

    /**
     * ✅ CORRECT: Minimize operation chains
     * @dev Use mathematical optimization to reduce operations
     */
    function correctMinimizeOperations(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ✅ Instead of 5 multiplications by 2, use single multiplication
        // 2^5 = 32
        euint32 result = FHE.mul(value, FHE.asEuint32(32));

        _secretValue = result;
        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 3: Using Deprecated FHEVM APIs
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Using old TFHE.decrypt() pattern
     * @dev Deprecated in FHEVM v0.9+
     */
    function wrongDeprecatedAPI() external pure returns (string memory) {
        // ❌ OLD (v0.8 and earlier):
        // TFHE.decrypt() - went through Zama Oracle
        //
        // This pattern is deprecated and no longer supported

        return "Don't use TFHE.decrypt() - it's deprecated";
    }

    /**
     * ✅ CORRECT: Use modern FHEVM v0.9+ APIs
     * @dev Use FHE.makePubliclyDecryptable() or userDecrypt pattern
     */
    function correctModernAPI() external pure returns (string memory) {
        // ✅ NEW (v0.9+):
        // - FHE.makePubliclyDecryptable() for public decryption
        // - userDecrypt pattern via fhevm.js for user decryption

        return "Use FHE.makePubliclyDecryptable() or fhevm.js userDecrypt()";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 4: Unnecessary Large Data Types
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Using euint256 when euint32 is sufficient
     * @dev Larger types = more gas + more noise
     */
    function wrongOversizedType(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ❌ Unnecessarily converting to euint256!
        // euint256 operations are limited and more expensive
        // This conversion is wasteful when euint32 would suffice
        euint256 largeValue = FHE.asEuint256(value);

        // Converting back to euint32 (double conversion waste!)
        _secretValue = FHE.asEuint32(largeValue);
        FHE.allowThis(_secretValue);
    }

    /**
     * ✅ CORRECT: Use smallest sufficient data type
     * @dev euint32 is cheaper than euint256
     */
    function correctRightSizedType(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        euint32 value = FHE.fromExternal(input, inputProof);

        // ✅ Keep using euint32 if values fit
        euint32 result = FHE.mul(value, FHE.asEuint32(2));

        _secretValue = result;
        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);
    }

    /// @notice Helper to get value for testing
    function getValue() external view returns (euint32) {
        return _secretValue;
    }
}

```

{% endtab %}

{% tab title="OperationsGasNoise.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import {
  FHEOperationsGasNoiseAntiPatterns,
  FHEOperationsGasNoiseAntiPatterns__factory,
} from "../types";
import type { Signers } from "./types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEOperationsGasNoiseAntiPatterns"
  )) as FHEOperationsGasNoiseAntiPatterns__factory;
  const contract =
    (await factory.deploy()) as FHEOperationsGasNoiseAntiPatterns;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Tests for FHE operations, gas, and noise anti-patterns
 * Demonstrates performance issues and optimization techniques
 */
describe("FHEOperationsGasNoiseAntiPatterns", function () {
  let contract: FHEOperationsGasNoiseAntiPatterns;
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

  describe("Pattern 1: Gas/Timing Side Channel", function () {
    const testValue = 50;

    it("wrongGasLeak should store value", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .wrongGasLeak(input.handles[0], input.inputProof);

      // Value should be stored (but without permission to decrypt)
    });

    it("correctConstantTime should use constant gas", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctConstantTime(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      expect(decrypted).to.equal(testValue * 2);
    });
  });

  describe("Pattern 2: Noise Accumulation", function () {
    const testValue = 2;

    it("wrongNoiseAccumulation should chain many operations", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .wrongNoiseAccumulation(input.handles[0], input.inputProof);

      // Result stored but may have accumulated noise
    });

    it("correctMinimizeOperations should use single operation", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctMinimizeOperations(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      // 2 * 32 = 64
      expect(decrypted).to.equal(64);
    });
  });

  describe("Pattern 3: Deprecated APIs", function () {
    it("wrongDeprecatedAPI should return warning string", async function () {
      const result = await contract.wrongDeprecatedAPI();
      expect(result).to.include("deprecated");
    });

    it("correctModernAPI should return guidance string", async function () {
      const result = await contract.correctModernAPI();
      expect(result).to.include("FHE.makePubliclyDecryptable");
    });
  });

  describe("Pattern 4: Type Mismatch", function () {
    const testValue = 100;

    it("wrongOversizedType should use euint256 unnecessarily", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .wrongOversizedType(input.handles[0], input.inputProof);

      // Value stored but with wasteful type conversion
    });

    it("correctRightSizedType should use euint32", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctRightSizedType(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      expect(decrypted).to.equal(testValue * 2);
    });
  });
});

```

{% endtab %}

{% endtabs %}
