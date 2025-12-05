import { FhevmType, HardhatFhevmRuntimeEnvironment } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEArithmetic, FHEArithmetic__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEArithmetic")) as FHEArithmetic__factory;
  const contract = (await factory.deploy()) as FHEArithmetic;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Demonstrates all FHE arithmetic operations on encrypted integers.
 * Tests: add, sub, mul, div, rem, min, max
 */
describe("FHEArithmetic", function () {
  let contract: FHEArithmetic;
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

  describe("Arithmetic Operations", function () {
    const valueA = 100;
    const valueB = 25;

    beforeEach(async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Set encrypted values A and B
      const inputA = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(valueA).encrypt();
      await contract.connect(signers.alice).setA(inputA.handles[0], inputA.inputProof);

      const inputB = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(valueB).encrypt();
      await contract.connect(signers.alice).setB(inputB.handles[0], inputB.inputProof);
    });

    it("should compute addition correctly (100 + 25 = 125)", async function () {
      await contract.connect(signers.alice).computeAdd();
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(valueA + valueB);
    });

    it("should compute subtraction correctly (100 - 25 = 75)", async function () {
      await contract.connect(signers.alice).computeSub();
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(valueA - valueB);
    });

    it("should compute multiplication correctly (100 * 25 = 2500)", async function () {
      await contract.connect(signers.alice).computeMul();
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(valueA * valueB);
    });

    it("should compute division correctly (100 / 25 = 4)", async function () {
      await contract.connect(signers.alice).computeDiv(valueB);
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(Math.floor(valueA / valueB));
    });

    it("should compute remainder correctly (100 % 25 = 0)", async function () {
      await contract.connect(signers.alice).computeRem(valueB);
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(valueA % valueB);
    });

    it("should compute minimum correctly (min(100, 25) = 25)", async function () {
      await contract.connect(signers.alice).computeMin();
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(Math.min(valueA, valueB));
    });

    it("should compute maximum correctly (max(100, 25) = 100)", async function () {
      await contract.connect(signers.alice).computeMax();
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(Math.max(valueA, valueB));
    });
  });
});
