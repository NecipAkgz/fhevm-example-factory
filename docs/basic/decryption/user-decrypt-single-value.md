User-controlled decryption with proper permission management. Demonstrates the critical two-step permission pattern: allowThis() grants the contract permission to store/compute, while allow() grants the user permission to decrypt. Missing either step causes decryption to fail. Includes examples of both correct and incorrect patterns.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (5 items)</summary>

**Types:** `euint32`

**Functions:**
- `FHE.add()` - Homomorphic addition: result = a + b (overflow wraps)
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.asEuint32()` - Encrypts a plaintext uint32 value into euint32

</details>

{% tabs %}

{% tab title="UserDecryptSingleValue.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice User-controlled decryption with proper permission management.
 *         Demonstrates the critical two-step permission pattern: allowThis()
 *         grants the contract permission to store/compute, while allow() grants
 *         the user permission to decrypt. Missing either step causes decryption
 *         to fail. Includes examples of both correct and incorrect patterns.
 *
 * @dev Shows CORRECT vs INCORRECT permission granting.
 *      ⚠️ Both allowThis + allow required for user decryption!
 */
contract UserDecryptSingleValue is ZamaEthereumConfig {
    euint32 private _trivialEuint32;

    /// @notice ✅ CORRECT: Proper permission pattern
    function initializeUint32(uint32 value) external {
        _trivialEuint32 = FHE.add(FHE.asEuint32(value), FHE.asEuint32(1));

        // 🔑 Why both needed?
        // - allowThis: Contract authorizes releasing the value
        // - allow: User can request decryption
        FHE.allowThis(_trivialEuint32);
        FHE.allow(_trivialEuint32, msg.sender);
    }

    /// @notice ❌ WRONG: Missing allowThis causes decryption to FAIL!
    /// @dev Common mistake - user gets permission but decryption still fails
    function initializeUint32Wrong(uint32 value) external {
        _trivialEuint32 = FHE.add(FHE.asEuint32(value), FHE.asEuint32(1));

        // ❌ Missing allowThis → user can't decrypt!
        // Why? Decryption needs contract authorization to release
        FHE.allow(_trivialEuint32, msg.sender);
    }

    function encryptedUint32() public view returns (euint32) {
        return _trivialEuint32;
    }
}

```

{% endtab %}

{% tab title="UserDecryptSingleValue.ts" %}

```typescript
import {
  UserDecryptSingleValue,
  UserDecryptSingleValue__factory,
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
    "UserDecryptSingleValue"
  )) as UserDecryptSingleValue__factory;
  const userUserDecryptSingleValue =
    (await factory.deploy()) as UserDecryptSingleValue;
  const userUserDecryptSingleValue_address =
    await userUserDecryptSingleValue.getAddress();

  return { userUserDecryptSingleValue, userUserDecryptSingleValue_address };
}

/**
 * This trivial example demonstrates the FHE user decryption mechanism
 * and highlights a common pitfall developers may encounter.
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
    const tx = await contract.connect(signers.alice).initializeUint32(123456);
    await tx.wait();

    const encryptedUint32 = await contract.encryptedUint32();

    // The FHEVM Hardhat plugin provides a set of convenient helper functions
    // that make it easy to perform FHEVM operations within your Hardhat environment.
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    const clearUint32 = await fhevm.userDecryptEuint(
      FhevmType.euint32, // Specify the encrypted type
      encryptedUint32,
      contractAddress, // The contract address
      signers.alice // The user wallet
    );

    expect(clearUint32).to.equal(123456 + 1);
  });

  // ❌ Test should fail
  it("user decryption should fail", async function () {
    const tx = await contract
      .connect(signers.alice)
      .initializeUint32Wrong(123456);
    await tx.wait();

    const encryptedUint32 = await contract.encryptedUint32();

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

```

{% endtab %}

{% endtabs %}
