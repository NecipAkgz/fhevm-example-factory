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
      "Confidential counter implementation using FHEVM, compared with a standard counter to highlight encryption benefits.",
    category: "Basic",
    docsOutput: "docs/fhe-counter.md",
    title: "FHE Counter",
  },
  "encrypt-single-value": {
    contract: "contracts/basic/encrypt/EncryptSingleValue.sol",
    test: "test/basic/encrypt/EncryptSingleValue.ts",
    description:
      "FHE encryption mechanism with single values, including common pitfalls and best practices for developers.",
    category: "Basic - Encryption",
    docsOutput: "docs/fhe-encrypt-single-value.md",
    title: "Encrypt Single Value",
  },
  "encrypt-multiple-values": {
    contract: "contracts/basic/encrypt/EncryptMultipleValues.sol",
    test: "test/basic/encrypt/EncryptMultipleValues.ts",
    description:
      "Encrypting and handling multiple values in a single transaction efficiently.",
    category: "Basic - Encryption",
    docsOutput: "docs/fhe-encrypt-multiple-values.md",
    title: "Encrypt Multiple Values",
  },
  "user-decrypt-single-value": {
    contract: "contracts/basic/decrypt/UserDecryptSingleValue.sol",
    test: "test/basic/decrypt/UserDecryptSingleValue.ts",
    description:
      "FHE user decryption mechanism for single values, with common pitfalls and correct implementation patterns.",
    category: "Basic - Decryption",
    docsOutput: "docs/fhe-user-decrypt-single-value.md",
    title: "User Decrypt Single Value",
  },
  "user-decrypt-multiple-values": {
    contract: "contracts/basic/decrypt/UserDecryptMultipleValues.sol",
    test: "test/basic/decrypt/UserDecryptMultipleValues.ts",
    description:
      "Decrypting multiple encrypted values for a user in a single operation.",
    category: "Basic - Decryption",
    docsOutput: "docs/fhe-user-decrypt-multiple-values.md",
    title: "User Decrypt Multiple Values",
  },
  "public-decrypt-single-value": {
    contract: "contracts/basic/decrypt/PublicDecryptSingleValue.sol",
    test: "test/basic/decrypt/PublicDecryptSingleValue.ts",
    description:
      "Publicly decrypting a single encrypted value on-chain for transparent results.",
    category: "Basic - Decryption",
    docsOutput: "docs/fhe-public-decrypt-single-value.md",
    title: "Public Decrypt Single Value",
  },
  "public-decrypt-multiple-values": {
    contract: "contracts/basic/decrypt/PublicDecryptMultipleValues.sol",
    test: "test/basic/decrypt/PublicDecryptMultipleValues.ts",
    description:
      "Publicly decrypting multiple encrypted values in a single transaction for batch transparency.",
    category: "Basic - Decryption",
    docsOutput: "docs/fhe-public-decrypt-multiple-values.md",
    title: "Public Decrypt Multiple Values",
  },
  "fhe-add": {
    contract: "contracts/basic/fhe-operations/FHEAdd.sol",
    test: "test/basic/fhe-operations/FHEAdd.ts",
    description:
      "Addition operations on encrypted values using FHE.add() for homomorphic computation.",
    category: "FHE Operations",
    docsOutput: "docs/fhe-add.md",
    title: "FHE Add Operation",
  },
  "fhe-if-then-else": {
    contract: "contracts/basic/fhe-operations/FHEIfThenElse.sol",
    test: "test/basic/fhe-operations/FHEIfThenElse.ts",
    description:
      "Conditional operations on encrypted values using FHE.select() for encrypted branching logic.",
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
      "Confidential token (ERC7984) with mint/burn functionality using OpenZeppelin's library powered by ZAMA's FHEVM.",
    category: "OpenZeppelin",
    docsOutput: "docs/openzeppelin/erc7984.md",
    title: "ERC7984 Tutorial",
  },
  "erc7984-erc20-wrapper": {
    contract: "contracts/openzeppelin/ERC7984ERC20Wrapper.sol",
    test: "test/openzeppelin/ERC7984ERC20Wrapper.ts",
    description:
      "Wrapping standard ERC20 tokens into confidential ERC7984 tokens to enable privacy for any existing ERC20.",
    category: "OpenZeppelin",
    docsOutput: "docs/openzeppelin/erc7984-erc20-wrapper.md",
    title: "ERC7984 to ERC20 Wrapper",
  },
  "swap-erc7984-to-erc20": {
    contract: "contracts/openzeppelin/SwapERC7984ToERC20.sol",
    test: "test/openzeppelin/SwapERC7984ToERC20.ts",
    description:
      "Swapping between confidential ERC7984 and ERC20 tokens using the new v0.9 decryption API (makePubliclyDecryptable + checkSignatures).",
    category: "OpenZeppelin",
    docsOutput: "docs/openzeppelin/swap-erc7984-to-erc20.md",
    title: "Swap ERC7984 to ERC20",
  },
  "swap-erc7984-to-erc7984": {
    contract: "contracts/openzeppelin/SwapERC7984ToERC7984.sol",
    test: "test/openzeppelin/SwapERC7984ToERC7984.ts",
    description:
      "Fully confidential atomic swap between two ERC7984 tokens where both input and output amounts remain encrypted.",
    category: "OpenZeppelin",
    docsOutput: "docs/openzeppelin/swap-erc7984-to-erc7984.md",
    title: "Swap ERC7984 to ERC7984",
  },
  "vesting-wallet": {
    contract: "contracts/openzeppelin/VestingWallet.sol",
    test: "test/openzeppelin/VestingWallet.ts",
    description:
      "Linear vesting wallet for ERC7984 tokens where vested amounts remain encrypted for privacy.",
    category: "OpenZeppelin",
    docsOutput: "docs/openzeppelin/vesting-wallet.md",
    title: "Vesting Wallet",
  },

  // Advanced Examples
  "blind-auction": {
    contract: "contracts/advanced/BlindAuction.sol",
    test: "test/advanced/BlindAuction.ts",
    description:
      "Encrypted blind auction where bids remain confidential. Uses FHE.gt() and FHE.select() to find the winner without revealing losing bids. Only the winning price is decrypted.",
    category: "Advanced",
    docsOutput: "docs/advanced/blind-auction.md",
    title: "Blind Auction",
  },
  "hidden-voting": {
    contract: "contracts/advanced/HiddenVoting.sol",
    test: "test/advanced/HiddenVoting.ts",
    description:
      "Encrypted voting mechanism with homomorphic tallying. Individual votes remain private forever while final counts are revealed using FHE.makePubliclyDecryptable().",
    category: "Advanced",
    docsOutput: "docs/advanced/hidden-voting.md",
    title: "Hidden Voting",
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
  advanced: {
    name: "Advanced Examples",
    description:
      "Complex FHE applications: blind auctions, encrypted voting systems",
    contracts: [
      {
        sol: "contracts/advanced/BlindAuction.sol",
        test: "test/advanced/BlindAuction.ts",
      },
      {
        sol: "contracts/advanced/HiddenVoting.sol",
        test: "test/advanced/HiddenVoting.ts",
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
