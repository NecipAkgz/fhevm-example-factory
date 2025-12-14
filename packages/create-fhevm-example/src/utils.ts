/**
 * Utility functions for creating FHEVM example projects
 */

import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import pc from "picocolors";
import {
  REPO_URL,
  REPO_BRANCH,
  TEMPLATE_SUBMODULE_PATH,
  EXAMPLES,
  CATEGORIES,
} from "./config.js";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Prompt result type (value or cancellation symbol)
 */
export type PromptResult<T> = T | symbol;

/**
 * Example name type
 */
export type ExampleName = string;

/**
 * Category name type
 */
export type CategoryName = string;

/**
 * Project mode type
 */
export type ProjectMode = "single" | "category";

// =============================================================================
// Constants
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

/**
 * Centralized error messages
 */
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

/**
 * Standardized logging functions
 */
export const log = {
  success: (msg: string) => console.log(pc.green(msg)),
  error: (msg: string) => console.error(pc.red(msg)),
  info: (msg: string) => console.log(pc.cyan(msg)),
  dim: (msg: string) => console.log(pc.dim(msg)),
  message: (msg: string) => console.log(msg),
};

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates that an example exists
 */
export function validateExample(name: string): void {
  if (!EXAMPLES[name]) {
    throw new Error(ERROR_MESSAGES.UNKNOWN_EXAMPLE(name));
  }
}

/**
 * Validates that a category exists
 */
export function validateCategory(name: string): void {
  if (!CATEGORIES[name]) {
    throw new Error(ERROR_MESSAGES.UNKNOWN_CATEGORY(name));
  }
}

/**
 * Validates that a directory doesn't exist
 */
export function validateDirectoryNotExists(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    throw new Error(ERROR_MESSAGES.DIR_EXISTS(dirPath));
  }
}

// =============================================================================
// File System Utilities
// =============================================================================

/**
 * Get contract name from file path
 */
export function getContractName(contractPath: string): string | null {
  const match = contractPath.match(/([^/]+)\.sol$/);
  return match ? match[1] : null;
}

/**
 * Recursively copy directory
 */
export function copyDirectoryRecursive(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and .git
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// =============================================================================
// GitHub Repository Utilities
// =============================================================================

/**
 * Download file from GitHub repository
 */
export async function downloadFileFromGitHub(
  filePath: string,
  outputPath: string
): Promise<void> {
  // Extract owner and repo from REPO_URL
  const urlParts = REPO_URL.replace("https://github.com/", "").split("/");
  const owner = urlParts[0];
  const repo = urlParts[1];

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${REPO_BRANCH}/${filePath}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${filePath}: ${response.statusText}`);
  }

  const content = await response.text();

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content);
}

/**
 * Clone template repository to temporary directory
 */
export async function cloneTemplate(tempDir: string): Promise<string> {
  const templatePath = path.join(tempDir, "template");

  return new Promise((resolve, reject) => {
    const cloneUrl = `${REPO_URL}.git`;
    const args = [
      "clone",
      "--depth=1",
      "--branch",
      REPO_BRANCH,
      "--single-branch",
      cloneUrl,
      templatePath,
    ];

    const child = spawn("git", args, {
      stdio: "pipe",
    });

    let stderr = "";

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(templatePath);
      } else {
        reject(new Error(`Git clone failed: ${stderr}`));
      }
    });

    child.on("error", reject);
  });
}

/**
 * Initialize git submodule for template
 */
export async function initSubmodule(repoPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "git",
      ["submodule", "update", "--init", "--recursive", TEMPLATE_SUBMODULE_PATH],
      {
        cwd: repoPath,
        stdio: "pipe",
      }
    );

    let stderr = "";

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Submodule init failed: ${stderr}`));
      }
    });

    child.on("error", reject);
  });
}

// =============================================================================
// Command Execution Utilities
// =============================================================================

/**
 * Run a shell command
 */
export function runCommand(
  cmd: string,
  args: string[],
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(stderr || stdout || `Command failed with code ${code}`)
        );
      }
    });

    child.on("error", reject);
  });
}

/**
 * Extract test results from npm test output
 */
export function extractTestResults(output: string): string | null {
  const passingMatch = output.match(/(\d+)\s+passing/);
  const failingMatch = output.match(/(\d+)\s+failing/);

  if (passingMatch) {
    const passing = passingMatch[1];
    const failing = failingMatch ? failingMatch[1] : "0";
    if (failing === "0") {
      return `${passing} tests passing ✓`;
    } else {
      return `${passing} passing, ${failing} failing`;
    }
  }
  return null;
}

/**
 * Generate deploy script
 */
export function generateDeployScript(contractName: string): string {
  return `import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployed = await deploy("${contractName}", {
    from: deployer,
    args: [],
    log: true,
  });

  console.log(\`${contractName} contract deployed at: \${deployed.address}\`);
};

export default func;
func.id = "deploy_${contractName.toLowerCase()}";
func.tags = ["${contractName}"];
`;
}
