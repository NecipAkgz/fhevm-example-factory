This example shows how to encrypt and handle multiple values in a single transaction.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="EncryptMultipleValues.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    externalEbool,
    externalEuint32,
    externalEaddress,
    ebool,
    euint32,
    eaddress
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Demonstrates encrypting multiple values of different types
 *
 * @dev Supported encrypted types:
 *   - euint8/16/32/64/128/256: encrypted integers
 *   - ebool: encrypted boolean
 *   - eaddress: encrypted address
 *   - ebytes64/128/256: encrypted bytes
 */
contract EncryptMultipleValues is ZamaEthereumConfig {
    // 🔐 Three different encrypted types stored together
    ebool private _encryptedEbool; // e.g., vote, permission flag
    euint32 private _encryptedEuint32; // e.g., amount, balance
    eaddress private _encryptedEaddress; // e.g., hidden recipient

    constructor() {}

    /// Store multiple encrypted values from a single batched input
    /// @dev Client-side batching example:
    ///   const input = await fhevm.createEncryptedInput(contractAddr, userAddr)
    ///     .addBool(true).add32(123).addAddress(addr).encrypt();
    ///   // This creates ONE proof for ALL values - more gas efficient!
    function initialize(
        externalEbool inputEbool,
        externalEuint32 inputEuint32,
        externalEaddress inputEaddress,
        bytes calldata inputProof // Single proof covers all values
    ) external {
        // Convert each external input to internal handle
        _encryptedEbool = FHE.fromExternal(inputEbool, inputProof);
        _encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);
        _encryptedEaddress = FHE.fromExternal(inputEaddress, inputProof);

        // ⚠️ IMPORTANT: Each value needs its own permission grants!
        // You cannot batch permission grants

        FHE.allowThis(_encryptedEbool);
        FHE.allow(_encryptedEbool, msg.sender);

        FHE.allowThis(_encryptedEuint32);
        FHE.allow(_encryptedEuint32, msg.sender);

        FHE.allowThis(_encryptedEaddress);
        FHE.allow(_encryptedEaddress, msg.sender);
    }

    function encryptedBool() public view returns (ebool) {
        return _encryptedEbool;
    }

    function encryptedUint32() public view returns (euint32) {
        return _encryptedEuint32;
    }

    function encryptedAddress() public view returns (eaddress) {
        return _encryptedEaddress;
    }
}

```

{% endtab %}

{% tab title="EncryptMultipleValues.ts" %}

```typescript
//TODO;
import { EncryptMultipleValues, EncryptMultipleValues__factory } from "../../../types";
import type { Signers } from "../../types";
import { FhevmType, HardhatFhevmRuntimeEnvironment } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

async function deployFixture() {
  // Contracts are deployed using the first signer/account by default
  const factory = (await ethers.getContractFactory("EncryptMultipleValues")) as EncryptMultipleValues__factory;
  const encryptMultipleValues = (await factory.deploy()) as EncryptMultipleValues;
  const encryptMultipleValues_address = await encryptMultipleValues.getAddress();

  return { encryptMultipleValues, encryptMultipleValues_address };
}

/**
 * This trivial example demonstrates the FHE encryption mechanism
 * and highlights a common pitfall developers may encounter.
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

    const input = fhevm.createEncryptedInput(contractAddress, signers.alice.address);

    input.addBool(true);
    input.add32(123456);
    input.addAddress(signers.owner.address);

    const enc = await input.encrypt();

    const inputEbool = enc.handles[0];
    const inputEuint32 = enc.handles[1];
    const inputEaddress = enc.handles[2];
    const inputProof = enc.inputProof;

    // Don't forget to call `connect(signers.alice)` to make sure
    // the Solidity `msg.sender` is `signers.alice.address`.
    const tx = await contract.connect(signers.alice).initialize(inputEbool, inputEuint32, inputEaddress, inputProof);
    await tx.wait();

    const encryptedBool = await contract.encryptedBool();
    const encryptedUint32 = await contract.encryptedUint32();
    const encryptedAddress = await contract.encryptedAddress();

    const clearBool = await fhevm.userDecryptEbool(
      encryptedBool,
      contractAddress, // The contract address
      signers.alice, // The user wallet
    );

    const clearUint32 = await fhevm.userDecryptEuint(
      FhevmType.euint32, // Specify the encrypted type
      encryptedUint32,
      contractAddress, // The contract address
      signers.alice, // The user wallet
    );

    const clearAddress = await fhevm.userDecryptEaddress(
      encryptedAddress,
      contractAddress, // The contract address
      signers.alice, // The user wallet
    );

    expect(clearBool).to.equal(true);
    expect(clearUint32).to.equal(123456);
    expect(clearAddress).to.equal(signers.owner.address);
  });
});
```

{% endtab %}

{% endtabs %}
