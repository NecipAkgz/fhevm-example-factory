Confidential counter with encrypted increment/decrement operations. Demonstrates the FHE workflow: encryption, computation, and permission management while keeping the counter value private.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (8 items)</summary>

**Types:** `euint32` · `externalEuint32`

**Functions:**
- `FHE.add()` - Homomorphic addition: result = a + b (overflow wraps)
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.select()` - Encrypted if-then-else: select(cond, a, b) → returns a if true, b if false
- `FHE.sub()` - Homomorphic subtraction: result = a - b (underflow wraps)

</details>

{% tabs %}

{% tab title="FHECounter.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Confidential counter with encrypted increment/decrement operations.
 *         Demonstrates the FHE workflow: encryption, computation, and permission
 *         management while keeping the counter value private.

 * @dev Workflow: fromExternal (validation) → arithmetic → permissions.
 */
contract FHECounter is ZamaEthereumConfig {
    euint32 private _count;

    function getCount() external view returns (euint32) {
        return _count;
    }

    /// @notice Increments counter by encrypted amount
    /// @dev Why allowThis + allow? Contract needs permission to store,
    ///      user needs permission to decrypt. Both required!
    function increment(
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) external {
        // 🔐 Why proof? Ensures valid ciphertext encrypted for THIS contract
        euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);

        // 🧮 Homomorphic add: works on encrypted data
        _count = FHE.add(_count, encryptedValue);

        // 🔑 Both needed: allowThis = contract stores, allow = user decrypts
        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);
    }

    /// @notice Decrements counter by encrypted amount
    /// @dev ⚠️ No underflow protection! FHE.sub wraps around at 0.
    ///      ❌ WRONG: Checking result < 0 reveals information
    ///      ✅ CORRECT: Use application-level balance tracking or FHE.select()
    function decrement(
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) external {
        euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);

        _count = FHE.sub(_count, encryptedValue);

        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);
    }
}

```

{% endtab %}

{% tab title="FHECounter.ts" %}

```typescript
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHECounter, FHECounter__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHECounter"
  )) as FHECounter__factory;
  const fheCounterContract = (await factory.deploy()) as FHECounter;
  const fheCounterContractAddress = await fheCounterContract.getAddress();

  return { fheCounterContract, fheCounterContractAddress };
}

/**
 * FHE Counter Tests
 *
 * Tests encrypted increment/decrement operations and basic decryption patterns.
 * Demonstrates confidential state transitions in a simple counter.
 */
describe("FHECounter", function () {
  let signers: Signers;
  let fheCounterContract: FHECounter;
  let fheCounterContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
    };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ fheCounterContract, fheCounterContractAddress } = await deployFixture());
  });

  // 🛡️ Initial State Check
  it("encrypted count should be uninitialized after deployment", async function () {
    const encryptedCount = await fheCounterContract.getCount();
    // In FHEVM, uninitialized encrypted variables typically return bytes32(0).
    // This represents a null handle rather than a specific encrypted 0.
    expect(encryptedCount).to.eq(ethers.ZeroHash);
  });

  // ✅ Test encrypted increment
  it("increment the counter by 1", async function () {
    const encryptedCountBeforeInc = await fheCounterContract.getCount();
    expect(encryptedCountBeforeInc).to.eq(ethers.ZeroHash);
    const clearCountBeforeInc = 0;

    // 🔐 Encryption Process:
    const clearOne = 1;
    // Create an encrypted input bound to this contract and Alice.
    const encryptedOne = await fhevm
      .createEncryptedInput(fheCounterContractAddress, signers.alice.address)
      .add32(clearOne) // Add the value we want to encrypt
      .encrypt();

    // 🚀 Submit the transaction:
    // We pass both the `handle` (pointer to encrypted data) and the `inputProof` (ZKP).
    const tx = await fheCounterContract
      .connect(signers.alice)
      .increment(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    // 🔓 Verification:
    const encryptedCountAfterInc = await fheCounterContract.getCount();
    // We use the FHEVM plugin to perform a re-encryption/decryption for testing.
    const clearCountAfterInc = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCountAfterInc,
      fheCounterContractAddress,
      signers.alice
    );

    expect(clearCountAfterInc).to.eq(clearCountBeforeInc + clearOne);
  });

  // ✅ Test encrypted decrement
  it("decrement the counter by 1", async function () {
    // 🔐 Prepare encrypted input
    const clearOne = 1;
    const encryptedOne = await fhevm
      .createEncryptedInput(fheCounterContractAddress, signers.alice.address)
      .add32(clearOne)
      .encrypt();

    // First increment by 1, count becomes 1
    let tx = await fheCounterContract
      .connect(signers.alice)
      .increment(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    // Then decrement by 1, count goes back to 0
    // Note: We are reusing the same encrypted handle/proof here.
    tx = await fheCounterContract
      .connect(signers.alice)
      .decrement(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    // 🔓 Verify final result
    const encryptedCountAfterDec = await fheCounterContract.getCount();
    const clearCountAfterInc = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCountAfterDec,
      fheCounterContractAddress,
      signers.alice
    );

    expect(clearCountAfterInc).to.eq(0);
  });
});

```

{% endtab %}

{% endtabs %}
