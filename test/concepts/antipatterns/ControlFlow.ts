import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import {
  FHEControlFlowAntiPatterns,
  FHEControlFlowAntiPatterns__factory,
} from "../types";

/** Common signers interface */
interface Signers {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
}

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEControlFlowAntiPatterns"
  )) as FHEControlFlowAntiPatterns__factory;
  const contract = (await factory.deploy()) as FHEControlFlowAntiPatterns;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * FHE Control Flow Anti-Pattern Tests
 *
 * Tests the limitations of using encrypted variables in standard EVM control flow.
 * Validates proper use of FHE.select for conditional logic instead of branching.
 */
describe("FHEControlFlowAntiPatterns", function () {
  let contract: FHEControlFlowAntiPatterns;
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

    // Initialize contract with test values
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // Create encrypted input for balance only (threshold is fixed at 100)
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(50) // balance
      .encrypt();

    await contract
      .connect(signers.alice)
      .initialize(input.handles[0], input.inputProof);
  });

  describe("Pattern 1: If/Else Branching", function () {
    it("should execute correctConditional without leaking information", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // ✅ Correct Pattern:
      // Use `FHE.select` to perform conditional logic. The contract executes
      // both "branches" mathematically, and the result is chosen based on the encrypted boolean.
      await contract.connect(signers.alice).correctConditional();

      const encrypted = await contract.getBalance();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      // Balance (50) is not above threshold (100), so no penalty applied
      expect(decrypted).to.equal(50);
    });

    it("wrongBranching should return placeholder value", async function () {
      const result = await contract.wrongBranching.staticCall();
      expect(result).to.equal(0);
    });
  });

  describe("Pattern 2: Require/Revert", function () {
    it("should return encrypted boolean for validation", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Execute validation (stores result)
      await contract.connect(signers.alice).correctValidation();

      // Get result via getter
      const encrypted = await contract.getValidationResult();
      const decrypted = await fhevm.userDecryptEbool(
        encrypted,
        contractAddress,
        signers.alice
      );

      // Balance (50) < 100, so should be false
      expect(decrypted).to.equal(false);
    });

    it("wrongRequire should return explanation string", async function () {
      // ❌ Antipattern: `require(encryptedCondition)`
      // This will always fail or behave unexpectedly because the EVM
      // cannot evaluate an encrypted boolean handle as a truthy/falsy value.
      const result = await contract.wrongRequire();
      expect(result).to.include("doesn't work with encrypted values");
    });
  });

  describe("Pattern 3: Encrypted Loop Iterations", function () {
    it("should use fixed iterations with FHE.select", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      await contract.connect(signers.alice).correctFixedIterations();

      // Result should count up to min(balance, MAX_ITERATIONS)
      // Balance is 50, MAX_ITERATIONS is 5, so result should be 5
    });

    it("wrongEncryptedLoop should return explanation string", async function () {
      // ❌ Antipattern: Loops with encrypted exit conditions.
      // Loops must have plaintext boundaries to avoid leaking sensitive information
      // through the number of iterations (which is visible to everyone).
      const result = await contract.wrongEncryptedLoop();
      expect(result).to.include("Loop iterations leak");
    });
  });
});
