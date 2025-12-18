import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";
import { EXAMPLES } from "./config.js";
import { downloadFileFromGitHub, getContractName } from "./utils.js";

// =============================================================================
// PROJECT DETECTION
// =============================================================================

/**
 * Detects if the target directory is a valid Hardhat project
 */
export function detectHardhatProject(targetDir: string): boolean {
  const packageJsonPath = path.join(targetDir, "package.json");
  const hardhatConfigTs = path.join(targetDir, "hardhat.config.ts");
  const hardhatConfigJs = path.join(targetDir, "hardhat.config.js");

  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const hasHardhat =
      packageJson.dependencies?.hardhat || packageJson.devDependencies?.hardhat;

    const hasConfig =
      fs.existsSync(hardhatConfigTs) || fs.existsSync(hardhatConfigJs);

    return !!(hasHardhat && hasConfig);
  } catch {
    return false;
  }
}

// =============================================================================
// DEPENDENCY MANAGEMENT
// =============================================================================

/**
 * Updates package.json with FHEVM dependencies
 */
export function updatePackageJson(targetDir: string): void {
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  // Add dependencies
  packageJson.dependencies = {
    ...packageJson.dependencies,
    "encrypted-types": "^0.0.4",
    "@fhevm/solidity": "^0.9.1",
  };

  // Add devDependencies
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    "@fhevm/hardhat-plugin": "^0.3.0-1",
    "@zama-fhe/relayer-sdk": "^0.3.0-5",
  };

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n"
  );
}

// =============================================================================
// HARDHAT CONFIG UPDATE
// =============================================================================

/**
 * Updates hardhat.config.ts/js with FHEVM plugin import
 */
export function updateHardhatConfig(targetDir: string): void {
  const configPathTs = path.join(targetDir, "hardhat.config.ts");
  const configPathJs = path.join(targetDir, "hardhat.config.js");

  const actualPath = fs.existsSync(configPathTs)
    ? configPathTs
    : fs.existsSync(configPathJs)
    ? configPathJs
    : null;

  if (!actualPath) {
    throw new Error("hardhat.config.ts or hardhat.config.js not found");
  }

  let content = fs.readFileSync(actualPath, "utf-8");

  // Check if already has FHEVM plugin
  if (content.includes("@fhevm/hardhat-plugin")) {
    return; // Already configured
  }

  // Add import at the top (after other imports)
  const importStatement = 'import "@fhevm/hardhat-plugin";\n';

  // Find the last import statement
  const lines = content.split("\n");
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("import ") || trimmed.startsWith('import "')) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, importStatement);
  } else {
    // No imports found, add at the beginning
    lines.unshift(importStatement);
  }

  content = lines.join("\n");
  fs.writeFileSync(actualPath, content);
}

// =============================================================================
// FILE ADDITION
// =============================================================================

/**
 * Adds example contract and test files to the project
 */
export async function addExampleFiles(
  exampleName: string,
  targetDir: string
): Promise<void> {
  const example = EXAMPLES[exampleName];
  if (!example) {
    throw new Error(`Unknown example: ${exampleName}`);
  }

  const contractName = getContractName(example.contract);
  if (!contractName) {
    throw new Error("Could not extract contract name");
  }

  // Handle contract file
  let contractDest = path.join(targetDir, "contracts", `${contractName}.sol`);

  if (fs.existsSync(contractDest)) {
    const action = await p.select({
      message: `${contractName}.sol already exists. What do you want to do?`,
      options: [
        { value: "skip", label: "Skip contract" },
        { value: "overwrite", label: "Overwrite existing file" },
        {
          value: "rename",
          label: `Rename to ${contractName}_fhevm.sol`,
        },
      ],
    });

    if (p.isCancel(action)) {
      throw new Error("Operation cancelled");
    }

    if (action === "skip") {
      p.log.info(`Skipped: ${contractName}.sol`);
    } else if (action === "rename") {
      contractDest = path.join(
        targetDir,
        "contracts",
        `${contractName}_fhevm.sol`
      );
      await downloadFileFromGitHub(example.contract, contractDest);
      p.log.success(`Added: ${contractName}_fhevm.sol`);
    } else {
      await downloadFileFromGitHub(example.contract, contractDest);
      p.log.success(`Overwritten: ${contractName}.sol`);
    }
  } else {
    // Ensure contracts directory exists
    const contractsDir = path.join(targetDir, "contracts");
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }
    await downloadFileFromGitHub(example.contract, contractDest);
    p.log.success(`Added: ${contractName}.sol`);
  }

  // Handle test file
  const testFileName = path.basename(example.test);
  let testDest = path.join(targetDir, "test", testFileName);

  if (fs.existsSync(testDest)) {
    const action = await p.select({
      message: `${testFileName} already exists. What do you want to do?`,
      options: [
        { value: "skip", label: "Skip test" },
        { value: "overwrite", label: "Overwrite existing file" },
      ],
    });

    if (p.isCancel(action)) {
      throw new Error("Operation cancelled");
    }

    if (action === "skip") {
      p.log.info(`Skipped: ${testFileName}`);
    } else {
      await downloadFileFromGitHub(example.test, testDest);
      p.log.success(`Overwritten: ${testFileName}`);
    }
  } else {
    // Ensure test directory exists
    const testDir = path.join(targetDir, "test");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    await downloadFileFromGitHub(example.test, testDest);
    p.log.success(`Added: ${testFileName}`);
  }

  // Handle contract dependencies
  if (example.dependencies) {
    p.log.message("");
    p.log.message(pc.bold("Downloading contract dependencies..."));

    for (const depPath of example.dependencies) {
      const relativePath = depPath.replace(/^contracts\//, "");
      const depDestPath = path.join(targetDir, "contracts", relativePath);
      const depDestDir = path.dirname(depDestPath);
      const depName = path.basename(depPath);

      // Create directory if needed
      if (!fs.existsSync(depDestDir)) {
        fs.mkdirSync(depDestDir, { recursive: true });
      }

      if (fs.existsSync(depDestPath)) {
        p.log.info(`Skipped (exists): ${depName}`);
      } else {
        await downloadFileFromGitHub(depPath, depDestPath);
        p.log.success(`Added: ${depName}`);
      }
    }
  }

  // Handle npm dependencies
  if (example.npmDependencies) {
    p.log.message("");
    p.log.message(pc.bold("Adding npm dependencies to package.json..."));

    const packageJsonPath = path.join(targetDir, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    let added = false;
    for (const [pkg, version] of Object.entries(example.npmDependencies)) {
      if (!packageJson.dependencies[pkg]) {
        packageJson.dependencies[pkg] = version;
        p.log.success(`Added: ${pkg}@${version}`);
        added = true;
      } else {
        p.log.info(`Skipped (exists): ${pkg}`);
      }
    }

    if (added) {
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n"
      );
    }
  }
}

// =============================================================================
// MAIN ADD MODE FUNCTION
// =============================================================================

/**
 * Main function to add FHEVM capabilities to an existing Hardhat project
 */
export async function runAddMode(targetDir?: string): Promise<void> {
  console.clear();
  p.intro(pc.bgCyan(pc.black(" ⚡ FHEVM Example Factory - Add Mode ")));

  // Determine target directory
  const projectDir = targetDir || process.cwd();
  const absoluteDir = path.resolve(projectDir);

  // Step 1: Detect Hardhat project
  const s = p.spinner();
  s.start("Detecting Hardhat project...");

  if (!detectHardhatProject(absoluteDir)) {
    s.stop(pc.red("✗ Not a valid Hardhat project"));
    p.log.error("This directory does not contain a valid Hardhat project.");
    p.log.message(
      pc.dim(
        "Make sure package.json and hardhat.config.ts/js exist and hardhat is installed."
      )
    );
    process.exit(1);
  }

  s.stop(pc.green("✓ Valid Hardhat project detected"));

  // Step 2: Select example
  const exampleName = await p.select({
    message: "Which FHEVM example would you like to add?",
    options: Object.entries(EXAMPLES).map(([key, config]) => ({
      value: key,
      label: config.title,
      hint: config.category,
    })),
  });

  if (p.isCancel(exampleName)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  p.log.message("");

  // Step 3: Update package.json
  s.start("Updating package.json with FHEVM dependencies...");
  try {
    updatePackageJson(absoluteDir);
    s.stop(pc.green("✓ package.json updated"));
  } catch (error) {
    s.stop(pc.red("✗ Failed to update package.json"));
    throw error;
  }

  // Step 4: Update hardhat.config
  s.start("Updating hardhat.config with FHEVM plugin...");
  try {
    updateHardhatConfig(absoluteDir);
    s.stop(pc.green("✓ hardhat.config updated"));
  } catch (error) {
    s.stop(pc.red("✗ Failed to update hardhat.config"));
    throw error;
  }

  // Step 5: Add example files
  p.log.message("");
  p.log.message(pc.bold("Adding example files..."));
  try {
    await addExampleFiles(exampleName as string, absoluteDir);
  } catch (error) {
    p.log.error("Failed to add example files");
    throw error;
  }

  // Success!
  p.log.message("");
  p.log.success(pc.green("✨ FHEVM capabilities added successfully!"));
  p.log.message("");

  p.note(
    `${pc.dim("$")} npm install\n${pc.dim("$")} npm run compile\n${pc.dim(
      "$"
    )} npm run test`,
    "🚀 Next Steps"
  );

  p.outro(pc.green("✅ Setup complete. Happy encrypting!"));
}
