Simple example: adding two encrypted values (a + b)

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (6 items)</summary>

**Types:** `euint8` · `externalEuint8`

**Functions:**
- `FHE.add()` - Homomorphic addition: result = a + b (overflow wraps)
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof

</details>

{% tabs %}

{% tab title="FHEAdd.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Simple example demonstrating addition of two encrypted values (a + b)

 * @dev Shows the most basic FHE operation and permission flow.
 *      ⚡ Gas: FHE.add() costs ~100k gas (coprocessor call)
 */
contract FHEAdd is ZamaEthereumConfig {
    euint8 private _a;
    euint8 private _b;
    euint8 private _result;

    /// @notice Set the first operand (encrypted)
    function setA(externalEuint8 inputA, bytes calldata inputProof) external {
        _a = FHE.fromExternal(inputA, inputProof);
        FHE.allowThis(_a);
    }

    /// @notice Set the second operand (encrypted)
    function setB(externalEuint8 inputB, bytes calldata inputProof) external {
        _b = FHE.fromExternal(inputB, inputProof);
        FHE.allowThis(_b);
    }

    /// @notice Compute a + b on encrypted values
    /// @dev Contract operates on ciphertexts - never sees actual values!
    function computeAPlusB() external {
        // 🧮 Homomorphic: operates on encrypted data without decrypting
        _result = FHE.add(_a, _b);

        // 🔑 Why both? allowThis = contract can use it, allow = user can decrypt
        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }

    /// @notice Returns the encrypted result handle
    function result() public view returns (euint8) {
        return _result;
    }
}

```

{% endtab %}

{% tab title="FHEAdd.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEAdd, FHEAdd__factory } from "../types";
import type { Signers } from "./types";

async function deployFixture() {
  // Contracts are deployed using the first signer/account by default
  const factory = (await ethers.getContractFactory(
    "FHEAdd"
  )) as FHEAdd__factory;
  const fheAdd = (await factory.deploy()) as FHEAdd;
  const fheAdd_address = await fheAdd.getAddress();

  return { fheAdd, fheAdd_address };
}

/**
 * This trivial example demonstrates the FHE encryption mechanism
 * and highlights a common pitfall developers may encounter.
 */
describe("FHEAdd", function () {
  let contract: FHEAdd;
  let contractAddress: string;
  let signers: Signers;
  let bob: HardhatEthersSigner;

  before(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
    bob = ethSigners[2];
  });

  beforeEach(async function () {
    // Deploy a new contract each time we run a new test
    const deployment = await deployFixture();
    contractAddress = deployment.fheAdd_address;
    contract = deployment.fheAdd;
  });

  it("a + b should succeed", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    let tx;

    // Let's compute 80 + 123 = 203
    const a = 80;
    const b = 123;

    // Alice encrypts and sets `a` as 80
    const inputA = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(a)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setA(inputA.handles[0], inputA.inputProof);
    await tx.wait();

    // Alice encrypts and sets `b` as 203
    const inputB = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(b)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setB(inputB.handles[0], inputB.inputProof);
    await tx.wait();

    // Why Bob has FHE permissions to execute the operation in this case ?
    // See `computeAPlusB()` in `FHEAdd.sol` for a detailed answer
    tx = await contract.connect(bob).computeAPlusB();
    await tx.wait();

    const encryptedAplusB = await contract.result();

    const clearAplusB = await fhevm.userDecryptEuint(
      FhevmType.euint8, // Specify the encrypted type
      encryptedAplusB,
      contractAddress, // The contract address
      bob // The user wallet
    );

    expect(clearAplusB).to.equal(a + b);
  });
});

```

{% endtab %}

{% endtabs %}
