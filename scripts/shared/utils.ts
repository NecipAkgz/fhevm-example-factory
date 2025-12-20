/**
 * Core Utilities - Essential helper functions for the FHEVM Example Factory.
 *
 * Contains constants, types, logging, file system operations,
 * naming utilities, and validation functions.
 */

import * as fs from "fs";
import * as path from "path";
import pc from "picocolors";
import { EXAMPLES, CATEGORIES } from "./config";

// =============================================================================
// Constants & Types
// =============================================================================

export type ProjectMode = "single" | "category";

export const CATEGORY_ICON = "📁";

/** Template directory name within the cloned repo */
export const TEMPLATE_DIR_NAME = "fhevm-hardhat-template";

/** Maximum description length for UI display */
export const MAX_DESCRIPTION_LENGTH = 80;

/** Directories to exclude when copying template */
export const EXCLUDE_DIRS = [
  "node_modules",
  "artifacts",
  "cache",
  "coverage",
  "types",
  "dist",
  ".git",
];

/** FHEVM package versions for --add mode */
export const FHEVM_DEPENDENCIES = {
  dependencies: {
    "encrypted-types": "^0.0.4",
    "@fhevm/solidity": "^0.9.1",
  },
  devDependencies: {
    "@fhevm/hardhat-plugin": "^0.3.0-1",
    "@zama-fhe/relayer-sdk": "^0.3.0-5",
  },
};

export const CATEGORY_ORDER = [
  "Basic - Encryption",
  "Basic - Decryption",
  "Basic - FHE Operations",
  "Concepts",
  "Gaming",
  "Openzeppelin",
  "Advanced",
];

export const TEST_TYPES_CONTENT = `import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Common signers interface used across test files
 */
export interface Signers {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
}
`;

export const ERROR_MESSAGES = {
  EXAMPLE_REQUIRED: "Error: Either --example or --category is required",
  BOTH_SPECIFIED: "Error: Cannot use both --example and --category",
  UNKNOWN_EXAMPLE: (name: string) => `Error: Unknown example "${name}"`,
  UNKNOWN_CATEGORY: (name: string) => `Error: Unknown category "${name}"`,
  DIR_EXISTS: (path: string) => `Error: Directory already exists: ${path}`,
  NOT_HARDHAT: "This directory does not contain a valid Hardhat project.",
  CONFIG_NOT_FOUND: "hardhat.config.ts or hardhat.config.js not found",
  CONTRACT_NAME_FAILED: "Could not extract contract name",
};

// =============================================================================
// Logging Utility
// =============================================================================

export const log = {
  success: (msg: string) => console.log(pc.green(msg)),
  error: (msg: string) => console.error(pc.red(msg)),
  info: (msg: string) => console.log(pc.cyan(msg)),
  dim: (msg: string) => console.log(pc.dim(msg)),
  message: (msg: string) => console.log(msg),
};

/**
 * Standardized error handler for CLI - logs error and exits
 */
export function handleError(error: unknown, exitCode = 1): never {
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
  process.exit(exitCode);
}

// =============================================================================
// File System Utilities
// =============================================================================

/** Resolves root directory of the project (from scripts/shared/) */
export function getRootDir(): string {
  return path.resolve(__dirname, "../..");
}

/** Resolves template directory path */
export function getTemplateDir(): string {
  return path.join(getRootDir(), TEMPLATE_DIR_NAME);
}

/** Copies directory recursively, excluding specified directories */
export function copyDirectoryRecursive(
  source: string,
  destination: string,
  excludeDirs: string[] = EXCLUDE_DIRS
): void {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const items = fs.readdirSync(source);
  items.forEach((item) => {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
      if (excludeDirs.includes(item)) {
        return;
      }
      copyDirectoryRecursive(sourcePath, destPath, excludeDirs);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  });
}

// =============================================================================
// Naming Utilities
// =============================================================================

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

export function contractNameToExampleName(contractName: string): string {
  return toKebabCase(contractName);
}

export function contractNameToTitle(contractName: string): string {
  return contractName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

export function formatCategoryName(folderName: string): string {
  return folderName
    .replace(/\bfhe\b/gi, "FHE")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getContractName(contractPathOrContent: string): string | null {
  let content: string;

  if (
    contractPathOrContent.includes("contract ") ||
    contractPathOrContent.includes("pragma solidity")
  ) {
    content = contractPathOrContent;
  } else {
    const fullPath = contractPathOrContent.startsWith("/")
      ? contractPathOrContent
      : path.join(getRootDir(), contractPathOrContent);
    if (!fs.existsSync(fullPath)) {
      const match = contractPathOrContent.match(/([^/]+)\.sol$/);
      return match ? match[1] : null;
    }
    content = fs.readFileSync(fullPath, "utf-8");
  }

  const match = content.match(/^\s*contract\s+(\w+)(?:\s+is\s+|\s*\{)/m);
  return match ? match[1] : null;
}

// =============================================================================
// Validation Functions
// =============================================================================

export function validateExample(name: string): void {
  if (!EXAMPLES[name]) {
    throw new Error(ERROR_MESSAGES.UNKNOWN_EXAMPLE(name));
  }
}

export function validateCategory(name: string): void {
  if (!CATEGORIES[name]) {
    throw new Error(ERROR_MESSAGES.UNKNOWN_CATEGORY(name));
  }
}

export function validateDirectoryNotExists(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    throw new Error(ERROR_MESSAGES.DIR_EXISTS(dirPath));
  }
}
