/**
 * Generators - Template processing and code generation utilities.
 *
 * Contains functions for scaffolding templates, generating deploy scripts,
 * and creating documentation.
 */

import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { GITIGNORE_CONTENT } from "./utils";

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

  // Remove macOS .DS_Store files
  const dsStore = path.join(outputDir, ".DS_Store");
  if (fs.existsSync(dsStore)) {
    fs.unlinkSync(dsStore);
  }

  // Remove template LICENSE (users should add their own)
  const license = path.join(outputDir, "LICENSE");
  if (fs.existsSync(license)) {
    fs.unlinkSync(license);
  }

  // Remove .vscode/ directory (users have their own preferences)
  const vscodeDir = path.join(outputDir, ".vscode");
  if (fs.existsSync(vscodeDir)) {
    fs.rmSync(vscodeDir, { recursive: true, force: true });
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

  // Remove all task imports from hardhat.config.ts
  const configPath = path.join(outputDir, "hardhat.config.ts");
  if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, "utf-8");
    // Remove all ./tasks/* imports
    configContent = configContent.replace(
      /import ["']\.\/tasks\/[^"']+["'];?\n?/g,
      ""
    );
    fs.writeFileSync(configPath, configContent);
  }

  // Remove entire tasks directory
  const tasksDir = path.join(outputDir, "tasks");
  if (fs.existsSync(tasksDir)) {
    fs.rmSync(tasksDir, { recursive: true, force: true });
  }

  // Create .gitignore (npm ignores .gitignore files during publish)
  const gitignorePath = path.join(outputDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, GITIGNORE_CONTENT);
  }
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

// =============================================================================
// FHE API Reference (from @fhevm/solidity)
// =============================================================================

/** FHE Library Functions with developer-friendly descriptions */
const FHE_FUNCTION_DESCRIPTIONS: Record<string, string> = {
  // Type Conversion & Initialization
  asEbool: "Encrypts a plaintext boolean into ebool",
  asEuint8: "Encrypts a plaintext uint8 value into euint8",
  asEuint16: "Encrypts a plaintext uint16 value into euint16",
  asEuint32: "Encrypts a plaintext uint32 value into euint32",
  asEuint64: "Encrypts a plaintext uint64 value into euint64",
  asEuint128: "Encrypts a plaintext uint128 value into euint128",
  asEuint256: "Encrypts a plaintext uint256 value into euint256",
  asEaddress: "Encrypts a plaintext address into eaddress",
  fromExternal:
    "Validates and converts external encrypted input using inputProof",
  isInitialized: "Checks if an encrypted value has been set (handle != 0)",

  // Arithmetic Operations
  add: "Homomorphic addition: result = a + b (overflow wraps)",
  sub: "Homomorphic subtraction: result = a - b (underflow wraps)",
  mul: "Homomorphic multiplication: result = a * b",
  div: "Homomorphic division: result = a / b (plaintext divisor only)",
  rem: "Homomorphic remainder: result = a % b (plaintext divisor only)",
  neg: "Homomorphic negation (two's complement)",
  min: "Returns smaller of two encrypted values",
  max: "Returns larger of two encrypted values",

  // Comparison Operations (return ebool)
  eq: "Encrypted equality: returns ebool(a == b)",
  ne: "Encrypted inequality: returns ebool(a != b)",
  gt: "Encrypted greater-than: returns ebool(a > b)",
  lt: "Encrypted less-than: returns ebool(a < b)",
  ge: "Encrypted greater-or-equal: returns ebool(a >= b)",
  le: "Encrypted less-or-equal: returns ebool(a <= b)",

  // Bitwise Operations
  and: "Homomorphic bitwise AND",
  or: "Homomorphic bitwise OR",
  xor: "Homomorphic bitwise XOR",
  not: "Homomorphic bitwise NOT",
  shl: "Homomorphic shift left",
  shr: "Homomorphic shift right",
  rotl: "Homomorphic rotate left",
  rotr: "Homomorphic rotate right",

  // Conditional Logic
  select:
    "Encrypted if-then-else: select(cond, a, b) → returns a if true, b if false",

  // Random Number Generation
  randEbool: "Generates random encrypted boolean",
  randEuint8: "Generates random encrypted 8-bit integer",
  randEuint16: "Generates random encrypted 16-bit integer",
  randEuint32: "Generates random encrypted 32-bit integer",
  randEuint64: "Generates random encrypted 64-bit integer",
  randEuint128: "Generates random encrypted 128-bit integer",
  randEuint256: "Generates random encrypted 256-bit integer",

  // Access Control
  allow: "Grants PERMANENT permission for address to decrypt/use value",
  allowThis: "Grants contract permission to operate on ciphertext",
  allowTransient: "Grants TEMPORARY permission (expires at tx end)",
  isAllowed: "Checks if address has permission to use ciphertext",
  isSenderAllowed: "Checks if msg.sender has permission",

  // Decryption
  makePubliclyDecryptable: "Marks ciphertext for public decryption via relayer",
  isPubliclyDecryptable: "Checks if ciphertext is publicly decryptable",
  checkSignatures: "Verifies KMS decryption proof (reverts if invalid)",
  toBytes32: "Converts encrypted handle to bytes32 for proof arrays",

  // Utility
  cleanTransientStorage:
    "Clears transient permissions (for AA bundled UserOps)",
};

/**
 * Extracts FHE function names used in contract
 */
export function extractFHEFunctions(contractContent: string): string[] {
  const pattern = /FHE\.([a-zA-Z0-9]+)\s*[(<]/g;
  const matches = new Set<string>();
  let match;
  while ((match = pattern.exec(contractContent)) !== null) {
    if (FHE_FUNCTION_DESCRIPTIONS[match[1]]) {
      matches.add(match[1]);
    }
  }
  return Array.from(matches).sort();
}

/**
 * Extracts FHE types used in contract (from imports and declarations)
 */
export function extractFHETypes(contractContent: string): string[] {
  const pattern =
    /\b(ebool|euint(?:8|16|32|64|128|256)|eaddress|externalEbool|externalEuint(?:8|16|32|64|128|256)|externalEaddress)\b/g;
  const matches = new Set<string>();
  let match;
  while ((match = pattern.exec(contractContent)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches).sort();
}

/**
 * Generates FHE API Reference markdown section (collapsible format)
 */
export function generateFHEApiSection(
  functions: string[],
  types: string[]
): string {
  if (functions.length === 0 && types.length === 0) return "";

  const totalCount = functions.length + types.length;
  let section = `<details>\n`;
  section += `<summary>🔐 FHE API Reference (${totalCount} items)</summary>\n\n`;

  // Types
  if (types.length > 0) {
    section += `**Types:** ${types.map((t) => `\`${t}\``).join(" · ")}\n\n`;
  }

  // Functions as list
  if (functions.length > 0) {
    section += `**Functions:**\n`;
    for (const f of functions) {
      section += `- \`FHE.${f}()\` - ${FHE_FUNCTION_DESCRIPTIONS[f]}\n`;
    }
    section += `\n`;
  }

  section += `</details>\n\n`;

  return section;
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

  // Extract and add FHE API Reference section
  const fheFunctions = extractFHEFunctions(contractContent);
  const fheTypes = extractFHETypes(contractContent);
  markdown += generateFHEApiSection(fheFunctions, fheTypes);

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

  // Remove minimatch override (causes ESM/CommonJS conflict with rimraf's glob)
  if (packageJson.overrides?.minimatch) {
    delete packageJson.overrides.minimatch;
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
    const fullCommand = [cmd, ...args].join(" ");
    const child = spawn(fullCommand, [], {
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

    const fullCommand = [cmd, ...args].join(" ");
    const proc = spawn(fullCommand, [], {
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
