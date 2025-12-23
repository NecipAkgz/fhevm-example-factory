import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import {
  FHEPermissionsAntiPatterns,
  FHEPermissionsAntiPatterns__factory,
} from "../types";
import type { Signers } from "./types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEPermissionsAntiPatterns"
  )) as FHEPermissionsAntiPatterns__factory;
  const contract = (await factory.deploy()) as FHEPermissionsAntiPatterns;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Tests for FHE permission anti-patterns
 * Demonstrates wrong and correct permission handling patterns
 */
describe("FHEPermissionsAntiPatterns", function () {
  let contract: FHEPermissionsAntiPatterns;
  let contractAddress: string;
  let signers: Signers;
  let bob: HardhatEthersSigner;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
    bob = ethSigners[2];
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.contractAddress;
    contract = deployment.contract;
  });

  describe("Pattern 1: Missing allowThis", function () {
    const testValue = 42;

    it("should FAIL without allowThis", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .wrongMissingAllowThis(input.handles[0], input.inputProof);

      // Decryption should fail
      const encrypted = await contract.getValue();
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        )
      ).to.be.rejected;
    });

    it("should succeed with allowThis", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctWithAllowThis(input.handles[0], input.inputProof);

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

  describe("Pattern 2: Missing allow(user)", function () {
    const testValue = 100;

    it("should FAIL without user allow", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .wrongMissingUserAllow(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        )
      ).to.be.rejected;
    });

    it("should succeed with user allow", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctWithUserAllow(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      expect(decrypted).to.equal(testValue);
    });
  });

  describe("Pattern 3: View Function Without Permissions", function () {
    const testValue = 200;

    it("should FAIL when stored without permission", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .wrongStoreWithoutPermission(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        )
      ).to.be.rejected;
    });

    it("should succeed when stored with permission", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctStoreWithPermission(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      expect(decrypted).to.equal(testValue);
    });
  });

  describe("Pattern 4: Unauthenticated Re-encryption", function () {
    it("wrongReencryptWithoutAuth should return empty bytes", async function () {
      const dummyPublicKey =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
      const result = await contract.wrongReencryptWithoutAuth(dummyPublicKey);
      expect(result).to.equal("0x");
    });

    it("correctReencryptWithAuth should return encrypted handle", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(123)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctWithUserAllow(input.handles[0], input.inputProof);

      const encrypted = await contract.correctReencryptWithAuth();
      expect(encrypted).to.not.equal(0);
    });
  });

  describe("Pattern 5: Transfer Without Permission", function () {
    const initialBalance = 1000;
    const transferAmount = 100;

    beforeEach(async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Initialize Alice's balance
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(initialBalance)
        .encrypt();

      await contract
        .connect(signers.alice)
        .initializeBalance(input.handles[0], input.inputProof);
    });

    it("should FAIL recipient decryption without permission", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(transferAmount)
        .encrypt();

      await contract
        .connect(signers.alice)
        .wrongTransferWithoutPermission(
          bob.address,
          input.handles[0],
          input.inputProof
        );

      // Bob cannot decrypt his balance
      const encrypted = await contract.getBalance(bob.address);
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          bob
        )
      ).to.be.rejected;
    });

    it("should succeed with permission propagation", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(transferAmount)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctTransferWithPermission(
          bob.address,
          input.handles[0],
          input.inputProof
        );

      // Bob can decrypt his balance
      const encrypted = await contract.getBalance(bob.address);
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        bob
      );

      expect(decrypted).to.equal(transferAmount);
    });
  });

  describe("Pattern 6: Cross-Contract Permission", function () {
    beforeEach(async function () {
      // Initialize _secretValue so the contract has permission on it
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(42)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctWithAllowThis(input.handles[0], input.inputProof);
    });

    it("wrongCrossContractCall should call without permission", async function () {
      const dummyAddress = "0x0000000000000000000000000000000000000001";
      // This will fail but we're just testing it doesn't revert
      await contract.wrongCrossContractCall(dummyAddress);
    });

    it("correctCrossContractCall should grant allowTransient", async function () {
      const dummyAddress = "0x0000000000000000000000000000000000000001";
      // This should succeed - contract has permission on _secretValue
      await contract.correctCrossContractCall(dummyAddress);
    });
  });
});
