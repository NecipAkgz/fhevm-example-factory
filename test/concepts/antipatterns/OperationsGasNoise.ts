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
