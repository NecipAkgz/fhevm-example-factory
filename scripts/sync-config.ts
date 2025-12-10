#!/usr/bin/env node

/**
 * Config Sync Script
 *
 * Synchronizes example and category configurations from scripts/shared/config.ts
 * to packages/create-fhevm-example/src/config.ts
 *
 * Usage: npm run sync:config
 *
 * This ensures the NPM package always has up-to-date configuration
 * without manual copy-paste which is error-prone.
 */

import * as fs from "fs";
import * as path from "path";
import { EXAMPLES, CATEGORIES } from "./shared/config";

const ROOT_DIR = path.resolve(__dirname, "..");
const TARGET_FILE = path.join(
  ROOT_DIR,
  "packages/create-fhevm-example/src/config.ts"
);

/**
 * Generates the config.ts content for the NPM package
 */
function generateConfigContent(): string {
  // Convert EXAMPLES to simpler format (without docsOutput)
  const simpleExamples: Record<
    string,
    {
      contract: string;
      test: string;
      description: string;
      category: string;
      title: string;
    }
  > = {};

  for (const [key, config] of Object.entries(EXAMPLES)) {
    simpleExamples[key] = {
      contract: config.contract,
      test: config.test,
      description: config.description,
      category: config.category,
      title: config.title,
    };
  }

  return `/**
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY ⚠️
 *
 * This file is auto-generated from scripts/shared/config.ts
 * Run 'npm run sync:config' to update it.
 *
 * Source: scripts/shared/config.ts
 */

// =============================================================================
// Types
// =============================================================================

export interface ExampleConfig {
  /** Path to the Solidity contract file */
  contract: string;
  /** Path to the TypeScript test file */
  test: string;
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
  /** Description of the category */
  description: string;
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

export const EXAMPLES: Record<string, ExampleConfig> = ${JSON.stringify(
    simpleExamples,
    null,
    2
  )};

// =============================================================================
// Category Configurations
// =============================================================================

export const CATEGORIES: Record<string, CategoryConfig> = ${JSON.stringify(
    CATEGORIES,
    null,
    2
  )};
`;
}

/**
 * Main function
 */
function main(): void {
  console.log("🔄 Syncing config to NPM package...\n");

  // Generate content
  const content = generateConfigContent();

  // Write to target file
  fs.writeFileSync(TARGET_FILE, content);

  // Stats
  const exampleCount = Object.keys(EXAMPLES).length;
  const categoryCount = Object.keys(CATEGORIES).length;

  console.log(`✅ Config synced successfully!`);
  console.log(`   📝 Examples: ${exampleCount}`);
  console.log(`   📦 Categories: ${categoryCount}`);
  console.log(`   📁 Target: ${path.relative(ROOT_DIR, TARGET_FILE)}`);
}

main();
