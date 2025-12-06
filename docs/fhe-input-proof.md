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
 * @title FHEInputProof
 * @notice Demonstrates input proof validation in FHEVM.
 *
 * @dev WHAT ARE INPUT PROOFS?
 *
 * When a user sends encrypted data to a contract, they must prove that:
 * 1. The ciphertext was encrypted correctly (valid encryption)
 * 2. The encrypted value is within valid bounds for the type
 * 3. The sender knows the plaintext (proof of knowledge)
 *
 * The inputProof is generated client-side using fhevm.js and verified on-chain
 * by the FHE.fromExternal() function.
 *
 * WHY ARE PROOFS NEEDED?
 *
 * Without proofs, malicious users could:
 * - Submit garbage data that isn't valid ciphertext
 * - Submit ciphertexts encrypted under wrong keys
 * - Corrupt the FHE computation
 *
 * HOW TO USE:
 *
 * 1. Client-side (fhevm.js):
 *    const input = fhevm.createEncryptedInput(contractAddress, userAddress);
 *    input.add32(value);  // or add64, addBool, etc.
 *    const encrypted = await input.encrypt();
 *    // encrypted.handles[0] = the encrypted handle
 *    // encrypted.inputProof = the proof bytes
 *
 * 2. Contract-side:
 *    euint32 value = FHE.fromExternal(externalHandle, inputProof);
 *    // FHE.fromExternal validates the proof and returns internal handle
 *
 * IMPORTANT: Each encrypted input needs its own proof. Multiple inputs
 * can be batched into a single proof using the same createEncryptedInput call.
 */
contract FHEInputProof is ZamaEthereumConfig {
    euint32 private _singleValue;
    euint32 private _valueA;
    euint64 private _valueB;

    // solhint-disable-next-line no-empty-blocks
    constructor() {}

    // ========== SINGLE INPUT PATTERN ==========

    /**
     * @notice Receives a single encrypted input with its proof
     * @param encryptedInput The encrypted handle from client
     * @param inputProof The proof validating the encryption
     *
     * @dev The proof ensures:
     * - encryptedInput is a valid euint32 ciphertext
     * - It was encrypted for this contract
     * - The sender knows the underlying plaintext
     */
    function setSingleValue(
        externalEuint32 encryptedInput,
        bytes calldata inputProof
    ) external {
        // FHE.fromExternal validates proof and converts to internal handle
        _singleValue = FHE.fromExternal(encryptedInput, inputProof);

        // Grant permissions for future access
        FHE.allowThis(_singleValue);
        FHE.allow(_singleValue, msg.sender);
    }

    // ========== MULTIPLE INPUTS PATTERN ==========

    /**
     * @notice Receives multiple encrypted inputs with a single batched proof
     * @param inputA First encrypted uint32
     * @param inputB Second encrypted uint64
     * @param inputProof Single proof covering BOTH inputs
     *
     * @dev Client-side batching:
     *   const input = fhevm.createEncryptedInput(address, user);
     *   input.add32(valueA);  // index 0
     *   input.add64(valueB);  // index 1
     *   const enc = await input.encrypt();
     *   // enc.handles[0] = inputA, enc.handles[1] = inputB
     *   // enc.inputProof covers both values
     */
    function setMultipleValues(
        externalEuint32 inputA,
        externalEuint64 inputB,
        bytes calldata inputProof
    ) external {
        // Both inputs validated by the same proof
        _valueA = FHE.fromExternal(inputA, inputProof);
        _valueB = FHE.fromExternal(inputB, inputProof);

        // Grant permissions
        FHE.allowThis(_valueA);
        FHE.allowThis(_valueB);
        FHE.allow(_valueA, msg.sender);
        FHE.allow(_valueB, msg.sender);
    }

    // ========== COMPUTATION WITH PROOF ==========

    /**
     * @notice Combines a stored value with a new encrypted input
     * @param addend The encrypted value to add
     * @param inputProof Proof for the addend
     */
    function addToValue(
        externalEuint32 addend,
        bytes calldata inputProof
    ) external {
        euint32 validatedAddend = FHE.fromExternal(addend, inputProof);
        _singleValue = FHE.add(_singleValue, validatedAddend);

        FHE.allowThis(_singleValue);
        FHE.allow(_singleValue, msg.sender);
    }

    // ========== GETTERS ==========

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
import { FhevmType, HardhatFhevmRuntimeEnvironment } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEInputProof, FHEInputProof__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEInputProof")) as FHEInputProof__factory;
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
        signers.alice,
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
        .add32(valueA)  // index 0 -> handles[0]
        .add64(valueB)  // index 1 -> handles[1]
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
        signers.alice,
      );
      expect(decryptedA).to.equal(valueA);

      const encryptedB = await contract.getValueB();
      const decryptedB = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedB,
        contractAddress,
        signers.alice,
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
        signers.alice,
      );
      expect(decrypted).to.equal(initialValue + addendValue);
    });
  });
});

```

{% endtab %}

{% endtabs %}
