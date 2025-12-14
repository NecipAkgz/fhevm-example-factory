/**
 * Shared constants for the CLI
 */
// =============================================================================
// Category Display
// =============================================================================
/**
 * Simple folder icon for all categories
 */
export const CATEGORY_ICON = "📁";
/**
 * Display order for example categories in the interactive prompt
 */
export const CATEGORY_ORDER = [
    "Basic",
    "Basic - Encryption",
    "Basic - Decryption",
    "Basic - FHE Operations",
    "Concepts",
    "Gaming",
    "Openzeppelin",
    "Advanced",
];
// =============================================================================
// Template Content
// =============================================================================
/**
 * Content for test/types.ts file
 */
export const TEST_TYPES_CONTENT = `import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Common signers interface used across test files
 */
export interface Signers {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
}
`;
//# sourceMappingURL=constants.js.map