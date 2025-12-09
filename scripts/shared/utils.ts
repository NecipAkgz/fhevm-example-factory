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

/**
 * Read file content safely
 */
export function readFile(filePath: string): string {
  const fullPath = filePath.startsWith("/")
    ? filePath
    : path.join(getRootDir(), filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return fs.readFileSync(fullPath, "utf-8");
}

/**
 * Write file content, creating directories if needed
 */
export function writeFile(filePath: string, content: string): void {
  const fullPath = filePath.startsWith("/")
    ? filePath
    : path.join(getRootDir(), filePath);

  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content);
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  const fullPath = filePath.startsWith("/")
    ? filePath
    : path.join(getRootDir(), filePath);

  return fs.existsSync(fullPath);
}

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
