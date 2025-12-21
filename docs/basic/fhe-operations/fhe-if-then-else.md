Conditional logic without information leakage using FHE.select. Demonstrates how to implement if-then-else logic on encrypted values (computing max of two numbers). Using regular if/else would decrypt and leak which branch was taken. FHE.select evaluates BOTH branches and picks one based on the encrypted condition, preserving privacy.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (8 items)</summary>

**Types:** `ebool` · `euint8` · `externalEuint8`

**Functions:**
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.ge()` - Encrypted greater-or-equal: returns ebool(a >= b)
- `FHE.select()` - Encrypted if-then-else: select(cond, a, b) → returns a if true, b if false

</details>

{% tabs %}

{% tab title="FHEIfThenElse.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Conditional logic without information leakage using FHE.select.
 *         Demonstrates how to implement if-then-else logic on encrypted values
 *         (computing max of two numbers). Using regular if/else would decrypt
 *         and leak which branch was taken. FHE.select evaluates BOTH branches
 *         and picks one based on the encrypted condition, preserving privacy.
 *
 * @dev ❌ Can't use if/else (leaks info!) ✅ Use FHE.select instead
 *      ⚡ Gas: ~120k for select operation
 */
contract FHEIfThenElse is ZamaEthereumConfig {
    euint8 private _a;
    euint8 private _b;
    euint8 private _max;

    /// @notice Sets the first operand (encrypted)
    function setA(externalEuint8 inputA, bytes calldata inputProof) external {
        _a = FHE.fromExternal(inputA, inputProof);
        FHE.allowThis(_a);
    }

    /// @notice Sets the second operand (encrypted)
    function setB(externalEuint8 inputB, bytes calldata inputProof) external {
        _b = FHE.fromExternal(inputB, inputProof);
        FHE.allowThis(_b);
    }

    /// @notice Compute max(a, b) without revealing which is larger
    /// @dev Uses FHE.select() - the encrypted "if-then-else"
    function computeMax() external {
        ebool aIsGreaterOrEqual = FHE.ge(_a, _b);

        // 🔀 Why select? if/else would leak which branch was taken!
        // select evaluates BOTH branches, picks one based on encrypted condition
        _max = FHE.select(aIsGreaterOrEqual, _a, _b);

        // Grant permissions for decryption
        FHE.allowThis(_max);
        FHE.allow(_max, msg.sender);
    }

    /// @notice Returns the encrypted result
    function result() public view returns (euint8) {
        return _max;
    }
}

```

{% endtab %}

{% tab title="FHEIfThenElse.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEIfThenElse, FHEIfThenElse__factory } from "../types";
import type { Signers } from "./types";

async function deployFixture() {
  // Contracts are deployed using the first signer/account by default
  const factory = (await ethers.getContractFactory(
    "FHEIfThenElse"
  )) as FHEIfThenElse__factory;
  const fheIfThenElse = (await factory.deploy()) as FHEIfThenElse;
  const fheIfThenElse_address = await fheIfThenElse.getAddress();

  return { fheIfThenElse, fheIfThenElse_address };
}

/**
 * This trivial example demonstrates the FHE encryption mechanism
 * and highlights a common pitfall developers may encounter.
 */
describe("FHEIfThenElse", function () {
  let contract: FHEIfThenElse;
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
    contractAddress = deployment.fheIfThenElse_address;
    contract = deployment.fheIfThenElse;
  });

  it("a >= b ? a : b should succeed", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    let tx;

    // Let's compute `a >= b ? a : b`
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
    tx = await contract.connect(bob).computeMax();
    await tx.wait();

    const encryptedMax = await contract.result();

    const clearMax = await fhevm.userDecryptEuint(
      FhevmType.euint8, // Specify the encrypted type
      encryptedMax,
      contractAddress, // The contract address
      bob // The user wallet
    );

    expect(clearMax).to.equal(a >= b ? a : b);
  });
});

```

{% endtab %}

{% endtabs %}
