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
 * @title FHEHandles
 * @notice Demonstrates FHE handle lifecycle and symbolic execution in FHEVM.
 *
 * @dev WHAT ARE HANDLES?
 *
 * In FHEVM, encrypted values are represented as "handles" (uint256 identifiers).
 * The actual ciphertext is stored off-chain by the FHE coprocessor.
 * Handles are like pointers to encrypted data.
 *
 * HANDLE TYPES:
 * - euint8, euint16, euint32, euint64, euint128, euint256
 * - ebool (encrypted boolean)
 * - eaddress (encrypted address)
 * - ebytes64, ebytes128, ebytes256 (encrypted bytes)
 *
 * HANDLE LIFECYCLE:
 *
 * 1. CREATION
 *    - From user input: FHE.fromExternal(externalHandle, proof)
 *    - From plaintext: FHE.asEuint32(plaintextValue) - creates encrypted constant
 *
 * 2. COMPUTATION
 *    - FHE operations create NEW handles: result = FHE.add(a, b)
 *    - Original handles remain unchanged (immutable)
 *
 * 3. PERMISSIONS (see FHEAccessControl.sol for details)
 *    - Ephemeral: Automatic during transaction, revoked at end
 *    - Permanent: FHE.allow(), FHE.allowThis() - stored in ACL contract
 *
 * 4. STORAGE
 *    - Stored in contract state: euint32 private _value;
 *    - Handle persists, ciphertext managed by coprocessor
 *
 * SYMBOLIC EXECUTION:
 *
 * In mock/local testing, handles are symbolic - they track operations
 * without actual encryption. This enables fast testing.
 * On mainnet, handles point to real ciphertexts.
 */
contract FHEHandles is ZamaEthereumConfig {
    // Storage handles - persist across transactions
    euint32 private _storedValue;
    euint32 private _computedValue;

    // Track handle changes for demonstration
    event HandleCreated(string operation, uint256 gasUsed);
    event HandleStored(string description);

    // solhint-disable-next-line no-empty-blocks
    constructor() {}

    // ========== HANDLE CREATION PATTERNS ==========

    /**
     * @notice Creates a handle from external encrypted input
     * @dev This is the primary way users submit encrypted data
     */
    function createFromExternal(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        uint256 gasBefore = gasleft();

        // Creates new handle from user's encrypted input
        _storedValue = FHE.fromExternal(input, inputProof);

        uint256 gasUsed = gasBefore - gasleft();
        emit HandleCreated("fromExternal", gasUsed);

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);
    }

    /**
     * @notice Creates a handle from a plaintext constant
     * @dev Useful for comparing encrypted values against known constants
     * @param plaintextValue The public value to encrypt
     */
    function createFromPlaintext(uint32 plaintextValue) external {
        uint256 gasBefore = gasleft();

        // Creates encrypted version of a public constant
        // Note: The plaintext IS visible on-chain, but the result is encrypted
        _storedValue = FHE.asEuint32(plaintextValue);

        uint256 gasUsed = gasBefore - gasleft();
        emit HandleCreated("asEuint32", gasUsed);

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);
    }

    // ========== HANDLE COMPUTATION ==========

    /**
     * @notice Demonstrates that FHE operations create NEW handles
     * @dev The original _storedValue handle is unchanged
     */
    function computeNewHandle() external {
        uint256 gasBefore = gasleft();

        // Create a constant for addition
        euint32 constant10 = FHE.asEuint32(10);

        // FHE.add creates a NEW handle - original unchanged
        // _computedValue gets a new handle, _storedValue unchanged
        _computedValue = FHE.add(_storedValue, constant10);

        uint256 gasUsed = gasBefore - gasleft();
        emit HandleCreated("add (new handle)", gasUsed);

        // Must grant permissions for the NEW handle
        FHE.allowThis(_computedValue);
        FHE.allow(_computedValue, msg.sender);

        emit HandleStored("Computed value stored with new handle");
    }

    /**
     * @notice Demonstrates chained operations creating multiple handles
     * @dev Each operation creates an intermediate handle
     */
    function chainedOperations() external {
        // Each of these creates a new handle:
        euint32 step1 = FHE.add(_storedValue, FHE.asEuint32(5)); // Handle 1
        euint32 step2 = FHE.mul(step1, FHE.asEuint32(2)); // Handle 2
        euint32 step3 = FHE.sub(step2, FHE.asEuint32(1)); // Handle 3

        // Only the final result needs permissions if we're storing it
        _computedValue = step3;

        FHE.allowThis(_computedValue);
        FHE.allow(_computedValue, msg.sender);

        // Intermediate handles (step1, step2) have ephemeral permission
        // They are automatically cleaned up
    }

    // ========== HANDLE IMMUTABILITY ==========

    /**
     * @notice Demonstrates that handles are immutable
     * @dev Updating a variable creates a new handle, doesn't modify old one
     */
    function demonstrateImmutability()
        external
        returns (euint32 original, euint32 updated)
    {
        // Store original handle (copy of reference)
        euint32 originalHandle = _storedValue;

        // This creates a NEW handle and assigns it to _storedValue
        _storedValue = FHE.add(_storedValue, FHE.asEuint32(100));

        // Grant permissions
        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);

        // originalHandle still points to the OLD encrypted value
        // _storedValue now points to a NEW handle with (old + 100)
        return (originalHandle, _storedValue);
    }

    // ========== GETTERS ==========

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
