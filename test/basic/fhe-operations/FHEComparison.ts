import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEComparison, FHEComparison__factory } from "../types";

/** Common signers interface */
interface Signers {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
}

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEComparison"
  )) as FHEComparison__factory;
  const contract = (await factory.deploy()) as FHEComparison;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * FHE Comparison Tests
 *
 * Tests FHE comparison operations and encrypted conditional selection.
 * Validates equality, inequality, and order checks producing encrypted booleans.
 */
describe("FHEComparison", function () {
  let contract: FHEComparison;
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

  describe("Comparison Operations with A=100, B=25", function () {
    const valueA = 100;
    const valueB = 25;

    beforeEach(async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // 🔐 Encrypt input values A and B locally.
      const inputA = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(valueA)
        .encrypt();
      await contract
        .connect(signers.alice)
        .setA(inputA.handles[0], inputA.inputProof);

      const inputB = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(valueB)
        .encrypt();
      await contract
        .connect(signers.alice)
        .setB(inputB.handles[0], inputB.inputProof);
    });

    // ✅ Test Equality (==)
    it("should compute equality correctly (100 == 25 is false)", async function () {
      await contract.connect(signers.alice).computeEq();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(false);
    });

    // ✅ Test Inequality (!=)
    it("should compute inequality correctly (100 != 25 is true)", async function () {
      await contract.connect(signers.alice).computeNe();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(true);
    });

    // ✅ Test Greater Than (>)
    it("should compute greater than correctly (100 > 25 is true)", async function () {
      await contract.connect(signers.alice).computeGt();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(true);
    });

    // ✅ Test Less Than (<)
    it("should compute less than correctly (100 < 25 is false)", async function () {
      await contract.connect(signers.alice).computeLt();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(false);
    });

    // ✅ Test Greater or Equal (>=)
    it("should compute greater or equal correctly (100 >= 25 is true)", async function () {
      await contract.connect(signers.alice).computeGe();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(true);
    });

    // ✅ Test Less or Equal (<=)
    it("should compute less or equal correctly (100 <= 25 is false)", async function () {
      await contract.connect(signers.alice).computeLe();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(false);
    });

    // 🛡️ Test Max Via Select:
    // This demonstrates how to use an encrypted boolean to choose between two encrypted values.
    it("should compute max via select correctly (max(100, 25) = 100)", async function () {
      await contract.connect(signers.alice).computeMaxViaSelect();
      const encrypted = await contract.getSelectedResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(valueA);
    });

    // 🛡️ Test Min Via Select:
    it("should compute min via select correctly (min(100, 25) = 25)", async function () {
      await contract.connect(signers.alice).computeMinViaSelect();
      const encrypted = await contract.getSelectedResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(valueB);
    });
  });
});
