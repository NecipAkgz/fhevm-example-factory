import {
  EncryptMultipleValues,
  EncryptMultipleValues__factory,
} from "../types";
import type { Signers } from "./types";
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

async function deployFixture() {
  // Contracts are deployed using the first signer/account by default
  const factory = (await ethers.getContractFactory(
    "EncryptMultipleValues"
  )) as EncryptMultipleValues__factory;
  const encryptMultipleValues =
    (await factory.deploy()) as EncryptMultipleValues;
  const encryptMultipleValues_address =
    await encryptMultipleValues.getAddress();

  return { encryptMultipleValues, encryptMultipleValues_address };
}

/**
 * Encrypt Multiple Values Tests
 *
 * Tests the FHE encryption mechanism for multiple values in a single transaction.
 * Validates handle binding and zero-knowledge proof verification for batched inputs.
 */
describe("EncryptMultipleValues", function () {
  let contract: EncryptMultipleValues;
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
    contractAddress = deployment.encryptMultipleValues_address;
    contract = deployment.encryptMultipleValues;
  });

  // ✅ Test should succeed
  it("encryption should succeed", async function () {
    // Use the FHEVM Hardhat plugin runtime environment
    // to perform FHEVM input encryptions.
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // 🔐 Encryption Process:
    // Create an encrypted input bound to this contract and Alice.
    const input = fhevm.createEncryptedInput(
      contractAddress,
      signers.alice.address
    );

    // Add multiple values of different types to the same input object.
    input.addBool(true);
    input.add32(123456);
    input.addAddress(signers.owner.address);

    // Perform the local encryption.
    // This produces:
    // - `handles`: an array where each index corresponds to the value added above.
    // - `inputProof`: a single ZKP that validates ALL handles in this input.
    const enc = await input.encrypt();

    const inputEbool = enc.handles[0]; // Handle for the boolean
    const inputEuint32 = enc.handles[1]; // Handle for the uint32
    const inputEaddress = enc.handles[2]; // Handle for the address
    const inputProof = enc.inputProof;

    // 🚀 Submit the transaction:
    // We pass all handles and the single input proof.
    const tx = await contract
      .connect(signers.alice)
      .initialize(inputEbool, inputEuint32, inputEaddress, inputProof);
    await tx.wait();

    // 🔓 Verification:
    const encryptedBool = await contract.encryptedBool();
    const encryptedUint32 = await contract.encryptedUint32();
    const encryptedAddress = await contract.encryptedAddress();

    // Use specific decryption helpers for each FHE type.
    const clearBool = await fhevm.userDecryptEbool(
      encryptedBool,
      contractAddress,
      signers.alice
    );

    const clearUint32 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedUint32,
      contractAddress,
      signers.alice
    );

    const clearAddress = await fhevm.userDecryptEaddress(
      encryptedAddress,
      contractAddress,
      signers.alice
    );

    expect(clearBool).to.equal(true);
    expect(clearUint32).to.equal(123456);
    expect(clearAddress).to.equal(signers.owner.address);
  });
});
