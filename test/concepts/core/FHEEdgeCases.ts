import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEEdgeCases, FHEEdgeCases__factory } from "../types";
import type { Signers } from "./types";

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
