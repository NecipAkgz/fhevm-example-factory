/**
 * Generators - Template processing, code generation, and Git operations.
 *
 * Contains functions for scaffolding templates, generating deploy scripts,
 * creating documentation, and interacting with GitHub.
 */

import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { REPO_URL, REPO_BRANCH } from "./config";
import { TEST_TYPES_CONTENT, TEMPLATE_DIR_NAME } from "./utils";

// =============================================================================
// Template & Scaffolding Utilities
// =============================================================================

/**
 * Cleans up the template directory after copying
 */
export function cleanupTemplate(outputDir: string): void {
  const gitDir = path.join(outputDir, ".git");
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  const githubDir = path.join(outputDir, ".github");
  if (fs.existsSync(githubDir)) {
    fs.rmSync(githubDir, { recursive: true, force: true });
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

// =============================================================================
// Code Generators
// =============================================================================

/**
 * Generates a deploy script for a contract
 */
export function generateDeployScript(contractName: string): string {
  return `import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\\n🚀 Deploying ${contractName}...");
  console.log(\`📍 Network: \${hre.network.name}\`);
  console.log(\`👤 Deployer: \${deployer}\\n\`);

  const deployed = await deploy("${contractName}", {
    from: deployer,
    args: [],
    log: true,
  });

  console.log("\\n✅ Deployment Complete!");
  console.log(\`📄 Contract: ${contractName}\`);
  console.log(\`📍 Contract Address: \${deployed.address}\`);

  if (deployed.newlyDeployed) {
    console.log(\`⛽ Gas Used: \${deployed.receipt?.gasUsed}\`);
  } else {
    console.log("ℹ️  Contract was already deployed");
  }
  console.log("");
};

export default func;
func.id = "deploy_${contractName.toLowerCase()}";
func.tags = ["${contractName}"];
`;
}

/**
 * Generates GitBook-compatible markdown documentation
 */
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
// Package.json Utilities
// =============================================================================

/**
 * Updates package.json with project name and dependencies
 */
export function updateProjectPackageJson(
  outputDir: string,
  projectName: string,
  description?: string,
  npmDependencies?: Record<string, string>
): void {
  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  packageJson.name = projectName;
  if (description) {
    packageJson.description = description;
  }

  if (npmDependencies && Object.keys(npmDependencies).length > 0) {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    Object.assign(packageJson.dependencies, npmDependencies);
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

// =============================================================================
// Command Execution Utilities
// =============================================================================

/**
 * Runs a command and returns the output
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
 * Runs a command and returns success status with output
 */
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

/**
 * Extracts test results from command output
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
 * Extracts error messages from command output
 */
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

// =============================================================================
// GitHub Repository Utilities
// =============================================================================

/**
 * Downloads a file from GitHub repository
 */
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

/**
 * Clones the template repository to temp directory
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
 * Initializes git submodule for the template
 */
export async function initSubmodule(repoPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "git",
      ["submodule", "update", "--init", "--recursive", TEMPLATE_DIR_NAME],
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
