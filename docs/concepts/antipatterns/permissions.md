Permission management anti-patterns in FHE development. Covers mistakes with allowThis, allow, and permission propagation across transfers and cross-contract calls.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (10 items)</summary>

**Types:** `euint32` · `externalEuint32`

**Functions:**
- `FHE.add()` - Homomorphic addition: result = a + b (overflow wraps)
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.allowTransient()` - Grants TEMPORARY permission (expires at tx end)
- `FHE.asEuint32()` - Encrypts a plaintext uint32 value into euint32
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.mul()` - Homomorphic multiplication: result = a * b
- `FHE.sub()` - Homomorphic subtraction: result = a - b (underflow wraps)

</details>

{% tabs %}

{% tab title="FHEPermissionsAntiPatterns.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Permission management anti-patterns in FHE development.
 *         Covers mistakes with allowThis, allow, and permission propagation
 *         across transfers and cross-contract calls.
 *
 * @dev Explores missing permissions, view function failures, and delegation issues.
 */
contract FHEPermissionsAntiPatterns is ZamaEthereumConfig {
    euint32 private _secretValue;
    mapping(address => euint32) private _balances;

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 1: Missing allowThis After Computation
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Compute but forget allowThis
     * @dev Result exists but contract can't use it in future operations
     */
    function wrongMissingAllowThis(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);
        euint32 doubled = FHE.mul(_secretValue, FHE.asEuint32(2));
        _secretValue = doubled;

        // ❌ Missing FHE.allowThis! Contract can't use this value later
        FHE.allow(_secretValue, msg.sender);
    }

    /**
     * ✅ CORRECT: Always grant allowThis after computation
     * @dev Contract needs permission to use encrypted values
     */
    function correctWithAllowThis(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);
        euint32 doubled = FHE.mul(_secretValue, FHE.asEuint32(2));
        _secretValue = doubled;

        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 2: Missing allow(user)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Only allowThis without user permission
     * @dev No one can decrypt the value
     */
    function wrongMissingUserAllow(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Contract can compute but no one can decrypt!
        FHE.allowThis(_secretValue);
    }

    /**
     * ✅ CORRECT: Grant both allowThis and allow(user)
     * @dev User can decrypt after contract operations
     */
    function correctWithUserAllow(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 3: View Function Without Permissions
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Store value without granting permission to caller
     * @dev When caller tries to get value via view, they can't decrypt it
     */
    function wrongStoreWithoutPermission(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Only allowThis, caller has no permission!
        FHE.allowThis(_secretValue);
    }

    /**
     * ✅ CORRECT: Grant permission to caller when storing
     * @dev Caller can now decrypt value returned from view function
     */
    function correctStoreWithPermission(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender); // ✅ Grant permission!
    }

    /// @notice View function to get stored value
    function getValue() external view returns (euint32) {
        return _secretValue;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 4: Unauthenticated Re-encryption
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Re-encrypt without verifying public key ownership
     * @dev Anyone can provide any public key and steal encrypted data
     */
    function wrongReencryptWithoutAuth(
        bytes32 publicKey
    ) external view returns (bytes memory) {
        // ❌ SECURITY RISK: No verification that caller owns this public key!
        // Attacker can provide victim's public key and get their data

        // This would allow impersonation attacks:
        // return Gateway.reencrypt(_secretValue, publicKey);

        return ""; // Placeholder
    }

    /**
     * ✅ CORRECT: Use FHEVM's built-in authentication
     * @dev fhevm.js SDK verifies EIP-712 signature automatically
     *      Only the owner of the public key can decrypt
     */
    function correctReencryptWithAuth() external view returns (euint32) {
        // ✅ Return handle directly
        // Client uses fhevm.instance.reencrypt() which:
        // 1. Signs request with their private key (EIP-712)
        // 2. Gateway verifies signature matches public key
        // 3. Only then re-encrypts for that public key

        return _secretValue;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 5: Transfer Without Permission Propagation
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize balance for msg.sender
     * @dev Required before using transfer functions
     */
    function initializeBalance(
        externalEuint32 initialBalance,
        bytes calldata inputProof
    ) external {
        _balances[msg.sender] = FHE.fromExternal(initialBalance, inputProof);
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
    }

    /**
     * ❌ WRONG: Transfer without granting permissions
     * @dev Recipient gets balance but can't use or decrypt it
     */
    function wrongTransferWithoutPermission(
        address recipient,
        externalEuint32 amount,
        bytes calldata inputProof
    ) external {
        euint32 transferAmount = FHE.fromExternal(amount, inputProof);

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], transferAmount);
        _balances[recipient] = FHE.add(_balances[recipient], transferAmount);

        // ❌ Recipient has no permission to use their new balance!
    }

    /**
     * ✅ CORRECT: Grant permissions after transfer
     * @dev Both parties can use and decrypt their updated balances
     */
    function correctTransferWithPermission(
        address recipient,
        externalEuint32 amount,
        bytes calldata inputProof
    ) external {
        euint32 transferAmount = FHE.fromExternal(amount, inputProof);

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], transferAmount);
        _balances[recipient] = FHE.add(_balances[recipient], transferAmount);

        // ✅ Grant permissions to both parties
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allowThis(_balances[recipient]);
        FHE.allow(_balances[recipient], recipient);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 6: Cross-Contract Permission Delegation
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Call another contract without granting permission
     * @dev Other contract can't use the encrypted value
     */
    function wrongCrossContractCall(address processor) external returns (bool) {
        // ❌ processor contract has no permission to use _secretValue!
        // This call will fail or return garbage
        (bool success, ) = processor.call(
            abi.encodeWithSignature("process(uint256)", _secretValue)
        );
        return success;
    }

    /**
     * ✅ CORRECT: Grant temporary permission before cross-contract call
     * @dev Use allowTransient for gas-efficient temporary access
     */
    function correctCrossContractCall(
        address processor
    ) external returns (bool) {
        // ✅ Grant temporary permission (expires at end of transaction)
        FHE.allowTransient(_secretValue, processor);

        // Now processor can use _secretValue in this transaction
        (bool success, ) = processor.call(
            abi.encodeWithSignature("process(uint256)", _secretValue)
        );

        return success;
    }

    /// @notice Helper to get balance for testing
    function getBalance(address user) external view returns (euint32) {
        return _balances[user];
    }
}

```

{% endtab %}

{% tab title="Permissions.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import {
  FHEPermissionsAntiPatterns,
  FHEPermissionsAntiPatterns__factory,
} from "../types";

/** Common signers interface */
interface Signers {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
}

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEPermissionsAntiPatterns"
  )) as FHEPermissionsAntiPatterns__factory;
  const contract = (await factory.deploy()) as FHEPermissionsAntiPatterns;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * FHE Permission Anti-Pattern Tests
 *
 * Tests common mistakes in FHEVM permission management.
 * Validates the necessity of FHE.allowThis and correct permission propagation to users.
 */
describe("FHEPermissionsAntiPatterns", function () {
  let contract: FHEPermissionsAntiPatterns;
  let contractAddress: string;
  let signers: Signers;
  let bob: HardhatEthersSigner;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
    bob = ethSigners[2];
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.contractAddress;
    contract = deployment.contract;
  });

  describe("Pattern 1: Missing allowThis", function () {
    const testValue = 42;

    it("should FAIL without allowThis", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      // ❌ Missing Contract Permission:
      // Even if the input is valid, if the contract doesn't call `FHE.allowThis`,
      // it cannot access the result of its own encrypted computations later.
      const encrypted = await contract.getValue();
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        )
      ).to.be.rejected;
    });

    it("should succeed with allowThis", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctWithAllowThis(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      expect(decrypted).to.equal(testValue * 2);
    });
  });

  describe("Pattern 2: Missing allow(user)", function () {
    const testValue = 100;

    it("should FAIL without user allow", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .wrongMissingUserAllow(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        )
      ).to.be.rejected;
    });

    it("should succeed with user allow", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctWithUserAllow(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      expect(decrypted).to.equal(testValue);
    });
  });

  describe("Pattern 3: View Function Without Permissions", function () {
    const testValue = 200;

    it("should FAIL when stored without permission", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .wrongStoreWithoutPermission(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        )
      ).to.be.rejected;
    });

    it("should succeed when stored with permission", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(testValue)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctStoreWithPermission(input.handles[0], input.inputProof);

      const encrypted = await contract.getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      expect(decrypted).to.equal(testValue);
    });
  });

  describe("Pattern 4: Unauthenticated Re-encryption", function () {
    it("wrongReencryptWithoutAuth should return empty bytes", async function () {
      const dummyPublicKey =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
      const result = await contract.wrongReencryptWithoutAuth(dummyPublicKey);
      expect(result).to.equal("0x");
    });

    it("correctReencryptWithAuth should return encrypted handle", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(123)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctWithUserAllow(input.handles[0], input.inputProof);

      const encrypted = await contract.correctReencryptWithAuth();
      expect(encrypted).to.not.equal(0);
    });
  });

  describe("Pattern 5: Transfer Without Permission", function () {
    const initialBalance = 1000;
    const transferAmount = 100;

    beforeEach(async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Initialize Alice's balance
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(initialBalance)
        .encrypt();

      await contract
        .connect(signers.alice)
        .initializeBalance(input.handles[0], input.inputProof);
    });

    it("should FAIL recipient decryption without permission", async function () {
      // ❌ Missing Recipient Permission:
      // When transferring encrypted data (like a balance), you must explicitly
      // grant permission to the recipient using `FHE.allow`, otherwise they
      // won't be able to decrypt and see their new balance.
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(transferAmount)
        .encrypt();

      await contract
        .connect(signers.alice)
        .wrongTransferWithoutPermission(
          bob.address,
          input.handles[0],
          input.inputProof
        );

      // Bob cannot decrypt his balance
      const encrypted = await contract.getBalance(bob.address);
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          bob
        )
      ).to.be.rejected;
    });

    it("should succeed with permission propagation", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(transferAmount)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctTransferWithPermission(
          bob.address,
          input.handles[0],
          input.inputProof
        );

      // Bob can decrypt his balance
      const encrypted = await contract.getBalance(bob.address);
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        bob
      );

      expect(decrypted).to.equal(transferAmount);
    });
  });

  describe("Pattern 6: Cross-Contract Permission", function () {
    beforeEach(async function () {
      // Initialize _secretValue so the contract has permission on it
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(42)
        .encrypt();

      await contract
        .connect(signers.alice)
        .correctWithAllowThis(input.handles[0], input.inputProof);
    });

    it("wrongCrossContractCall should call without permission", async function () {
      const dummyAddress = "0x0000000000000000000000000000000000000001";
      // This will fail but we're just testing it doesn't revert
      await contract.wrongCrossContractCall(dummyAddress);
    });

    it("correctCrossContractCall should grant allowTransient", async function () {
      // 🛡️ Cross-Contract Permission:
      // When one contract passes an encrypted handle to another, it must use
      // `FHE.allowTransient` to give the target contract temporary access.
      const dummyAddress = "0x0000000000000000000000000000000000000001";
      // This should succeed - contract has permission on _secretValue
      await contract.correctCrossContractCall(dummyAddress);
    });
  });
});

```

{% endtab %}

{% endtabs %}
