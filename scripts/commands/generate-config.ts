#!/usr/bin/env node

/**
 * Auto-Discovery Config Generator - Automatically updates project configuration.
 *
 * Scans the contracts/ directory and generates scripts/config.ts.
 * Extracts metadata from @notice tags and infers category structure.
 */

import * as fs from "fs";
import * as path from "path";
import {
  toKebabCase,
  contractNameToExampleName,
  contractNameToTitle,
  formatCategoryName,
  log,
  CATEGORY_ORDER,
} from "../shared/utils";
import pc from "picocolors";

const ROOT_DIR = path.resolve(__dirname, "../..");
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
  npmDependencies?: Record<string, string>;
  dependencies?: string[];
}

// =============================================================================
// Contract Analysis
// =============================================================================

function extractNotice(contractPath: string): string | null {
  const content = fs.readFileSync(contractPath, "utf-8");

  // Match @notice and capture everything until @dev or end of comment block
  const noticeRegex = /\/\*\*[\s\S]*?@notice\s+([\s\S]*?)(?:@dev|@param|\*\/)/;
  const match = content.match(noticeRegex);

  if (!match || !match[1]) {
    return null;
  }

  // Clean up the extracted text:
  // 1. Remove leading asterisks and whitespace from each line
  // 2. Join lines with space
  // 3. Collapse multiple spaces
  const cleaned = match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function readExistingConfig(): Record<string, any> {
  try {
    if (!fs.existsSync(OUTPUT_FILE)) {
      return {};
    }
    delete require.cache[require.resolve(OUTPUT_FILE)];
    const config = require(OUTPUT_FILE);
    return config.EXAMPLES || {};
  } catch (error) {
    console.warn("⚠️  Could not read existing config, starting fresh");
    return {};
  }
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

function getDocsOutput(contractPath: string): string {
  const relativePath = contractPath
    .replace(/^contracts\//, "")
    .replace(/\.sol$/, "");
  return `docs/${toKebabCase(relativePath)}.md`;
}

function scanContracts(): ContractInfo[] {
  const contracts: ContractInfo[] = [];
  const existingConfig = readExistingConfig();

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

        const contractInfo: ContractInfo = {
          name: exampleName,
          contractPath: `contracts/${relativePath}`,
          testPath,
          description,
          category,
          title: contractNameToTitle(contractName),
          docsOutput: getDocsOutput(`contracts/${relativePath}`),
        };

        const existingExample = existingConfig[exampleName];
        if (existingExample?.npmDependencies) {
          contractInfo.npmDependencies = existingExample.npmDependencies;
        }

        if (existingExample?.dependencies) {
          contractInfo.dependencies = existingExample.dependencies;
        }

        contracts.push(contractInfo);
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
    const npmDepsField = c.npmDependencies
      ? `\n    npmDependencies: ${JSON.stringify(
          c.npmDependencies,
          null,
          2
        ).replace(/\n/g, "\n    ")},`
      : "";

    const depsField = c.dependencies
      ? `\n    dependencies: ${JSON.stringify(c.dependencies, null, 2).replace(
          /\n/g,
          "\n    "
        )},`
      : "";

    return `  "${c.name}": {
    contract: "${c.contractPath}",
    test: "${c.testPath}",${npmDepsField}${depsField}
    description:
      "${c.description.replace(/"/g, '\\"')}",
    category: "${c.category}",
    docsOutput: "${c.docsOutput}",
    title: "${c.title}"
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

  const sortedEntries = Object.entries(categoryMap).sort(([catA], [catB]) => {
    const idxA = CATEGORY_ORDER.indexOf(catA);
    const idxB = CATEGORY_ORDER.indexOf(catB);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    return catA.localeCompare(catB);
  });

  const categoryEntries = sortedEntries.map(([category, items]) => {
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

    return `  ${categoryKey}: {
    name: "${category}",
    contracts: [
${contracts}
    ],
  }`;
  });

  return `export const CATEGORIES: Record<string, CategoryConfig> = {\n${categoryEntries.join(
    ",\n"
  )}\n};`;
}

function generateConfigFile(contracts: ContractInfo[]): string {
  return `/**
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY ⚠️
 *
 * This file is auto-generated by cli/generate-config.ts
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
  /** Optional additional contract dependencies */
  dependencies?: string[];
  /** Optional npm packages to install */
  npmDependencies?: Record<string, string>;
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

// =============================================================================
// Main
// =============================================================================

function main() {
  log.info(`🔍 Scanning examples in: ${pc.cyan("contracts/")}\n`);

  const contracts = scanContracts();

  if (contracts.length === 0) {
    log.error("❌ No valid contracts discovered. Check for @notice tags.");
    process.exit(1);
  }

  log.success(`✅ Found ${pc.bold(String(contracts.length))} contracts\n`);

  const categoryCount: Record<string, number> = {};
  for (const c of contracts) {
    categoryCount[c.category] = (categoryCount[c.category] || 0) + 1;
  }

  log.message(pc.bold("📊 Discovery Summary:"));
  for (const [category, count] of Object.entries(categoryCount)) {
    log.message(
      `   ${pc.dim("•")} ${pc.yellow(category.padEnd(25))} ${pc.cyan(
        String(count).padStart(2)
      )} examples`
    );
  }

  log.message(
    `\n📝 Generating: ${pc.cyan(path.relative(ROOT_DIR, OUTPUT_FILE))}...`
  );
  const configContent = generateConfigFile(contracts);

  fs.writeFileSync(OUTPUT_FILE, configContent);

  log.success(`\n✨ Configuration updated successfully!`);
}

const isMainModule = process.argv[1]?.includes("generate-config");
if (isMainModule) {
  main();
}
