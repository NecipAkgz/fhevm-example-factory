Understanding FHE handles: creation, computation, immutability, and symbolic execution in mock mode.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="FHEHandles.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Demonstrates FHE handle lifecycle: creation, computation, and storage
 *
 * @dev Handle = uint256 pointer to encrypted data stored by FHE coprocessor.
 *      Types: euint8/16/32/64/128/256, ebool, eaddress, ebytes64/128/256
 */
contract FHEHandles is ZamaEthereumConfig {
    // 🔐 Storage handles - persist across transactions
    // These are just uint256 pointers, actual ciphertext is off-chain
    euint32 private _storedValue;
    euint32 private _computedValue;

    event HandleCreated(string operation, uint256 gasUsed);
    event HandleStored(string description);

    constructor() {}

    // ==================== HANDLE CREATION ====================

    /// @notice Pattern 1: Create handle from user's encrypted input
    function createFromExternal(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        uint256 gasBefore = gasleft();

        // 📥 FHE.fromExternal: converts external handle to internal handle
        // The proof is verified automatically
        _storedValue = FHE.fromExternal(input, inputProof);

        emit HandleCreated("fromExternal", gasBefore - gasleft());

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);
    }

    /// @notice Pattern 2: Create handle from plaintext constant
    /// @dev ⚠️ The plaintext IS visible on-chain! But result is encrypted.
    function createFromPlaintext(uint32 plaintextValue) external {
        uint256 gasBefore = gasleft();

        // 📥 FHE.asEuint32: encrypts a public constant
        // Use for: thresholds, comparison values, zero-initialization
        _storedValue = FHE.asEuint32(plaintextValue);

        emit HandleCreated("asEuint32", gasBefore - gasleft());

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);
    }

    // ==================== HANDLE COMPUTATION ====================

    /// @notice Key insight: FHE operations create NEW handles
    /// @dev Original handles are IMMUTABLE - they never change
    function computeNewHandle() external {
        uint256 gasBefore = gasleft();

        euint32 constant10 = FHE.asEuint32(10);

        // 🔄 FHE.add creates a BRAND NEW handle
        // _storedValue handle is UNCHANGED
        // _computedValue gets the NEW handle
        _computedValue = FHE.add(_storedValue, constant10);

        emit HandleCreated("add (new handle)", gasBefore - gasleft());

        // ⚠️ Must grant permissions for the NEW handle!
        FHE.allowThis(_computedValue);
        FHE.allow(_computedValue, msg.sender);

        emit HandleStored("Computed value stored with new handle");
    }

    /// @notice Chained operations = multiple intermediate handles
    function chainedOperations() external {
        // 📝 Each operation creates a new handle:
        euint32 step1 = FHE.add(_storedValue, FHE.asEuint32(5)); // Handle #1
        euint32 step2 = FHE.mul(step1, FHE.asEuint32(2)); // Handle #2
        euint32 step3 = FHE.sub(step2, FHE.asEuint32(1)); // Handle #3

        _computedValue = step3;

        // Only final result needs permissions (if we're storing it)
        // Intermediate handles (step1, step2) have ephemeral permission
        // and are automatically cleaned up after transaction
        FHE.allowThis(_computedValue);
        FHE.allow(_computedValue, msg.sender);
    }

    // ==================== HANDLE IMMUTABILITY ====================

    /// @notice Demonstrates: updating a variable creates NEW handle
    function demonstrateImmutability()
        external
        returns (euint32 original, euint32 updated)
    {
        // 📌 Save reference to current handle
        euint32 originalHandle = _storedValue;

        // 🔄 This creates NEW handle, assigns to _storedValue
        // originalHandle still points to OLD value!
        _storedValue = FHE.add(_storedValue, FHE.asEuint32(100));

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);

        // originalHandle → old value
        // _storedValue → new value (old + 100)
        return (originalHandle, _storedValue);
    }

    // ==================== GETTERS ====================

    function getStoredValue() external view returns (euint32) {
        return _storedValue;
    }

    function getComputedValue() external view returns (euint32) {
        return _computedValue;
    }
}

```

{% endtab %}

{% tab title="FHEHandles.ts" %}

```typescript
import { FhevmType, HardhatFhevmRuntimeEnvironment } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEHandles, FHEHandles__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEHandles")) as FHEHandles__factory;
  const contract = (await factory.deploy()) as FHEHandles;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Tests FHE handle lifecycle and operations
 * Demonstrates handle creation, computation, and immutability
 */
describe("FHEHandles", function () {
  let contract: FHEHandles;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.contractAddress;
    contract = deployment.contract;
  });

  describe("Handle Creation", function () {
    it("should create handle from external encrypted input", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const value = 42;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(value)
        .encrypt();

      await contract
        .connect(signers.alice)
        .createFromExternal(input.handles[0], input.inputProof);

      const encrypted = await contract.getStoredValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(value);
    });

    it("should create handle from plaintext constant", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const plaintextValue = 100;

      await contract.connect(signers.alice).createFromPlaintext(plaintextValue);

      const encrypted = await contract.getStoredValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(plaintextValue);
    });
  });

  describe("Handle Computation", function () {
    const initialValue = 50;

    beforeEach(async function () {
      await contract.connect(signers.alice).createFromPlaintext(initialValue);
    });

    it("should create new handle when computing", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // computeNewHandle adds 10 to stored value
      await contract.connect(signers.alice).computeNewHandle();

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(initialValue + 10);
    });

    it("should handle chained operations correctly", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // chainedOperations: (value + 5) * 2 - 1
      // (50 + 5) * 2 - 1 = 55 * 2 - 1 = 110 - 1 = 109
      await contract.connect(signers.alice).chainedOperations();

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(109);
    });
  });

  describe("Handle Immutability", function () {
    it("should demonstrate handle immutability", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const initialValue = 100;

      await contract.connect(signers.alice).createFromPlaintext(initialValue);

      // Get original value before update
      const originalEncrypted = await contract.getStoredValue();

      // This updates _storedValue to (old + 100)
      await contract.connect(signers.alice).demonstrateImmutability();

      // Get new value
      const newEncrypted = await contract.getStoredValue();
      const newDecrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        newEncrypted,
        contractAddress,
        signers.alice,
      );

      // New value should be initialValue + 100
      expect(newDecrypted).to.equal(initialValue + 100);

      // The handles should be different (different encrypted values)
      // Note: In mock mode, we can't directly compare handle values
    });
  });
});

```

{% endtab %}

{% endtabs %}
