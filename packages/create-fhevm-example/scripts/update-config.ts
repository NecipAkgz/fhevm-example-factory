#!/usr/bin/env node

/**
 * Local Config Update Script for create-fhevm-example
 *
 * Scans the monorepo contracts directory and generates src/config.ts.
 * If the monorepo is not available (standalone mode), logs a warning.
 *
 * Usage: npm run update:config
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPT_DIR = __dirname;
const PACKAGE_ROOT = path.resolve(SCRIPT_DIR, "..");
const MONOREPO_ROOT = path.resolve(PACKAGE_ROOT, "../..");
const CONTRACTS_DIR = path.join(MONOREPO_ROOT, "contracts");
const TEST_DIR = path.join(MONOREPO_ROOT, "test");
const OUTPUT_FILE = path.join(PACKAGE_ROOT, "src/config.ts");

interface ContractInfo {
  name: string;
  contractPath: string;
  testPath: string;
  description: string;
  category: string;
  title: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

function extractNotice(contractPath: string): string | null {
  const content = fs.readFileSync(contractPath, "utf-8");
  const noticeRegex =
    /\/\*\*[\s\S]*?@notice\s+([^\n*]+)[\s\S]*?\*\/[\s\S]*?contract\s+\w+/;
  const match = content.match(noticeRegex);
  return match && match[1] ? match[1].trim() : null;
}

function contractNameToExampleName(contractName: string): string {
  return contractName
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function contractNameToTitle(contractName: string): string {
  return contractName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function formatCategoryName(folderName: string): string {
  return folderName
    .replace(/\bfhe\b/gi, "FHE")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCategoryFromPath(relativePath: string): string {
  const parts = relativePath.split("/");
  parts.pop();
  if (parts.length === 0) return "Uncategorized";
  if (parts.length === 1) return formatCategoryName(parts[0]);
  return parts.map(formatCategoryName).join(" - ");
}

function findTestFile(contractPath: string): string | null {
  const relativePath = path.relative(CONTRACTS_DIR, contractPath);
  const testPath = path.join(TEST_DIR, relativePath.replace(".sol", ".ts"));
  return fs.existsSync(testPath)
    ? `test/${path.relative(TEST_DIR, testPath)}`
    : null;
}

// =============================================================================
// Contract Scanning
// =============================================================================

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
        });
      }
    }
  }

  scan(CONTRACTS_DIR);
  return contracts;
}

// =============================================================================
// Config Generation
// =============================================================================

function generateExamplesConfig(contracts: ContractInfo[]): string {
  const entries = contracts.map((c) => {
    return `  "${c.name}": {
    "contract": "${c.contractPath}",
    "test": "${c.testPath}",
    "description": "${c.description}",
    "category": "${c.category}",
    "title": "${c.title}"
  }`;
  });
  return `export const EXAMPLES: Record<string, ExampleConfig> = {\n${entries.join(
    ",\n"
  )}\n};`;
}

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
      const contractsList = items
        .map(
          (c) => `      {
        "sol": "${c.contractPath}",
        "test": "${c.testPath}"
      }`
        )
        .join(",\n");

      return `  "${categoryKey}": {
    "name": "${category} Examples",
    "contracts": [
${contractsList}
    ]
  }`;
    }
  );

  return `export const CATEGORIES: Record<string, CategoryConfig> = {\n${categoryEntries.join(
    ",\n"
  )}\n};`;
}

function generateConfigFile(contracts: ContractInfo[]): string {
  return `/**
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY ⚠️
 *
 * This file is auto-generated by scripts/update-config.ts
 * Run 'npm run update:config' to regenerate
 */

// =============================================================================
// Types
// =============================================================================

export interface ExampleConfig {
  /** Path to the Solidity contract file */
  contract: string;
  /** Path to the TypeScript test file */
  test: string;
  /** Optional additional contract dependencies */
  dependencies?: string[];
  /** Optional npm packages to install */
  npmDependencies?: Record<string, string>;
  /** Full description for documentation */
  description: string;
  /** Category for grouping */
  category: string;
  /** Title for documentation */
  title: string;
}

export interface CategoryConfig {
  /** Display name */
  name: string;
  /** List of contracts in this category */
  contracts: Array<{ sol: string; test?: string }>;
}

// =============================================================================
// GitHub Repository Configuration
// =============================================================================

export const REPO_URL = "https://github.com/NecipAkgz/fhevm-example-factory";
export const REPO_BRANCH = "main";
export const TEMPLATE_SUBMODULE_PATH = "fhevm-hardhat-template";

// =============================================================================
// Example Configurations
// =============================================================================

${generateExamplesConfig(contracts)}

// =============================================================================
// Category Configurations
// =============================================================================

${generateCategoriesConfig(contracts)}
`;
}

// =============================================================================
// Main
// =============================================================================

function main(): void {
  console.log("🔍 Checking for monorepo contracts directory...\n");

  if (!fs.existsSync(CONTRACTS_DIR)) {
    console.warn(
      "⚠️  Monorepo contracts directory not found. Running in standalone mode."
    );
    console.log("   Existing config.ts will be preserved.\n");
    return;
  }

  console.log("✅ Monorepo detected. Scanning contracts...\n");

  const contracts = scanContracts();
  console.log(`📊 Found ${contracts.length} contracts\n`);

  const categoryCount: Record<string, number> = {};
  for (const c of contracts) {
    categoryCount[c.category] = (categoryCount[c.category] || 0) + 1;
  }

  console.log("📁 By category:");
  for (const [category, count] of Object.entries(categoryCount)) {
    console.log(`   ${category}: ${count}`);
  }

  console.log("\n📝 Generating config...");
  const configContent = generateConfigFile(contracts);
  fs.writeFileSync(OUTPUT_FILE, configContent);

  console.log(`✅ Config generated: src/config.ts`);
}

main();
