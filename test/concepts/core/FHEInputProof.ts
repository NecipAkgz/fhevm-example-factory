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
 * FHE Input Proof Tests
 *
 * Tests encrypted input submission and Zero-Knowledge Proof (ZKP) verification.
 * Validates that only correctly encrypted and proven values are accepted by the FHEVM.
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

      // 🔐 Create an encrypted input with a proof:
      // The `encrypt()` method generates both the `handles` and a single `inputProof`.
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

      // 🔐 Batching multiple inputs:
      // A single `inputProof` can validate multiple `handles` created in the same call.
      // This is more gas-efficient than submitting multiple proofs.
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
