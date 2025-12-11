import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEAntiPatterns, FHEAntiPatterns__factory } from "../types";
import type { Signers } from "./types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEAntiPatterns"
  )) as FHEAntiPatterns__factory;
  const contract = (await factory.deploy()) as FHEAntiPatterns;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Tests for FHE anti-patterns
 * Demonstrates correct patterns for common FHE mistakes
 */
describe("FHEAntiPatterns", function () {
  let contract: FHEAntiPatterns;
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

  describe("Initialization", function () {
    it("should initialize with encrypted balance and threshold", async function () {
      const fhevm = hre.fhevm;
      const balance = 100;
      const threshold = 50;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(balance)
        .add32(threshold)
        .encrypt();

      await contract
        .connect(signers.alice)
        .initialize(input.handles[0], input.handles[1], input.inputProof);

      // Contract should now have encrypted values
      // We can't directly verify values without decryption, but tx should succeed
    });
  });

  describe("Correct Conditional Pattern", function () {
    it("should handle conditional logic with FHE.select", async function () {
      const fhevm = hre.fhevm;

      // Initialize with balance=100, threshold=50
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(100) // balance
        .add32(50) // threshold
        .encrypt();

      await contract
        .connect(signers.alice)
        .initialize(input.handles[0], input.handles[1], input.inputProof);

      // Execute correct conditional - should not revert
      await expect(contract.connect(signers.alice).correctConditional()).to.not
        .be.reverted;
    });
  });

  describe("Correct Computation Pattern", function () {
    it("should compute with proper permission grants", async function () {
      const fhevm = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(50) // balance
        .add32(25) // threshold
        .encrypt();

      await contract
        .connect(signers.alice)
        .initialize(input.handles[0], input.handles[1], input.inputProof);

      // correctCompute grants proper permissions
      await expect(contract.connect(signers.alice).correctCompute()).to.not.be
        .reverted;
    });
  });

  describe("Rules Reference", function () {
    it("should return the key rules summary", async function () {
      const rules = await contract.getRules();
      expect(rules).to.include("FHE.select");
      expect(rules).to.include("FHE.allowThis");
      expect(rules).to.include("require/revert");
    });
  });
});
