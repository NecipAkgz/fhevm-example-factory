import {
  UserDecryptMultipleValues,
  UserDecryptMultipleValues__factory,
} from "../types";
import type { Signers } from "./types";
import { HardhatFhevmRuntimeEnvironment } from "@fhevm/hardhat-plugin";
import { utils as fhevm_utils } from "@fhevm/mock-utils";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DecryptedResults } from "@zama-fhe/relayer-sdk";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

async function deployFixture() {
  // Contracts are deployed using the first signer/account by default
  const factory = (await ethers.getContractFactory(
    "UserDecryptMultipleValues"
  )) as UserDecryptMultipleValues__factory;
  const userDecryptMultipleValues =
    (await factory.deploy()) as UserDecryptMultipleValues;
  const userDecryptMultipleValues_address =
    await userDecryptMultipleValues.getAddress();

  return { userDecryptMultipleValues, userDecryptMultipleValues_address };
}

/**
 * User Decrypt Multiple Values Tests
 *
 * Tests the FHE user decryption mechanism for multiple values in a single batch.
 * Validates EIP-712 signed authorization for re-encryption of multiple handles.
 */
describe("UserDecryptMultipleValues", function () {
  let contract: UserDecryptMultipleValues;
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
    contractAddress = deployment.userDecryptMultipleValues_address;
    contract = deployment.userDecryptMultipleValues;
  });

  // ✅ Test should succeed
  it("user decryption should succeed", async function () {
    // 🚀 Initialize the contract with multiple values.
    const tx = await contract
      .connect(signers.alice)
      .initialize(true, 123456, 78901234567);
    await tx.wait();

    const encryptedBool = await contract.encryptedBool();
    const encryptedUint32 = await contract.encryptedUint32();
    const encryptedUint64 = await contract.encryptedUint64();

    // 🔓 Decryption Process for Multiple Values:
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // 1. Generate a temporary keypair for the decryption request.
    const aliceKeypair = fhevm.generateKeypair();

    const startTimestamp = fhevm_utils.timestampNow();
    const durationDays = 365;

    // 2. Create an EIP-712 request to authorize decryption of these handles.
    const aliceEip712 = fhevm.createEIP712(
      aliceKeypair.publicKey,
      [contractAddress],
      startTimestamp,
      durationDays
    );

    // 3. User (Alice) signs the EIP-712 request.
    const aliceSignature = await signers.alice.signTypedData(
      aliceEip712.domain,
      {
        UserDecryptRequestVerification:
          aliceEip712.types.UserDecryptRequestVerification,
      },
      aliceEip712.message
    );

    // 4. Perform the batch decryption.
    // This sends the request to the (mock) relayer, which re-encrypts the values
    // for Alice's temporary public key and then decrypts them.
    const decrytepResults: DecryptedResults = await fhevm.userDecrypt(
      [
        { handle: encryptedBool, contractAddress: contractAddress },
        { handle: encryptedUint32, contractAddress: contractAddress },
        { handle: encryptedUint64, contractAddress: contractAddress },
      ],
      aliceKeypair.privateKey,
      aliceKeypair.publicKey,
      aliceSignature,
      [contractAddress],
      signers.alice.address,
      startTimestamp,
      durationDays
    );

    expect(decrytepResults[encryptedBool]).to.equal(true);
    expect(decrytepResults[encryptedUint32]).to.equal(123456 + 1);
    expect(decrytepResults[encryptedUint64]).to.equal(78901234567 + 1);
  });
});
