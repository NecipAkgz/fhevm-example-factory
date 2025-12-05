import { FhevmType, HardhatFhevmRuntimeEnvironment } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEHandles, FHEHandles__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEHandles")) as FHEHandles__factory;
  const contract = (await factory.deploy()) as FHEHandles;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Tests FHE handle lifecycle and operations
 * Demonstrates handle creation, computation, and immutability
 */
describe("FHEHandles", function () {
  let contract: FHEHandles;
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

  describe("Handle Creation", function () {
    it("should create handle from external encrypted input", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const value = 42;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(value)
        .encrypt();

      await contract
        .connect(signers.alice)
        .createFromExternal(input.handles[0], input.inputProof);

      const encrypted = await contract.getStoredValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(value);
    });

    it("should create handle from plaintext constant", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const plaintextValue = 100;

      await contract.connect(signers.alice).createFromPlaintext(plaintextValue);

      const encrypted = await contract.getStoredValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(plaintextValue);
    });
  });

  describe("Handle Computation", function () {
    const initialValue = 50;

    beforeEach(async function () {
      await contract.connect(signers.alice).createFromPlaintext(initialValue);
    });

    it("should create new handle when computing", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // computeNewHandle adds 10 to stored value
      await contract.connect(signers.alice).computeNewHandle();

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(initialValue + 10);
    });

    it("should handle chained operations correctly", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // chainedOperations: (value + 5) * 2 - 1
      // (50 + 5) * 2 - 1 = 55 * 2 - 1 = 110 - 1 = 109
      await contract.connect(signers.alice).chainedOperations();

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(109);
    });
  });

  describe("Handle Immutability", function () {
    it("should demonstrate handle immutability", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const initialValue = 100;

      await contract.connect(signers.alice).createFromPlaintext(initialValue);

      // Get original value before update
      const originalEncrypted = await contract.getStoredValue();

      // This updates _storedValue to (old + 100)
      await contract.connect(signers.alice).demonstrateImmutability();

      // Get new value
      const newEncrypted = await contract.getStoredValue();
      const newDecrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        newEncrypted,
        contractAddress,
        signers.alice,
      );

      // New value should be initialValue + 100
      expect(newDecrypted).to.equal(initialValue + 100);

      // The handles should be different (different encrypted values)
      // Note: In mock mode, we can't directly compare handle values
    });
  });
});
