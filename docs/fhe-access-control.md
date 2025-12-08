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
 * Demonstrates FHE access control - the most critical concept in FHEVM
 *
 * @dev Key functions:
 *      FHE.allow(handle, address) - permanent permission
 *      FHE.allowThis(handle)      - permission for contract itself
 *      FHE.allowTransient(handle, address) - temporary, expires at tx end
 */
contract FHEAccessControl is ZamaEthereumConfig {
    euint32 private _secretValue;
    mapping(address => bool) public hasAccess;

    constructor() {}

    // ==================== CORRECT PATTERN ====================

    /// ✅ CORRECT: Full access pattern for user decryption
    function storeWithFullAccess(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ⚠️ CRITICAL: BOTH are required for user decryption!
        FHE.allowThis(_secretValue); // Contract can operate on it
        FHE.allow(_secretValue, msg.sender); // User can decrypt it

        // ❓ Why allowThis is needed for user decryption?
        // User decryption = re-encryption for user's key
        // This requires contract's permission to "release" the value

        hasAccess[msg.sender] = true;
    }

    /// Grant access to additional users
    function grantAccess(address user) external {
        require(hasAccess[msg.sender], "Caller has no access to grant");

        // ✅ Works because contract has allowThis permission
        FHE.allow(_secretValue, user);
        hasAccess[user] = true;
    }

    function getSecretValue() external view returns (euint32) {
        return _secretValue;
    }

    // ==================== WRONG PATTERNS (EDUCATIONAL) ====================

    /// ❌ WRONG: Missing allowThis → user decryption FAILS
    function storeWithoutAllowThis(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Missing: FHE.allowThis(_secretValue)
        // User has permission, but decryption will FAIL!
        FHE.allow(_secretValue, msg.sender);
    }

    /// ❌ WRONG: Missing allow(user) → no one can decrypt
    function storeWithoutUserAllow(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        FHE.allowThis(_secretValue);
        // ❌ Missing: FHE.allow(_secretValue, msg.sender)
        // Contract can operate, but no one can decrypt!
    }

    // ==================== TRANSIENT ACCESS ====================

    /// Temporary access - expires at end of transaction
    /// @dev Use for: passing values between contracts in same tx
    function computeAndShareTransient(
        address recipient
    ) external returns (euint32) {
        euint32 computed = FHE.add(_secretValue, FHE.asEuint32(1));

        // 💨 Transient = cheaper than permanent, auto-expires
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
