/**
 * Utility functions for creating FHEVM example projects
 */
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { REPO_URL, REPO_BRANCH, TEMPLATE_SUBMODULE_PATH } from "./config.js";
// =============================================================================
// File System Utilities
// =============================================================================
/**
 * Get contract name from file path
 */
export function getContractName(contractPath) {
    const match = contractPath.match(/([^/]+)\.sol$/);
    return match ? match[1] : null;
}
/**
 * Recursively copy directory
 */
export function copyDirectoryRecursive(src, dest) {
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
        }
        else {
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
export async function downloadFileFromGitHub(filePath, outputPath) {
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
export async function cloneTemplate(tempDir) {
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
            }
            else {
                reject(new Error(`Git clone failed: ${stderr}`));
            }
        });
        child.on("error", reject);
    });
}
/**
 * Initialize git submodule for template
 */
export async function initSubmodule(repoPath) {
    return new Promise((resolve, reject) => {
        const child = spawn("git", ["submodule", "update", "--init", "--recursive", TEMPLATE_SUBMODULE_PATH], {
            cwd: repoPath,
            stdio: "pipe",
        });
        let stderr = "";
        child.stderr?.on("data", (data) => {
            stderr += data.toString();
        });
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            }
            else {
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
export function runCommand(cmd, args, cwd) {
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
            }
            else {
                reject(new Error(stderr || stdout || `Command failed with code ${code}`));
            }
        });
        child.on("error", reject);
    });
}
/**
 * Extract test results from npm test output
 */
export function extractTestResults(output) {
    const passingMatch = output.match(/(\d+)\s+passing/);
    const failingMatch = output.match(/(\d+)\s+failing/);
    if (passingMatch) {
        const passing = passingMatch[1];
        const failing = failingMatch ? failingMatch[1] : "0";
        if (failing === "0") {
            return `${passing} tests passing ✓`;
        }
        else {
            return `${passing} passing, ${failing} failing`;
        }
    }
    return null;
}
/**
 * Generate deploy script
 */
export function generateDeployScript(contractName) {
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
//# sourceMappingURL=utils.js.map