Explains input proof validation in FHEVM: what proofs are, why they are needed, and how to use them correctly with single and batched inputs.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="FHEInputProof.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint32,
    euint64,
    externalEuint32,
    externalEuint64
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Explains input proof validation in FHEVM: what proofs are, why they are needed, and how to use them correctly with single and batched inputs.
 *
 * @dev Why proofs? They ensure:
 *      1. Ciphertext is valid (not garbage data)
 *      2. Value is in valid range for the type
 *      3. Sender knows the plaintext (proof of knowledge)
 */
contract FHEInputProof is ZamaEthereumConfig {
    euint32 private _singleValue;
    euint32 private _valueA;
    euint64 private _valueB;

    constructor() {}

    // ==================== SINGLE INPUT ====================

    /// @notice Receive single encrypted value with proof
    function setSingleValue(
        externalEuint32 encryptedInput,
        bytes calldata inputProof
    ) external {
        // 📥 FHE.fromExternal validates proof automatically
        // If proof is invalid → transaction reverts
        // Proof ensures:
        //   ✓ Valid euint32 ciphertext
        //   ✓ Encrypted for THIS contract
        //   ✓ Sender knows the plaintext
        _singleValue = FHE.fromExternal(encryptedInput, inputProof);

        FHE.allowThis(_singleValue);
        FHE.allow(_singleValue, msg.sender);
    }

    // ==================== MULTIPLE INPUTS (BATCHED) ====================

    /// @notice Receive multiple encrypted values with SINGLE proof
    /// @dev Client-side batching is more gas-efficient!
    ///
    /// Client code:
    ///   const input = fhevm.createEncryptedInput(contractAddr, userAddr);
    ///   input.add32(valueA);  // → handles[0]
    ///   input.add64(valueB);  // → handles[1]
    ///   const enc = await input.encrypt();
    ///   // enc.inputProof covers BOTH values!
    function setMultipleValues(
        externalEuint32 inputA,
        externalEuint64 inputB,
        bytes calldata inputProof // ← Single proof covers both!
    ) external {
        // Both validated by same proof
        _valueA = FHE.fromExternal(inputA, inputProof);
        _valueB = FHE.fromExternal(inputB, inputProof);

        // ⚠️ Each value needs its own permission grants
        FHE.allowThis(_valueA);
        FHE.allowThis(_valueB);
        FHE.allow(_valueA, msg.sender);
        FHE.allow(_valueB, msg.sender);
    }

    // ==================== COMPUTATION WITH NEW INPUT ====================

    /// @notice Add new encrypted input to existing stored value
    function addToValue(
        externalEuint32 addend,
        bytes calldata inputProof
    ) external {
        // Validate the new input
        euint32 validatedAddend = FHE.fromExternal(addend, inputProof);

        // Combine with stored value
        _singleValue = FHE.add(_singleValue, validatedAddend);

        FHE.allowThis(_singleValue);
        FHE.allow(_singleValue, msg.sender);
    }

    // ==================== GETTERS ====================

    function getSingleValue() external view returns (euint32) {
        return _singleValue;
    }

    function getValueA() external view returns (euint32) {
        return _valueA;
    }

    function getValueB() external view returns (euint64) {
        return _valueB;
    }
}

```

{% endtab %}

{% tab title="FHEInputProof.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEInputProof, FHEInputProof__factory } from "../types";
import type { Signers } from "./types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEInputProof"
  )) as FHEInputProof__factory;
  const contract = (await factory.deploy()) as FHEInputProof;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Tests input proof validation patterns
 * Demonstrates single and multiple encrypted inputs with proofs
 */
describe("FHEInputProof", function () {
  let contract: FHEInputProof;
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

  describe("Single Input with Proof", function () {
    it("should accept and store a single encrypted value with valid proof", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const secretValue = 123;

      // Create encrypted input with proof
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();

      // Submit to contract - proof is validated in fromExternal
      await contract
        .connect(signers.alice)
        .setSingleValue(encryptedInput.handles[0], encryptedInput.inputProof);

      // Verify the value was stored correctly
      const encrypted = await contract.getSingleValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(secretValue);
    });
  });

  describe("Multiple Inputs with Batched Proof", function () {
    it("should accept multiple encrypted values with a single proof", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const valueA = 100;
      const valueB = 200n; // uint64

      // Create batched encrypted input
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(valueA) // index 0 -> handles[0]
        .add64(valueB) // index 1 -> handles[1]
        .encrypt();

      // Submit both values with single proof
      await contract
        .connect(signers.alice)
        .setMultipleValues(
          encryptedInput.handles[0],
          encryptedInput.handles[1],
          encryptedInput.inputProof
        );

      // Verify both values
      const encryptedA = await contract.getValueA();
      const decryptedA = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedA,
        contractAddress,
        signers.alice
      );
      expect(decryptedA).to.equal(valueA);

      const encryptedB = await contract.getValueB();
      const decryptedB = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedB,
        contractAddress,
        signers.alice
      );
      expect(decryptedB).to.equal(valueB);
    });
  });

  describe("Computation with New Input Proof", function () {
    it("should add an encrypted value to stored value", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const initialValue = 100;
      const addendValue = 50;

      // Set initial value
      const input1 = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(initialValue)
        .encrypt();
      await contract
        .connect(signers.alice)
        .setSingleValue(input1.handles[0], input1.inputProof);

      // Add another encrypted value
      const input2 = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(addendValue)
        .encrypt();
      await contract
        .connect(signers.alice)
        .addToValue(input2.handles[0], input2.inputProof);

      // Verify result
      const encrypted = await contract.getSingleValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(initialValue + addendValue);
    });
  });
});

```

{% endtab %}

{% endtabs %}
