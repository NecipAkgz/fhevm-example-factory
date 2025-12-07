/**
 * Shared configuration for all FHEVM Example Factory scripts
 *
 * This module contains all example and category configurations used by:
 * - cli.ts
 * - create-fhevm-example.ts
 * - create-fhevm-category.ts
 * - generate-docs.ts
 */

// =============================================================================
// Types
// =============================================================================

export interface ExampleConfig {
  /** Path to the Solidity contract file */
  contract: string;
  /** Path to the TypeScript test file */
  test: string;
  /** Optional path to test fixture file */
  testFixture?: string;
  /** Full description for documentation */
  description: string;
  /** Category for grouping */
  category: string;
  /** Output path for generated documentation */
  docsOutput: string;
  /** Title for documentation */
  title: string;
}

export interface CategoryConfig {
  /** Display name */
  name: string;
  /** Description of the category */
  description: string;
  /** List of contracts in this category */
  contracts: Array<{ sol: string; test?: string }>;
}

// =============================================================================
// Example Configurations
// =============================================================================

export const EXAMPLES: Record<string, ExampleConfig> = {
  "fhe-counter": {
    contract: "contracts/basic/FHECounter.sol",
    test: "test/basic/FHECounter.ts",
    description:
      "This example demonstrates how to build a confidential counter using FHEVM, in comparison to a simple counter.",
    category: "Basic",
    docsOutput: "docs/fhe-counter.md",
    title: "FHE Counter",
  },
  "encrypt-single-value": {
    contract: "contracts/basic/encrypt/EncryptSingleValue.sol",
    test: "test/basic/encrypt/EncryptSingleValue.ts",
    description:
      "This example demonstrates the FHE encryption mechanism and highlights a common pitfall developers may encounter.",
    category: "Basic - Encryption",
    docsOutput: "docs/fhe-encrypt-single-value.md",
    title: "Encrypt Single Value",
  },
  "encrypt-multiple-values": {
    contract: "contracts/basic/encrypt/EncryptMultipleValues.sol",
    test: "test/basic/encrypt/EncryptMultipleValues.ts",
    description:
      "This example shows how to encrypt and handle multiple values in a single transaction.",
    category: "Basic - Encryption",
    docsOutput: "docs/fhe-encrypt-multiple-values.md",
    title: "Encrypt Multiple Values",
  },
  "user-decrypt-single-value": {
    contract: "contracts/basic/decrypt/UserDecryptSingleValue.sol",
    test: "test/basic/decrypt/UserDecryptSingleValue.ts",
    description:
      "This example demonstrates the FHE user decryption mechanism and highlights common pitfalls developers may encounter.",
    category: "Basic - Decryption",
    docsOutput: "docs/fhe-user-decrypt-single-value.md",
    title: "User Decrypt Single Value",
  },
  "user-decrypt-multiple-values": {
    contract: "contracts/basic/decrypt/UserDecryptMultipleValues.sol",
    test: "test/basic/decrypt/UserDecryptMultipleValues.ts",
    description:
      "This example shows how to decrypt multiple encrypted values for a user.",
    category: "Basic - Decryption",
    docsOutput: "docs/fhe-user-decrypt-multiple-values.md",
    title: "User Decrypt Multiple Values",
  },
  "public-decrypt-single-value": {
    contract: "contracts/basic/decrypt/PublicDecryptSingleValue.sol",
    test: "test/basic/decrypt/PublicDecryptSingleValue.ts",
    description:
      "This example demonstrates how to publicly decrypt a single encrypted value on-chain.",
    category: "Basic - Decryption",
    docsOutput: "docs/fhe-public-decrypt-single-value.md",
    title: "Public Decrypt Single Value",
  },
  "public-decrypt-multiple-values": {
    contract: "contracts/basic/decrypt/PublicDecryptMultipleValues.sol",
    test: "test/basic/decrypt/PublicDecryptMultipleValues.ts",
    description:
      "This example shows how to publicly decrypt multiple encrypted values in a single transaction.",
    category: "Basic - Decryption",
    docsOutput: "docs/fhe-public-decrypt-multiple-values.md",
    title: "Public Decrypt Multiple Values",
  },
  "fhe-add": {
    contract: "contracts/basic/fhe-operations/FHEAdd.sol",
    test: "test/basic/fhe-operations/FHEAdd.ts",
    description:
      "This example demonstrates how to perform addition operations on encrypted values.",
    category: "FHE Operations",
    docsOutput: "docs/fhe-add.md",
    title: "FHE Add Operation",
  },
  "fhe-if-then-else": {
    contract: "contracts/basic/fhe-operations/FHEIfThenElse.sol",
    test: "test/basic/fhe-operations/FHEIfThenElse.ts",
    description:
      "This example shows conditional operations on encrypted values using FHE.",
    category: "FHE Operations",
    docsOutput: "docs/fhe-if-then-else.md",
    title: "FHE If-Then-Else",
  },
  "fhe-arithmetic": {
    contract: "contracts/basic/fhe-operations/FHEArithmetic.sol",
    test: "test/basic/fhe-operations/FHEArithmetic.ts",
    description:
      "Comprehensive example demonstrating all FHE arithmetic operations: add, sub, mul, div, rem, min, max.",
    category: "FHE Operations",
    docsOutput: "docs/fhe-arithmetic.md",
    title: "FHE Arithmetic Operations",
  },
  "fhe-comparison": {
    contract: "contracts/basic/fhe-operations/FHEComparison.sol",
    test: "test/basic/fhe-operations/FHEComparison.ts",
    description:
      "Demonstrates all FHE comparison operations: eq, ne, gt, lt, ge, le, and the select function for encrypted conditionals.",
    category: "FHE Operations",
    docsOutput: "docs/fhe-comparison.md",
    title: "FHE Comparison Operations",
  },
  "fhe-access-control": {
    contract: "contracts/concepts/FHEAccessControl.sol",
    test: "test/concepts/FHEAccessControl.ts",
    description:
      "Critical access control patterns in FHEVM: FHE.allow, FHE.allowThis, FHE.allowTransient. Includes common mistakes and correct implementations.",
    category: "Concepts",
    docsOutput: "docs/fhe-access-control.md",
    title: "FHE Access Control",
  },
  "fhe-input-proof": {
    contract: "contracts/concepts/FHEInputProof.sol",
    test: "test/concepts/FHEInputProof.ts",
    description:
      "Explains input proof validation in FHEVM: what proofs are, why they are needed, and how to use them correctly with single and batched inputs.",
    category: "Concepts",
    docsOutput: "docs/fhe-input-proof.md",
    title: "FHE Input Proofs",
  },
  "fhe-handles": {
    contract: "contracts/concepts/FHEHandles.sol",
    test: "test/concepts/FHEHandles.ts",
    description:
      "Understanding FHE handles: creation, computation, immutability, and symbolic execution in mock mode.",
    category: "Concepts",
    docsOutput: "docs/fhe-handles.md",
    title: "FHE Handles & Lifecycle",
  },
  "fhe-anti-patterns": {
    contract: "contracts/concepts/FHEAntiPatterns.sol",
    test: "test/concepts/FHEAntiPatterns.ts",
    description:
      "Common FHE mistakes and their correct alternatives. Covers: branching, permissions, require/revert, re-encryption, loops, noise, and deprecated APIs.",
    category: "Concepts",
    docsOutput: "docs/fhe-anti-patterns.md",
    title: "FHE Anti-Patterns",
  },

  // OpenZeppelin Confidential Contracts
  erc7984: {
    contract: "contracts/openzeppelin/ERC7984.sol",
    test: "test/openzeppelin/ERC7984.ts",
    description:
      "This example demonstrates how to create a confidential token (ERC7984) using OpenZeppelin's smart contract library powered by ZAMA's FHEVM. It shows how to extend the ERC7984 base contract with mint/burn functionality.",
    category: "OpenZeppelin",
    docsOutput: "docs/openzeppelin/erc7984.md",
    title: "ERC7984 Tutorial",
  },
  "erc7984-erc20-wrapper": {
    contract: "contracts/openzeppelin/ERC7984ERC20Wrapper.sol",
    test: "test/openzeppelin/ERC7984ERC20Wrapper.ts",
    description:
      "This example demonstrates how to wrap a standard ERC20 token into a confidential ERC7984 token using OpenZeppelin's smart contract library powered by ZAMA's FHEVM. It enables privacy for any existing ERC20.",
    category: "OpenZeppelin",
    docsOutput: "docs/openzeppelin/erc7984-erc20-wrapper.md",
    title: "ERC7984 to ERC20 Wrapper",
  },
  "swap-erc7984-to-erc20": {
    contract: "contracts/openzeppelin/SwapERC7984ToERC20.sol",
    test: "test/openzeppelin/SwapERC7984ToERC20.ts",
    description:
      "This example demonstrates how to swap between a confidential token (ERC7984) and ERC20 tokens using OpenZeppelin's smart contract library powered by ZAMA's FHEVM. It uses the new v0.9 decryption API (makePubliclyDecryptable + checkSignatures).",
    category: "OpenZeppelin",
    docsOutput: "docs/openzeppelin/swap-erc7984-to-erc20.md",
    title: "Swap ERC7984 to ERC20",
  },
  "swap-erc7984-to-erc7984": {
    contract: "contracts/openzeppelin/SwapERC7984ToERC7984.sol",
    test: "test/openzeppelin/SwapERC7984ToERC7984.ts",
    description:
      "This example demonstrates how to perform a fully confidential atomic swap between two ERC7984 tokens using OpenZeppelin's smart contract library powered by ZAMA's FHEVM. Both input and output amounts remain encrypted.",
    category: "OpenZeppelin",
    docsOutput: "docs/openzeppelin/swap-erc7984-to-erc7984.md",
    title: "Swap ERC7984 to ERC7984",
  },
  "vesting-wallet": {
    contract: "contracts/openzeppelin/VestingWallet.sol",
    test: "test/openzeppelin/VestingWallet.ts",
    description:
      "This example demonstrates how to create a linear vesting wallet for ERC7984 tokens using OpenZeppelin's smart contract library powered by ZAMA's FHEVM. Vested amounts remain encrypted for privacy.",
    category: "OpenZeppelin",
    docsOutput: "docs/openzeppelin/vesting-wallet.md",
    title: "Vesting Wallet",
  },
};

// =============================================================================
// Category Configurations
// =============================================================================

export const CATEGORIES: Record<string, CategoryConfig> = {
  basic: {
    name: "Basic FHEVM Examples",
    description:
      "Fundamental FHEVM operations including encryption, decryption, and basic FHE operations",
    contracts: [
      {
        sol: "contracts/basic/FHECounter.sol",
        test: "test/basic/FHECounter.ts",
      },
      {
        sol: "contracts/basic/encrypt/EncryptSingleValue.sol",
        test: "test/basic/encrypt/EncryptSingleValue.ts",
      },
      {
        sol: "contracts/basic/encrypt/EncryptMultipleValues.sol",
        test: "test/basic/encrypt/EncryptMultipleValues.ts",
      },
      {
        sol: "contracts/basic/decrypt/UserDecryptSingleValue.sol",
        test: "test/basic/decrypt/UserDecryptSingleValue.ts",
      },
      {
        sol: "contracts/basic/decrypt/UserDecryptMultipleValues.sol",
        test: "test/basic/decrypt/UserDecryptMultipleValues.ts",
      },
      {
        sol: "contracts/basic/decrypt/PublicDecryptSingleValue.sol",
        test: "test/basic/decrypt/PublicDecryptSingleValue.ts",
      },
      {
        sol: "contracts/basic/decrypt/PublicDecryptMultipleValues.sol",
        test: "test/basic/decrypt/PublicDecryptMultipleValues.ts",
      },
      {
        sol: "contracts/basic/fhe-operations/FHEAdd.sol",
        test: "test/basic/fhe-operations/FHEAdd.ts",
      },
      {
        sol: "contracts/basic/fhe-operations/FHEIfThenElse.sol",
        test: "test/basic/fhe-operations/FHEIfThenElse.ts",
      },
    ],
  },
  concepts: {
    name: "Critical Concepts",
    description: "Access control, input proofs, handles, and anti-patterns",
    contracts: [
      {
        sol: "contracts/concepts/FHEAccessControl.sol",
        test: "test/concepts/FHEAccessControl.ts",
      },
      {
        sol: "contracts/concepts/FHEInputProof.sol",
        test: "test/concepts/FHEInputProof.ts",
      },
      {
        sol: "contracts/concepts/FHEHandles.sol",
        test: "test/concepts/FHEHandles.ts",
      },
      {
        sol: "contracts/concepts/FHEAntiPatterns.sol",
        test: "test/concepts/FHEAntiPatterns.ts",
      },
    ],
  },
  operations: {
    name: "FHE Operations",
    description: "Arithmetic, comparison, and conditional operations",
    contracts: [
      {
        sol: "contracts/basic/fhe-operations/FHEAdd.sol",
        test: "test/basic/fhe-operations/FHEAdd.ts",
      },
      {
        sol: "contracts/basic/fhe-operations/FHEArithmetic.sol",
        test: "test/basic/fhe-operations/FHEArithmetic.ts",
      },
      {
        sol: "contracts/basic/fhe-operations/FHEComparison.sol",
        test: "test/basic/fhe-operations/FHEComparison.ts",
      },
      {
        sol: "contracts/basic/fhe-operations/FHEIfThenElse.sol",
        test: "test/basic/fhe-operations/FHEIfThenElse.ts",
      },
    ],
  },
  openzeppelin: {
    name: "OpenZeppelin Confidential Contracts",
    description:
      "ERC7984 confidential token standard, wrappers, swaps, and vesting",
    contracts: [
      {
        sol: "contracts/openzeppelin/ERC7984.sol",
        test: "test/openzeppelin/ERC7984.ts",
      },
      {
        sol: "contracts/openzeppelin/ERC7984ERC20Wrapper.sol",
        test: "test/openzeppelin/ERC7984ERC20Wrapper.ts",
      },
      {
        sol: "contracts/openzeppelin/SwapERC7984ToERC20.sol",
        test: "test/openzeppelin/SwapERC7984ToERC20.ts",
      },
      {
        sol: "contracts/openzeppelin/SwapERC7984ToERC7984.sol",
        test: "test/openzeppelin/SwapERC7984ToERC7984.ts",
      },
      {
        sol: "contracts/openzeppelin/VestingWallet.sol",
        test: "test/openzeppelin/VestingWallet.ts",
      },
    ],
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get list of example names
 */
export function getExampleNames(): string[] {
  return Object.keys(EXAMPLES);
}

/**
 * Get list of category names
 */
export function getCategoryNames(): string[] {
  return Object.keys(CATEGORIES);
}

/**
 * Get example by name
 */
export function getExample(name: string): ExampleConfig | undefined {
  return EXAMPLES[name];
}

/**
 * Get category by name
 */
export function getCategory(name: string): CategoryConfig | undefined {
  return CATEGORIES[name];
}

/**
 * Generate consistent docs filename with fhe- prefix
 */
export function getDocsFileName(exampleName: string): string {
  return exampleName.startsWith("fhe-") ? exampleName : `fhe-${exampleName}`;
}
