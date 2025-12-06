Critical access control patterns in FHEVM: FHE.allow, FHE.allowThis, FHE.allowTransient. Includes common mistakes and correct implementations.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="FHEAccessControl.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEAccessControl
 * @notice Demonstrates FHE access control patterns - the most critical concept in FHEVM.
 *
 * @dev WHY ACCESS CONTROL MATTERS:
 * In FHEVM, encrypted values (handles) are stored on-chain but can only be decrypted
 * by authorized parties. Without proper permissions, even the contract owner cannot
 * decrypt stored values.
 *
 * KEY CONCEPTS:
 *
 * 1. FHE.allow(handle, address)
 *    - Grants PERMANENT permission to an address to decrypt a handle
 *    - Persists in storage, survives transaction end
 *    - Use for: stored values that users need to decrypt later
 *
 * 2. FHE.allowThis(handle)
 *    - Grants permission to the contract itself
 *    - REQUIRED for the contract to operate on the handle in future transactions
 *    - REQUIRED for users to perform "user decryption" (reencryption)
 *
 * 3. FHE.allowTransient(handle, address)
 *    - Grants TEMPORARY permission that expires at end of transaction
 *    - More gas efficient than permanent allow
 *    - Use for: intermediate values passed between contracts in same tx
 *
 * COMMON MISTAKE:
 * Forgetting FHE.allowThis() prevents user decryption even if FHE.allow(user) was called!
 */
contract FHEAccessControl is ZamaEthereumConfig {
    euint32 private _secretValue;

    /// @notice Mapping to track who has been granted access
    mapping(address => bool) public hasAccess;

    // solhint-disable-next-line no-empty-blocks
    constructor() {}

    // ========== CORRECT PATTERNS ==========

    /**
     * @notice CORRECT: Stores value with proper permissions for both contract and caller
     * @dev Both allowThis AND allow are needed for user decryption to work
     */
    function storeWithFullAccess(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ✅ Grant contract permission - needed for future operations AND user decryption
        FHE.allowThis(_secretValue);

        // ✅ Grant caller permission - enables them to decrypt
        FHE.allow(_secretValue, msg.sender);

        hasAccess[msg.sender] = true;
    }

    /**
     * @notice Grants access to an additional user
     * @dev Only works because contract has permission via allowThis
     */
    function grantAccess(address user) external {
        require(hasAccess[msg.sender], "Caller has no access to grant");

        // ✅ Contract can grant access because it has allowThis permission
        FHE.allow(_secretValue, user);
        hasAccess[user] = true;
    }

    /**
     * @notice Returns the encrypted value for authorized decryption
     * @dev Caller must have been granted access via allow()
     */
    function getSecretValue() external view returns (euint32) {
        return _secretValue;
    }

    // ========== WRONG PATTERNS (FOR EDUCATION) ==========

    /**
     * @notice WRONG: Missing allowThis - user decryption will FAIL
     * @dev Even though we call allow(msg.sender), user decryption requires
     *      BOTH the contract AND the user to have permissions
     */
    function storeWithoutAllowThis(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Missing FHE.allowThis(_secretValue) - user decryption will fail!
        FHE.allow(_secretValue, msg.sender);
    }

    /**
     * @notice WRONG: Missing allow(user) - user cannot decrypt
     * @dev Contract can operate on value, but no user can decrypt
     */
    function storeWithoutUserAllow(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        FHE.allowThis(_secretValue);
        // ❌ Missing FHE.allow(_secretValue, msg.sender) - no one can decrypt!
    }

    // ========== TRANSIENT ACCESS PATTERN ==========

    /**
     * @notice Demonstrates allowTransient for temporary access within a transaction
     * @dev Useful when passing encrypted values between contracts
     * @param recipient Contract or address that needs temporary access
     */
    function computeAndShareTransient(
        address recipient
    ) external returns (euint32) {
        // Perform some computation
        euint32 computed = FHE.add(_secretValue, FHE.asEuint32(1));

        // Grant temporary access - cheaper than permanent, expires after tx
        FHE.allowTransient(computed, recipient);

        return computed;
    }
}

```

{% endtab %}

{% tab title="FHEAccessControl.ts" %}

```typescript
import { FhevmType, HardhatFhevmRuntimeEnvironment } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEAccessControl, FHEAccessControl__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEAccessControl")) as FHEAccessControl__factory;
  const contract = (await factory.deploy()) as FHEAccessControl;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Tests FHE access control patterns
 * Demonstrates correct and incorrect permission handling
 */
describe("FHEAccessControl", function () {
  let contract: FHEAccessControl;
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

  describe("Correct Access Control Pattern", function () {
    const secretValue = 42;

    it("should allow user decryption with full access", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store value with proper permissions
      const input = await fhevm.createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      await contract.connect(signers.alice).storeWithFullAccess(input.handles[0], input.inputProof);

      // Verify access was granted
      expect(await contract.hasAccess(signers.alice.address)).to.equal(true);

      // User should be able to decrypt
      const encrypted = await contract.getSecretValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(secretValue);
    });

    it("should allow granting access to additional users", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Alice stores the value
      const input = await fhevm.createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      await contract.connect(signers.alice).storeWithFullAccess(input.handles[0], input.inputProof);

      // Alice grants access to Bob
      await contract.connect(signers.alice).grantAccess(bob.address);

      // Bob can now decrypt
      const encrypted = await contract.getSecretValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        bob,
      );
      expect(decrypted).to.equal(secretValue);
    });
  });

  describe("Wrong Access Control Patterns", function () {
    const secretValue = 42;

    it("should FAIL user decryption without allowThis", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store value WITHOUT allowThis (wrong pattern)
      const input = await fhevm.createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      await contract.connect(signers.alice).storeWithoutAllowThis(input.handles[0], input.inputProof);

      // Attempting to decrypt should fail
      const encrypted = await contract.getSecretValue();
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint32, encrypted, contractAddress, signers.alice)
      ).to.be.rejected;
    });

    it("should FAIL user decryption without user allow", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store value WITHOUT user allow (wrong pattern)
      const input = await fhevm.createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      await contract.connect(signers.alice).storeWithoutUserAllow(input.handles[0], input.inputProof);

      // User (alice) cannot decrypt because no permission was granted
      const encrypted = await contract.getSecretValue();
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint32, encrypted, contractAddress, signers.alice)
      ).to.be.rejected;
    });
  });
});

```

{% endtab %}

{% endtabs %}
