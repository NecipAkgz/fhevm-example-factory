import {
  UserDecryptSingleValue,
  UserDecryptSingleValue__factory,
} from "../types";
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

/** Common signers interface */
interface Signers {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
}

async function deployFixture() {
  // Contracts are deployed using the first signer/account by default
  const factory = (await ethers.getContractFactory(
    "UserDecryptSingleValue"
  )) as UserDecryptSingleValue__factory;
  const userUserDecryptSingleValue =
    (await factory.deploy()) as UserDecryptSingleValue;
  const userUserDecryptSingleValue_address =
    await userUserDecryptSingleValue.getAddress();

  return { userUserDecryptSingleValue, userUserDecryptSingleValue_address };
}

/**
 * User Decrypt Single Value Tests
 *
 * Tests the FHE user decryption mechanism and authorization patterns.
 * Validates re-encryption for authorized users and failure cases for unauthorized access.
 */
describe("UserDecryptSingleValue", function () {
  let contract: UserDecryptSingleValue;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    // Deploy a new contract each time we run a new test
    const deployment = await deployFixture();
    contractAddress = deployment.userUserDecryptSingleValue_address;
    contract = deployment.userUserDecryptSingleValue;
  });

  // ✅ Test should succeed
  it("user decryption should succeed", async function () {
    // 🚀 Initialize the contract with a value.
    // The contract might perform some computations (e.g., adding 1).
    const tx = await contract.connect(signers.alice).initializeUint32(123456);
    await tx.wait();

    const encryptedUint32 = await contract.encryptedUint32();

    // 🔓 Decryption Process:
    // We use the FHEVM Hardhat plugin `userDecryptEuint` helper.
    // This helper handles the re-encryption request and decryption locally.
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    const clearUint32 = await fhevm.userDecryptEuint(
      FhevmType.euint32, // Specify the type (euint32)
      encryptedUint32,
      contractAddress,
      signers.alice // The authorized user
    );

    expect(clearUint32).to.equal(123456 + 1);
  });

  // ❌ Test should fail
  // ❌ Test unauthorized decryption (Common Pitfall)
  it("user decryption should fail", async function () {
    // This contract initialization DOES NOT grant permissions to the user.
    const tx = await contract
      .connect(signers.alice)
      .initializeUint32Wrong(123456);
    await tx.wait();

    const encryptedUint32 = await contract.encryptedUint32();

    // Attempting to decrypt will fail because the contract didn't call `FHE.allow`.
    await expect(
      hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedUint32,
        contractAddress,
        signers.alice
      )
    ).to.be.rejectedWith(
      new RegExp(
        "^dapp contract (.+) is not authorized to user decrypt handle (.+)."
      )
    );
  });
});
