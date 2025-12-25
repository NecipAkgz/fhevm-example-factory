import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEAccessControl, FHEAccessControl__factory } from "../types";
import type { Signers } from "./types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEAccessControl"
  )) as FHEAccessControl__factory;
  const contract = (await factory.deploy()) as FHEAccessControl;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * FHEAccessControl Example:
 * This contract demonstrates how to manage permissions for encrypted data.
 * In FHEVM, only authorized users or the contract itself can decrypt specific variables.
 * We explore the patterns for granting access (allow) and the common pitfall of missing permissions.
 */
describe("FHEAccessControl", function () {
  let contract: FHEAccessControl;
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

  describe("Correct Access Control Pattern", function () {
    const secretValue = 42;

    it("should allow user decryption with full access", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store value with proper permissions
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      // 🛡️ Access Control Verification:
      // The contract uses `FHE.allow` to give Alice permission to decrypt the stored value.
      // Additionally, `FHE.allowThis` ensures the contract itself can use the value in future computations.
      await contract
        .connect(signers.alice)
        .storeWithFullAccess(input.handles[0], input.inputProof);

      expect(await contract.hasAccess(signers.alice.address)).to.equal(true);

      // User should be able to decrypt
      const encrypted = await contract.getSecretValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(secretValue);
    });

    it("should allow granting access to additional users", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Alice stores the value
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      await contract
        .connect(signers.alice)
        .storeWithFullAccess(input.handles[0], input.inputProof);

      // Alice grants access to Bob
      await contract.connect(signers.alice).grantAccess(bob.address);

      // Bob can now decrypt
      const encrypted = await contract.getSecretValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        bob
      );
      expect(decrypted).to.equal(secretValue);
    });
  });

  describe("Wrong Access Control Patterns", function () {
    const secretValue = 42;

    it("should FAIL user decryption without allowThis", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // ❌ Missing Contract Permission (allowThis):
      // Even if the user has permission, if the contract didn't allow *itself* to access
      // the result of an operation, certain on-chain logic might fail or be restricted.
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .storeWithoutAllowThis(input.handles[0], input.inputProof);

      // Attempting to decrypt should fail
      const encrypted = await contract.getSecretValue();
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        )
      ).to.be.rejected;
    });

    it("should FAIL user decryption without user allow", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store value WITHOUT user allow (wrong pattern)
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      await contract
        .connect(signers.alice)
        .storeWithoutUserAllow(input.handles[0], input.inputProof);

      // User (alice) cannot decrypt because no permission was granted
      const encrypted = await contract.getSecretValue();
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        )
      ).to.be.rejected;
    });
  });
});
