#!/usr/bin/env node

/**
 * Auto-Discovery Config Generator
 *
 * Scans contracts/ directory and generates config.ts automatically
 * Extracts metadata from:
 * - @notice tags in contract files
 * - Folder structure for categories
 * - Matching test files
 */

import * as fs from "fs";
import * as path from "path";

const ROOT_DIR = path.resolve(__dirname, "..");
const CONTRACTS_DIR = path.join(ROOT_DIR, "contracts");
const TEST_DIR = path.join(ROOT_DIR, "test");
const OUTPUT_FILE = path.join(ROOT_DIR, "scripts/shared/config.ts");

interface ContractInfo {
  name: string;
  contractPath: string;
  testPath: string;
  description: string;
  category: string;
  title: string;
  docsOutput: string;
}

/**
 * Extract @notice from contract file
 */
function extractNotice(contractPath: string): string | null {
  const content = fs.readFileSync(contractPath, "utf-8");

  // Match contract-level @notice (before "contract" keyword)
  const noticeRegex =
    /\/\*\*[\s\S]*?@notice\s+([^\n*]+)[\s\S]*?\*\/[\s\S]*?contract\s+\w+/;
  const match = content.match(noticeRegex);

  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

/**
 * Convert contract name to kebab-case example name
 * Handles acronyms: FHECounter → fhe-counter, ERC7984 → erc7984
 */
function contractNameToExampleName(contractName: string): string {
  return (
    contractName
      // Insert hyphen before uppercase letter that follows a lowercase letter
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      // Insert hyphen before uppercase letter that follows a number
      .replace(/([0-9])([A-Z])/g, "$1-$2")
      // Insert hyphen before a word that follows an acronym
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
      .toLowerCase()
  );
}

/**
 * Convert contract name to title
 * Handles acronyms: ERC7984 → ERC7984, FHECounter → FHE Counter
 * Complex cases: ERC7984ERC20Wrapper → ERC7984 ERC20 Wrapper
 */
function contractNameToTitle(contractName: string): string {
  return (
    contractName
      // Insert space before uppercase letter that follows a lowercase letter
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // Insert space before uppercase letter that follows a number
      .replace(/([0-9])([A-Z])/g, "$1 $2")
      // Insert space before a word that follows an acronym
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
  );
}

/**
 * Format folder name to proper category name
 * Rules:
 *   - "fhe" → "FHE" (uppercase)
 *   - "-" → " " (space) and capitalize next letter
 *   - First letter always capitalized
 * Examples:
 *   "encryption" → "Encryption"
 *   "fhe-operations" → "FHE Operations"
 *   "openzeppelin" → "Openzeppelin"
 */
function formatCategoryName(folderName: string): string {
  return (
    folderName
      // Replace "fhe" with "FHE" (case-insensitive)
      .replace(/\bfhe\b/gi, "FHE")
      // Replace hyphens with spaces
      .replace(/-/g, " ")
      // Capitalize first letter of each word
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get category from file path (convention-based)
 * Examples:
 *   contracts/basic/File.sol → "Basic"
 *   contracts/basic/encrypt/File.sol → "Basic - Encryption"
 *   contracts/advanced/File.sol → "Advanced"
 */
function getCategoryFromPath(relativePath: string): string {
  const parts = relativePath.split("/");
  parts.pop(); // Remove filename

  if (parts.length === 0) {
    return "Uncategorized";
  }

  if (parts.length === 1) {
    // Single level: contracts/basic/ → "Basic"
    return formatCategoryName(parts[0]);
  }

  // Multi-level: contracts/basic/encrypt/ → "Basic - Encryption"
  return parts.map(formatCategoryName).join(" - ");
}

/**
 * Find matching test file
 */
function findTestFile(contractPath: string): string | null {
  const relativePath = path.relative(CONTRACTS_DIR, contractPath);
  const testPath = path.join(TEST_DIR, relativePath.replace(".sol", ".ts"));

  return fs.existsSync(testPath)
    ? `test/${path.relative(TEST_DIR, testPath)}`
    : null;
}

/**
 * Get docs output path based on contract path
 * Converts to kebab-case for markdown standards
 * Examples:
 *   contracts/openzeppelin/ERC7984.sol → docs/openzeppelin/erc7984.md
 *   contracts/basic/FHECounter.sol → docs/basic/fhe-counter.md
 *   contracts/advanced/BlindAuction.sol → docs/advanced/blind-auction.md
 */
function getDocsOutput(contractPath: string): string {
  // Remove "contracts/" prefix and ".sol" extension
  const relativePath = contractPath
    .replace(/^contracts\//, "")
    .replace(/\.sol$/, "");

  // Convert to kebab-case
  const kebabPath = relativePath
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

  return `docs/${kebabPath}.md`;
}

/**
 * Scan contracts directory recursively
 */
function scanContracts(): ContractInfo[] {
  const contracts: ContractInfo[] = [];

  function scan(dir: string) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && item !== "mocks") {
        scan(fullPath);
      } else if (stat.isFile() && item.endsWith(".sol")) {
        const relativePath = path.relative(CONTRACTS_DIR, fullPath);
        const contractName = item.replace(".sol", "");
        const exampleName = contractNameToExampleName(contractName);
        const category = getCategoryFromPath(relativePath);
        const testPath = findTestFile(fullPath);
        const description = extractNotice(fullPath);

        if (!description) {
          console.warn(`⚠️  No @notice found in ${relativePath}`);
          return;
        }

        if (!testPath) {
          console.warn(`⚠️  No test file found for ${relativePath}`);
          return;
        }

        contracts.push({
          name: exampleName,
          contractPath: `contracts/${relativePath}`,
          testPath,
          description,
          category,
          title: contractNameToTitle(contractName),
          docsOutput: getDocsOutput(`contracts/${relativePath}`),
        });
      }
    }
  }

  scan(CONTRACTS_DIR);
  return contracts;
}

/**
 * Generate EXAMPLES config
 */
function generateExamplesConfig(contracts: ContractInfo[]): string {
  const entries = contracts.map((c) => {
    return `  "${c.name}": {
    contract: "${c.contractPath}",
    test: "${c.testPath}",
    description:
      "${c.description}",
    category: "${c.category}",
    docsOutput: "${c.docsOutput}",
    title: "${c.title}",
  }`;
  });

  return `export const EXAMPLES: Record<string, ExampleConfig> = {\n${entries.join(
    ",\n"
  )}\n};`;
}

/**
 * Generate CATEGORIES config
 */
function generateCategoriesConfig(contracts: ContractInfo[]): string {
  const categoryMap: Record<string, ContractInfo[]> = {};

  for (const contract of contracts) {
    if (!categoryMap[contract.category]) {
      categoryMap[contract.category] = [];
    }
    categoryMap[contract.category].push(contract);
  }

  const categoryEntries = Object.entries(categoryMap).map(
    ([category, items]) => {
      const categoryKey = category
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/-/g, "");
      const contracts = items
        .map(
          (c) => `      {
        sol: "${c.contractPath}",
        test: "${c.testPath}",
      }`
        )
        .join(",\n");

      // Generate description based on category name
      let description = "";

      // Predefined descriptions for known categories
      const categoryDescriptions: Record<string, string> = {
        Basic:
          "Fundamental FHEVM operations including encryption, decryption, and basic FHE operations",
        "Basic - Encryption": "Encrypting values and handling encrypted inputs",
        "Basic - Decryption":
          "User and public decryption patterns for encrypted values",
        "Basic - Fhe-Operations":
          "Arithmetic, comparison, and conditional operations",
        Concepts: "Access control, input proofs, handles, and anti-patterns",
        Openzeppelin:
          "ERC7984 confidential token standard, wrappers, swaps, and vesting",
        Advanced:
          "Complex FHE applications: blind auctions, encrypted voting systems",
      };

      description =
        categoryDescriptions[category] ||
        `${category} examples and implementations`;

      return `  ${categoryKey}: {
    name: "${category} Examples",
    description:
      "${description}",
    contracts: [
${contracts}
    ],
  }`;
    }
  );

  return `export const CATEGORIES: Record<string, CategoryConfig> = {\n${categoryEntries.join(
    ",\n"
  )}\n};`;
}

/**
 * Generate full config file
 */
function generateConfigFile(contracts: ContractInfo[]): string {
  return `/**
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY ⚠️
 *
 * This file is auto-generated by scripts/generate-config.ts
 * Run 'npm run generate:config' to regenerate
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

${generateExamplesConfig(contracts)}

// =============================================================================
// Category Configurations
// =============================================================================

${generateCategoriesConfig(contracts)}

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
  return exampleName.startsWith("fhe-") ? exampleName : \`fhe-\${exampleName}\`;
}
`;
}

/**
 * Main function
 */
function main() {
  console.log("🔍 Scanning contracts...\n");

  const contracts = scanContracts();

  console.log(`✅ Found ${contracts.length} contracts\n`);

  // Show summary
  const categoryCount: Record<string, number> = {};
  for (const c of contracts) {
    categoryCount[c.category] = (categoryCount[c.category] || 0) + 1;
  }

  console.log("📊 By category:");
  for (const [category, count] of Object.entries(categoryCount)) {
    console.log(`   ${category}: ${count}`);
  }

  console.log("\n📝 Generating config...");
  const configContent = generateConfigFile(contracts);

  fs.writeFileSync(OUTPUT_FILE, configContent);

  console.log(`✅ Config generated: ${path.relative(ROOT_DIR, OUTPUT_FILE)}`);
  console.log(`\n💡 Next: npm run sync:config`);
}

main();
