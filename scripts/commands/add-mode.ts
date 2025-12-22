/**
 * Add Mode - Feature for adding FHEVM to existing Hardhat projects.
 *
 * Logic for managing configuration updates, dependency installations,
 * and scaffolding example contracts into established projects.
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";
import { EXAMPLES } from "../shared/config";
import {
  getContractName,
  FHEVM_DEPENDENCIES,
  getRootDir,
  ERROR_MESSAGES,
} from "../shared/utils";

// =============================================================================
// PROJECT DETECTION
// =============================================================================

/**
 * Detects if the target directory is a valid Hardhat project
 */
function detectHardhatProject(targetDir: string): boolean {
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
function updatePackageJson(targetDir: string): void {
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  packageJson.dependencies = {
    ...packageJson.dependencies,
    ...FHEVM_DEPENDENCIES.dependencies,
  };

  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    ...FHEVM_DEPENDENCIES.devDependencies,
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
function updateHardhatConfig(targetDir: string): void {
  const configPathTs = path.join(targetDir, "hardhat.config.ts");
  const configPathJs = path.join(targetDir, "hardhat.config");

  const actualPath = fs.existsSync(configPathTs)
    ? configPathTs
    : fs.existsSync(configPathJs)
    ? configPathJs
    : null;

  if (!actualPath) {
    throw new Error(ERROR_MESSAGES.CONFIG_NOT_FOUND);
  }

  let content = fs.readFileSync(actualPath, "utf-8");

  if (content.includes("@fhevm/hardhat-plugin")) {
    return;
  }

  const importStatement = 'import "@fhevm/hardhat-plugin";\n';
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
function addExampleFiles(exampleName: string, targetDir: string): void {
  const example = EXAMPLES[exampleName];
  if (!example) {
    throw new Error(ERROR_MESSAGES.UNKNOWN_EXAMPLE(exampleName));
  }

  const rootDir = getRootDir();
  const contractName = getContractName(example.contract);
  if (!contractName) {
    throw new Error(ERROR_MESSAGES.CONTRACT_NAME_FAILED);
  }

  const contractSource = path.join(rootDir, example.contract);
  const testSource = path.join(rootDir, example.test);

  // Handle contract file
  let contractDest = path.join(targetDir, "contracts", `${contractName}.sol`);
  const contractsDir = path.join(targetDir, "contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  const isContractOverwrite = fs.existsSync(contractDest);
  fs.copyFileSync(contractSource, contractDest);
  p.log.success(
    `${isContractOverwrite ? "Overwritten" : "Added"}: ${contractName}.sol`
  );

  // Handle test file
  const testFileName = path.basename(example.test);
  const testDest = path.join(targetDir, "test", testFileName);
  const testDir = path.join(targetDir, "test");

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const isTestOverwrite = fs.existsSync(testDest);
  fs.copyFileSync(testSource, testDest);
  p.log.success(
    `${isTestOverwrite ? "Overwritten" : "Added"}: ${testFileName}`
  );

  // Handle contract dependencies
  if (example.dependencies) {
    p.log.message("");
    p.log.message(pc.bold("Copying contract dependencies..."));

    for (const depPath of example.dependencies) {
      const depSource = path.join(rootDir, depPath);
      const relativePath = depPath.replace(/^contracts\//, "");
      const depDestPath = path.join(targetDir, "contracts", relativePath);
      const depDestDir = path.dirname(depDestPath);
      const depName = path.basename(depPath);

      if (!fs.existsSync(depDestDir)) {
        fs.mkdirSync(depDestDir, { recursive: true });
      }

      if (fs.existsSync(depDestPath)) {
        p.log.info(`Skipped (exists): ${depName}`);
      } else if (fs.existsSync(depSource)) {
        fs.copyFileSync(depSource, depDestPath);
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

  const projectDir = targetDir || process.cwd();
  const absoluteDir = path.resolve(projectDir);

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

  s.start("Updating package.json with FHEVM dependencies...");
  try {
    updatePackageJson(absoluteDir);
    s.stop(pc.green("✓ package.json updated"));
  } catch (error) {
    s.stop(pc.red("✗ Failed to update package.json"));
    throw error;
  }

  s.start("Updating hardhat.config with FHEVM plugin...");
  try {
    updateHardhatConfig(absoluteDir);
    s.stop(pc.green("✓ hardhat.config updated"));
  } catch (error) {
    s.stop(pc.red("✗ Failed to update hardhat.config"));
    throw error;
  }

  p.log.message("");
  p.log.message(pc.bold("Adding example files..."));
  try {
    addExampleFiles(exampleName as string, absoluteDir);
  } catch (error) {
    p.log.error("Failed to add example files");
    throw error;
  }

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
