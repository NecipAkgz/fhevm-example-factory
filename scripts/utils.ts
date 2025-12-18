/**
 * Utility functions for FHEVM Example Factory CLI
 *
 * Consolidated utilities from:
 * - scripts/shared/utils.ts
 * - scripts/shared/commands.ts
 * - packages/create-fhevm-example/src/utils.ts
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
} from "./config";

// =============================================================================
// Type Definitions
// =============================================================================

export type PromptResult<T> = T | symbol;
export type ExampleName = string;
export type CategoryName = string;
export type ProjectMode = "single" | "category";

// =============================================================================
// Constants
// =============================================================================

export const CATEGORY_ICON = "📁";

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

// =============================================================================
// File System Utilities
// =============================================================================

export function getRootDir(): string {
  return path.resolve(__dirname, "..");
}

export function getTemplateDir(): string {
  return path.join(getRootDir(), "fhevm-hardhat-template");
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

export function copyDirectoryRecursive(
  source: string,
  destination: string,
  excludeDirs: string[] = [
    "node_modules",
    "artifacts",
    "cache",
    "coverage",
    "types",
    "dist",
    ".git",
  ]
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

// =============================================================================
// Template Utilities
// =============================================================================

export function cleanupTemplate(outputDir: string): void {
  const gitDir = path.join(outputDir, ".git");
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  const templateContract = path.join(outputDir, "contracts", "FHECounter.sol");
  if (fs.existsSync(templateContract)) {
    fs.unlinkSync(templateContract);
  }

  const contractsGitkeep = path.join(outputDir, "contracts", ".gitkeep");
  if (fs.existsSync(contractsGitkeep)) {
    fs.unlinkSync(contractsGitkeep);
  }

  const testDir = path.join(outputDir, "test");
  if (fs.existsSync(testDir)) {
    fs.readdirSync(testDir).forEach((file) => {
      if (file.endsWith(".ts") || file === ".gitkeep") {
        fs.unlinkSync(path.join(testDir, file));
      }
    });
  }

  const configPath = path.join(outputDir, "hardhat.config.ts");
  if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, "utf-8");
    configContent = configContent.replace(
      /import "\.\/tasks\/FHECounter";\n?/g,
      ""
    );
    fs.writeFileSync(configPath, configContent);
  }

  const oldTaskFile = path.join(outputDir, "tasks", "FHECounter.ts");
  if (fs.existsSync(oldTaskFile)) {
    fs.unlinkSync(oldTaskFile);
  }

  fs.writeFileSync(
    path.join(outputDir, "test", "types.ts"),
    TEST_TYPES_CONTENT
  );
}

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

export function generateGitBookMarkdown(
  description: string,
  contractContent: string,
  testContent: string,
  contractName: string,
  testFileName: string
): string {
  let markdown = `${description}\n\n`;

  markdown += `{% hint style="info" %}\n`;
  markdown += `To run this example correctly, make sure the files are placed in the following directories:\n\n`;
  markdown += `- \`.sol\` file → \`<your-project-root-dir>/contracts/\`\n`;
  markdown += `- \`.ts\` file → \`<your-project-root-dir>/test/\`\n\n`;
  markdown += `This ensures Hardhat can compile and test your contracts as expected.\n`;
  markdown += `{% endhint %}\n\n`;

  markdown += `{% tabs %}\n\n`;

  markdown += `{% tab title="${contractName}.sol" %}\n\n`;
  markdown += `\`\`\`solidity\n`;
  markdown += contractContent;
  markdown += `\n\`\`\`\n\n`;
  markdown += `{% endtab %}\n\n`;

  markdown += `{% tab title="${testFileName}" %}\n\n`;
  markdown += `\`\`\`typescript\n`;
  markdown += testContent;
  markdown += `\n\`\`\`\n\n`;
  markdown += `{% endtab %}\n\n`;

  markdown += `{% endtabs %}\n`;

  return markdown;
}

// =============================================================================
// GitHub Repository Utilities
// =============================================================================

export async function downloadFileFromGitHub(
  filePath: string,
  outputPath: string
): Promise<void> {
  const urlParts = REPO_URL.replace("https://github.com/", "").split("/");
  const owner = urlParts[0];
  const repo = urlParts[1];

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${REPO_BRANCH}/${filePath}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${filePath}: ${response.statusText}`);
  }

  const content = await response.text();

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content);
}

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

export function runCommandWithStatus(
  cmd: string,
  args: string[],
  cwd: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    let output = "";

    const proc = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ success: code === 0, output });
    });

    proc.on("error", (err) => {
      output += err.message;
      resolve({ success: false, output });
    });
  });
}

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

export function extractErrorMessage(output: string): string {
  const lines = output.split("\n");
  const errorLines: string[] = [];

  for (const line of lines) {
    if (line.includes("Error:") || line.includes("error:")) {
      errorLines.push(line.trim());
    }
    if (line.includes("TypeError") || line.includes("SyntaxError")) {
      errorLines.push(line.trim());
    }
    if (line.includes("AssertionError") || line.includes("expected")) {
      errorLines.push(line.trim());
    }
    if (line.includes("revert") || line.includes("reverted")) {
      errorLines.push(line.trim());
    }
    if (line.includes("HardhatError") || line.includes("ENOENT")) {
      errorLines.push(line.trim());
    }
  }

  if (errorLines.length > 0) {
    return errorLines.slice(0, 5).join("\n");
  }

  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  return nonEmptyLines.slice(-5).join("\n");
}
