Critical access control patterns in FHEVM: FHE.allow, FHE.allowThis, FHE.allowTransient. Includes common mistakes and correct implementations.

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
- `FHE.allowTransient()` - Grants TEMPORARY permission (expires at tx end)
- `FHE.asEuint32()` - Encrypts a plaintext uint32 value into euint32
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof

</details>

{% tabs %}

{% tab title="FHEAccessControl.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Critical access control patterns in FHEVM: FHE.allow, FHE.allowThis, FHE.allowTransient with common mistakes.

 * @dev allow() = permanent, allowThis() = contract permission, allowTransient() = expires at TX end
 *      Both allowThis + allow required for user decryption!
 */
contract FHEAccessControl is ZamaEthereumConfig {
    euint32 private _secretValue;
    mapping(address => bool) public hasAccess;

    /// @notice ✅ CORRECT: Full access pattern for user decryption
    function storeWithFullAccess(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // Why BOTH allowThis + allow?
        // - allowThis: Contract authorizes "releasing" the encrypted value
        // - allow(user): User can request decryption for their key
        // Missing either = decryption fails!
        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);

        hasAccess[msg.sender] = true;
    }

    /// @notice Grant access to additional users
    function grantAccess(address user) external {
        require(hasAccess[msg.sender], "Caller has no access to grant");

        // Why this works: Contract already has allowThis from storeWithFullAccess
        // We only need to grant allow(user) for the new user
        FHE.allow(_secretValue, user);
        hasAccess[user] = true;
    }

    function getSecretValue() external view returns (euint32) {
        return _secretValue;
    }

    /// @notice ❌ WRONG: Missing allowThis → user decryption FAILS
    function storeWithoutAllowThis(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Common mistake: Only allow(user) without allowThis
        // Result: User has permission but can't decrypt!
        // Why? Decryption needs contract to authorize the release
        FHE.allow(_secretValue, msg.sender);
    }

    /// @notice ❌ WRONG: Missing allow(user) → no one can decrypt
    function storeWithoutUserAllow(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Another mistake: Only allowThis without allow(user)
        // Result: Contract can compute but no one can decrypt!
        FHE.allowThis(_secretValue);
    }

    /// @notice Temporary access - expires at end of transaction
    /// @dev ⚡ Gas: allowTransient ~50% cheaper than allow!
    ///      Use for passing values between contracts in same TX
    function computeAndShareTransient(
        address recipient
    ) external returns (euint32) {
        euint32 computed = FHE.add(_secretValue, FHE.asEuint32(1));

        // Why allowTransient instead of allow?
        // - Cheaper: ~50% less gas than permanent allow
        // - Auto-cleanup: Expires at TX end (no storage pollution)
        // - Use case: Passing values between contracts in same transaction
        FHE.allowTransient(computed, recipient);

        return computed;
    }
}

```

{% endtab %}

{% tab title="FHEAccessControl.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEAccessControl, FHEAccessControl__factory } from "../types";
import type { Signers } from "./types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEAccessControl"
  )) as FHEAccessControl__factory;
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
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      await contract
        .connect(signers.alice)
        .storeWithFullAccess(input.handles[0], input.inputProof);

      // Verify access was granted
      expect(await contract.hasAccess(signers.alice.address)).to.equal(true);

      // User should be able to decrypt
      const encrypted = await contract.getSecretValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(secretValue);
    });

    it("should allow granting access to additional users", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Alice stores the value
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      await contract
        .connect(signers.alice)
        .storeWithFullAccess(input.handles[0], input.inputProof);

      // Alice grants access to Bob
      await contract.connect(signers.alice).grantAccess(bob.address);

      // Bob can now decrypt
      const encrypted = await contract.getSecretValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        bob
      );
      expect(decrypted).to.equal(secretValue);
    });
  });

  describe("Wrong Access Control Patterns", function () {
    const secretValue = 42;

    it("should FAIL user decryption without allowThis", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store value WITHOUT allowThis (wrong pattern)
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      await contract
        .connect(signers.alice)
        .storeWithoutAllowThis(input.handles[0], input.inputProof);

      // Attempting to decrypt should fail
      const encrypted = await contract.getSecretValue();
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        )
      ).to.be.rejected;
    });

    it("should FAIL user decryption without user allow", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store value WITHOUT user allow (wrong pattern)
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(secretValue)
        .encrypt();
      await contract
        .connect(signers.alice)
        .storeWithoutUserAllow(input.handles[0], input.inputProof);

      // User (alice) cannot decrypt because no permission was granted
      const encrypted = await contract.getSecretValue();
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          encrypted,
          contractAddress,
          signers.alice
        )
      ).to.be.rejected;
    });
  });
});

```

{% endtab %}

{% endtabs %}
