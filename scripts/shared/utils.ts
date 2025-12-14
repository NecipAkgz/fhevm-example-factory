/**
 * Shared utility functions for all FHEVM Example Factory scripts
 */

import * as fs from "fs";
import * as path from "path";

// =============================================================================
// File System Utilities
// =============================================================================

/**
 * Get the root directory of the project
 */
export function getRootDir(): string {
  return path.resolve(__dirname, "../..");
}

/**
 * Extract contract name from Solidity file content or path
 */
export function getContractName(contractPathOrContent: string): string | null {
  let content: string;

  // Check if it's a file path or content
  if (
    contractPathOrContent.includes("contract ") ||
    contractPathOrContent.includes("pragma solidity")
  ) {
    content = contractPathOrContent;
  } else {
    const fullPath = contractPathOrContent.startsWith("/")
      ? contractPathOrContent
      : path.join(getRootDir(), contractPathOrContent);
    if (!fs.existsSync(fullPath)) return null;
    content = fs.readFileSync(fullPath, "utf-8");
  }

  const match = content.match(/^\s*contract\s+(\w+)(?:\s+is\s+|\s*\{)/m);
  return match ? match[1] : null;
}

// =============================================================================
// Naming Utilities
// =============================================================================

/**
 * Convert string to kebab-case
 * Handles acronyms: FHECounter → fhe-counter, ERC7984 → erc7984
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Convert contract name to kebab-case example name
 * Handles acronyms: FHECounter → fhe-counter, ERC7984 → erc7984
 */
export function contractNameToExampleName(contractName: string): string {
  return toKebabCase(contractName);
}

/**
 * Convert contract name to title
 * Handles acronyms: ERC7984 → ERC7984, FHECounter → FHE Counter
 * Complex cases: ERC7984ERC20Wrapper → ERC7984 ERC20 Wrapper
 */
export function contractNameToTitle(contractName: string): string {
  return contractName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

/**
 * Format folder name to proper category name
 * Examples: "encryption" → "Encryption", "fhe-operations" → "FHE Operations"
 */
export function formatCategoryName(folderName: string): string {
  return folderName
    .replace(/\bfhe\b/gi, "FHE")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// Category Constants
// =============================================================================

export const CATEGORY_ICON = "📁";

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
// Template Constants
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

// =============================================================================
// File System Utilities
// =============================================================================

/**
 * Copy directory recursively, excluding common build directories
 */
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

/**
 * Clean up template files after copying
 * Removes template-specific files and prepares for new content
 */
export function cleanupTemplate(outputDir: string): void {
  // Remove .git directory
  const gitDir = path.join(outputDir, ".git");
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  // Remove template contract
  const templateContract = path.join(outputDir, "contracts", "FHECounter.sol");
  if (fs.existsSync(templateContract)) {
    fs.unlinkSync(templateContract);
  }

  // Remove .gitkeep files
  const contractsGitkeep = path.join(outputDir, "contracts", ".gitkeep");
  if (fs.existsSync(contractsGitkeep)) {
    fs.unlinkSync(contractsGitkeep);
  }

  // Clear test directory (remove template tests)
  const testDir = path.join(outputDir, "test");
  if (fs.existsSync(testDir)) {
    fs.readdirSync(testDir).forEach((file) => {
      if (file.endsWith(".ts") || file === ".gitkeep") {
        fs.unlinkSync(path.join(testDir, file));
      }
    });
  }

  // Remove FHECounter import from hardhat.config.ts
  const configPath = path.join(outputDir, "hardhat.config.ts");
  if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, "utf-8");
    configContent = configContent.replace(
      /import "\.\/tasks\/FHECounter";\n?/g,
      ""
    );
    fs.writeFileSync(configPath, configContent);
  }

  // Remove FHECounter task file
  const oldTaskFile = path.join(outputDir, "tasks", "FHECounter.ts");
  if (fs.existsSync(oldTaskFile)) {
    fs.unlinkSync(oldTaskFile);
  }

  // Create test/types.ts
  fs.writeFileSync(
    path.join(outputDir, "test", "types.ts"),
    TEST_TYPES_CONTENT
  );
}

/**
 * Generate GitBook-formatted markdown documentation
 */
export function generateGitBookMarkdown(
  description: string,
  contractContent: string,
  testContent: string,
  contractName: string,
  testFileName: string
): string {
  let markdown = `${description}\n\n`;

  // Add hint block
  markdown += `{% hint style="info" %}\n`;
  markdown += `To run this example correctly, make sure the files are placed in the following directories:\n\n`;
  markdown += `- \`.sol\` file → \`<your-project-root-dir>/contracts/\`\n`;
  markdown += `- \`.ts\` file → \`<your-project-root-dir>/test/\`\n\n`;
  markdown += `This ensures Hardhat can compile and test your contracts as expected.\n`;
  markdown += `{% endhint %}\n\n`;

  // Add tabs for contract and test
  markdown += `{% tabs %}\n\n`;

  // Contract tab
  markdown += `{% tab title="${contractName}.sol" %}\n\n`;
  markdown += `\`\`\`solidity\n`;
  markdown += contractContent;
  markdown += `\n\`\`\`\n\n`;
  markdown += `{% endtab %}\n\n`;

  // Test tab
  markdown += `{% tab title="${testFileName}" %}\n\n`;
  markdown += `\`\`\`typescript\n`;
  markdown += testContent;
  markdown += `\n\`\`\`\n\n`;
  markdown += `{% endtab %}\n\n`;

  markdown += `{% endtabs %}\n`;

  return markdown;
}

// =============================================================================
// Template Utilities
// =============================================================================

/**
 * Get the path to the Hardhat template directory
 */
export function getTemplateDir(): string {
  return path.join(getRootDir(), "fhevm-hardhat-template");
}

/**
 * Generate deploy script content for a contract
 */
export function generateDeployScript(contractName: string): string {
  return `import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployed${contractName} = await deploy("${contractName}", {
    from: deployer,
    log: true,
  });

  console.log(\`${contractName} contract: \`, deployed${contractName}.address);
};
export default func;
func.id = "deploy_${contractName.toLowerCase()}";
func.tags = ["${contractName}"];
`;
}
