Control flow anti-patterns in FHE development. Demonstrates mistakes with conditional logic and loops on encrypted values, providing correct vs incorrect implementations.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (13 items)</summary>

**Types:** `ebool` · `euint32` · `externalEuint32`

**Functions:**
- `FHE.add()` - Homomorphic addition: result = a + b (overflow wraps)
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.asEuint32()` - Encrypts a plaintext uint32 value into euint32
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.ge()` - Encrypted greater-or-equal: returns ebool(a >= b)
- `FHE.gt()` - Encrypted greater-than: returns ebool(a > b)
- `FHE.lt()` - Encrypted less-than: returns ebool(a < b)
- `FHE.select()` - Encrypted if-then-else: select(cond, a, b) → returns a if true, b if false
- `FHE.sub()` - Homomorphic subtraction: result = a - b (underflow wraps)

</details>

{% tabs %}

{% tab title="FHEControlFlowAntiPatterns.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint32,
    ebool,
    externalEuint32
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Control flow anti-patterns in FHE development.
 *         Demonstrates mistakes with conditional logic and loops on encrypted
 *         values, providing correct vs incorrect implementations.
 *
 * @dev Covers if/else branching, require statements, and encrypted loops.
 */
contract FHEControlFlowAntiPatterns is ZamaEthereumConfig {
    euint32 private _secretBalance;
    euint32 private _threshold;
    ebool private _validationResult;

    /// @notice Initialize contract with encrypted balance (threshold fixed for simplicity)
    function initialize(
        externalEuint32 balance,
        bytes calldata inputProof
    ) external {
        _secretBalance = FHE.fromExternal(balance, inputProof);
        _threshold = FHE.asEuint32(100); // Fixed threshold for simpler testing

        FHE.allowThis(_secretBalance);
        FHE.allowThis(_threshold);
        FHE.allow(_secretBalance, msg.sender);
        FHE.allow(_threshold, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 1: If/Else Branching on Encrypted Values
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Using if/else with encrypted comparison
     * @dev This pattern leaks information through control flow
     */
    function wrongBranching() external returns (uint256) {
        // ❌ This would decrypt the comparison result!
        // The branch taken reveals encrypted information
        // if (decrypt(_secretBalance > _threshold)) {
        //     return 1;
        // }
        // return 0;

        // Placeholder to make function compile
        return 0;
    }

    /**
     * ✅ CORRECT: Use FHE.select for conditional logic
     * @dev All computation stays encrypted
     */
    function correctConditional() external {
        ebool isAboveThreshold = FHE.gt(_secretBalance, _threshold);

        // Apply penalty if above threshold, otherwise keep balance
        euint32 penaltyAmount = FHE.asEuint32(10);
        euint32 balanceMinusPenalty = FHE.sub(_secretBalance, penaltyAmount);

        _secretBalance = FHE.select(
            isAboveThreshold,
            balanceMinusPenalty,
            _secretBalance
        );

        FHE.allowThis(_secretBalance);
        FHE.allow(_secretBalance, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 2: Require/Revert with Encrypted Conditions
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Cannot use require with encrypted boolean
     * @dev This doesn't compile - ebool cannot be used in require
     */
    function wrongRequire() external pure returns (string memory) {
        // ❌ COMPILE ERROR: require expects bool, not ebool
        // ebool hasEnough = FHE.ge(_secretBalance, FHE.asEuint32(100));
        // require(hasEnough, "Insufficient balance");

        return "This pattern doesn't work with encrypted values";
    }

    /**
     * ✅ CORRECT: Store encrypted boolean for client to check
     * @dev Let the client decrypt via getter and handle validation
     */
    function correctValidation() external {
        ebool hasEnough = FHE.ge(_secretBalance, FHE.asEuint32(100));

        _validationResult = hasEnough;
        FHE.allowThis(_validationResult);
        FHE.allow(_validationResult, msg.sender);
    }

    /// @notice Get validation result
    function getValidationResult() external view returns (ebool) {
        return _validationResult;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 3: Encrypted Loop Iterations
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Loop count based on encrypted value
     * @dev Gas consumption reveals the loop count
     */
    function wrongEncryptedLoop() external pure returns (string memory) {
        // ❌ GAS LEAK: Number of iterations visible through gas cost!
        // for (uint i = 0; i < decrypt(_secretBalance); i++) {
        //     // Each iteration costs gas
        // }

        return "Loop iterations leak through gas consumption";
    }

    /**
     * ✅ CORRECT: Fixed iterations with FHE.select
     * @dev Always loop maximum times, conditionally apply operations
     */
    function correctFixedIterations() external {
        uint256 MAX_ITERATIONS = 5;
        euint32 result = FHE.asEuint32(0);

        for (uint256 i = 0; i < MAX_ITERATIONS; i++) {
            // Check if we should add (i < _secretBalance)
            ebool shouldAdd = FHE.lt(FHE.asEuint32(uint32(i)), _secretBalance);

            // Add 1 if condition true, 0 otherwise
            euint32 toAdd = FHE.select(
                shouldAdd,
                FHE.asEuint32(1),
                FHE.asEuint32(0)
            );
            result = FHE.add(result, toAdd);
        }

        FHE.allowThis(result);
        FHE.allow(result, msg.sender);
    }

    /// @notice Helper to get balance for testing
    function getBalance() external view returns (euint32) {
        return _secretBalance;
    }
}

```

{% endtab %}

{% tab title="ControlFlow.ts" %}

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
  FHEControlFlowAntiPatterns,
  FHEControlFlowAntiPatterns__factory,
} from "../types";
import type { Signers } from "./types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHEControlFlowAntiPatterns"
  )) as FHEControlFlowAntiPatterns__factory;
  const contract = (await factory.deploy()) as FHEControlFlowAntiPatterns;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * FHE Control Flow Anti-Pattern Tests
 *
 * Tests the limitations of using encrypted variables in standard EVM control flow.
 * Validates proper use of FHE.select for conditional logic instead of branching.
 */
describe("FHEControlFlowAntiPatterns", function () {
  let contract: FHEControlFlowAntiPatterns;
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

    // Initialize contract with test values
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // Create encrypted input for balance only (threshold is fixed at 100)
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(50) // balance
      .encrypt();

    await contract
      .connect(signers.alice)
      .initialize(input.handles[0], input.inputProof);
  });

  describe("Pattern 1: If/Else Branching", function () {
    it("should execute correctConditional without leaking information", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // ✅ Correct Pattern:
      // Use `FHE.select` to perform conditional logic. The contract executes
      // both "branches" mathematically, and the result is chosen based on the encrypted boolean.
      await contract.connect(signers.alice).correctConditional();

      const encrypted = await contract.getBalance();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice
      );

      // Balance (50) is not above threshold (100), so no penalty applied
      expect(decrypted).to.equal(50);
    });

    it("wrongBranching should return placeholder value", async function () {
      const result = await contract.wrongBranching.staticCall();
      expect(result).to.equal(0);
    });
  });

  describe("Pattern 2: Require/Revert", function () {
    it("should return encrypted boolean for validation", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Execute validation (stores result)
      await contract.connect(signers.alice).correctValidation();

      // Get result via getter
      const encrypted = await contract.getValidationResult();
      const decrypted = await fhevm.userDecryptEbool(
        encrypted,
        contractAddress,
        signers.alice
      );

      // Balance (50) < 100, so should be false
      expect(decrypted).to.equal(false);
    });

    it("wrongRequire should return explanation string", async function () {
      // ❌ Antipattern: `require(encryptedCondition)`
      // This will always fail or behave unexpectedly because the EVM
      // cannot evaluate an encrypted boolean handle as a truthy/falsy value.
      const result = await contract.wrongRequire();
      expect(result).to.include("doesn't work with encrypted values");
    });
  });

  describe("Pattern 3: Encrypted Loop Iterations", function () {
    it("should use fixed iterations with FHE.select", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      await contract.connect(signers.alice).correctFixedIterations();

      // Result should count up to min(balance, MAX_ITERATIONS)
      // Balance is 50, MAX_ITERATIONS is 5, so result should be 5
    });

    it("wrongEncryptedLoop should return explanation string", async function () {
      // ❌ Antipattern: Loops with encrypted exit conditions.
      // Loops must have plaintext boundaries to avoid leaking sensitive information
      // through the number of iterations (which is visible to everyone).
      const result = await contract.wrongEncryptedLoop();
      expect(result).to.include("Loop iterations leak");
    });
  });
});

```

{% endtab %}

{% endtabs %}
