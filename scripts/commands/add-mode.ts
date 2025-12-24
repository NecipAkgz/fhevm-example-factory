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

interface DetectionResult {
  isValid: boolean;
  error?: string;
}

interface RollbackState {
  originalPackageJson?: string;
  originalHardhatConfig?: string;
  createdFiles: string[];
  createdDirs: string[];
}

const BACKUP_SUFFIX = ".backup";

// =============================================================================
// PROJECT DETECTION
// =============================================================================

/**
 * Detects if the target directory is a valid Hardhat project
 * Returns detailed error information for better user feedback
 */
function detectHardhatProject(targetDir: string): DetectionResult {
  const packageJsonPath = path.join(targetDir, "package.json");
  const hardhatConfigTs = path.join(targetDir, "hardhat.config.ts");
  const hardhatConfigJs = path.join(targetDir, "hardhat.config.js");

  if (!fs.existsSync(packageJsonPath)) {
    return {
      isValid: false,
      error: "package.json not found in the directory",
    };
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const hasHardhat =
      packageJson.dependencies?.hardhat || packageJson.devDependencies?.hardhat;

    if (!hasHardhat) {
      return {
        isValid: false,
        error: "Hardhat is not listed in dependencies or devDependencies",
      };
    }

    const hasConfig =
      fs.existsSync(hardhatConfigTs) || fs.existsSync(hardhatConfigJs);

    if (!hasConfig) {
      return {
        isValid: false,
        error: "hardhat.config.ts or hardhat.config.js not found",
      };
    }

    return { isValid: true };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    return {
      isValid: false,
      error: `Failed to parse package.json: ${errorMessage}`,
    };
  }
}

// =============================================================================
// DEPENDENCY MANAGEMENT
// =============================================================================

/**
 * Checks for potential dependency conflicts
 * Returns list of packages that would be overwritten with different versions
 */
function checkDependencyConflicts(
  targetDir: string
): Array<{ pkg: string; existing: string; new: string }> {
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const conflicts: Array<{ pkg: string; existing: string; new: string }> = [];

  const allDeps = {
    ...FHEVM_DEPENDENCIES.dependencies,
    ...FHEVM_DEPENDENCIES.devDependencies,
  };

  const existingDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const [pkg, newVersion] of Object.entries(allDeps)) {
    if (existingDeps[pkg] && existingDeps[pkg] !== newVersion) {
      conflicts.push({
        pkg,
        existing: existingDeps[pkg],
        new: newVersion as string,
      });
    }
  }

  return conflicts;
}

/**
 * Updates package.json with FHEVM dependencies
 * Preserves existing versions if specified
 */
function updatePackageJson(
  targetDir: string,
  preserveExisting: boolean = false
): string {
  const packageJsonPath = path.join(targetDir, "package.json");
  const originalContent = fs.readFileSync(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(originalContent);

  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  // Add FHEVM dependencies
  for (const [pkg, version] of Object.entries(
    FHEVM_DEPENDENCIES.dependencies
  )) {
    if (!preserveExisting || !packageJson.dependencies[pkg]) {
      packageJson.dependencies[pkg] = version;
    }
  }

  for (const [pkg, version] of Object.entries(
    FHEVM_DEPENDENCIES.devDependencies
  )) {
    if (!preserveExisting || !packageJson.devDependencies[pkg]) {
      packageJson.devDependencies[pkg] = version;
    }
  }

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n"
  );

  return originalContent;
}

// =============================================================================
// HARDHAT CONFIG UPDATE
// =============================================================================

/**
 * Gets the hardhat config file path
 */
function getHardhatConfigPath(targetDir: string): string | null {
  const configPathTs = path.join(targetDir, "hardhat.config.ts");
  const configPathJs = path.join(targetDir, "hardhat.config.js");

  if (fs.existsSync(configPathTs)) {
    return configPathTs;
  }
  if (fs.existsSync(configPathJs)) {
    return configPathJs;
  }
  return null;
}

/**
 * Updates hardhat.config.ts/js with FHEVM plugin import
 * Uses safer import detection logic
 */
function updateHardhatConfig(targetDir: string): string | null {
  const actualPath = getHardhatConfigPath(targetDir);

  if (!actualPath) {
    throw new Error(ERROR_MESSAGES.CONFIG_NOT_FOUND);
  }

  const originalContent = fs.readFileSync(actualPath, "utf-8");

  // Already has the import
  if (originalContent.includes("@fhevm/hardhat-plugin")) {
    return null;
  }

  const importStatement = 'import "@fhevm/hardhat-plugin";\n';
  const lines = originalContent.split("\n");
  let lastImportIndex = -1;

  // More robust import detection - handles various import formats
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      continue;
    }

    // Match various import patterns
    const isImport =
      trimmed.startsWith("import ") ||
      trimmed.startsWith('import "') ||
      trimmed.startsWith("import '") ||
      trimmed.startsWith("import{") ||
      trimmed.startsWith("import *");

    if (isImport) {
      // Handle multi-line imports - find the closing line
      let currentLine = i;
      while (
        currentLine < lines.length &&
        !lines[currentLine].includes(";") &&
        !lines[currentLine].includes("from")
      ) {
        currentLine++;
      }
      lastImportIndex = currentLine;
      i = currentLine;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, importStatement);
  } else {
    lines.unshift(importStatement);
  }

  const newContent = lines.join("\n");
  fs.writeFileSync(actualPath, newContent);

  return originalContent;
}

// =============================================================================
// FILE OPERATIONS
// =============================================================================

/**
 * Validates that source files exist before attempting to copy
 */
function validateSourceFiles(
  exampleName: string,
  rootDir: string
): { valid: boolean; errors: string[] } {
  const example = EXAMPLES[exampleName];
  const errors: string[] = [];

  const contractSource = path.join(rootDir, example.contract);
  const testSource = path.join(rootDir, example.test);

  if (!fs.existsSync(contractSource)) {
    errors.push(`Contract source not found: ${example.contract}`);
  }

  if (!fs.existsSync(testSource)) {
    errors.push(`Test source not found: ${example.test}`);
  }

  if (example.dependencies) {
    for (const dep of example.dependencies) {
      const depPath = path.join(rootDir, dep);
      if (!fs.existsSync(depPath)) {
        errors.push(`Dependency not found: ${dep}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Gets list of files that would be overwritten
 */
function getOverwriteList(
  exampleName: string,
  targetDir: string,
  rootDir: string
): string[] {
  const example = EXAMPLES[exampleName];
  const overwrites: string[] = [];

  const contractName = getContractName(example.contract);
  if (contractName) {
    const contractDest = path.join(
      targetDir,
      "contracts",
      `${contractName}.sol`
    );
    if (fs.existsSync(contractDest)) {
      overwrites.push(`contracts/${contractName}.sol`);
    }
  }

  const testFileName = path.basename(example.test);
  const testDest = path.join(targetDir, "test", testFileName);
  if (fs.existsSync(testDest)) {
    overwrites.push(`test/${testFileName}`);
  }

  return overwrites;
}

/**
 * Creates backup of a file
 */
function createBackup(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, filePath + BACKUP_SUFFIX);
  }
}

/**
 * Restores a backup file
 */
function restoreBackup(filePath: string): void {
  const backupPath = filePath + BACKUP_SUFFIX;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);
  }
}

/**
 * Removes backup file
 */
function removeBackup(filePath: string): void {
  const backupPath = filePath + BACKUP_SUFFIX;
  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
  }
}

/**
 * Rollback all changes made during the operation
 */
function rollback(state: RollbackState, targetDir: string): void {
  // Restore original files
  if (state.originalPackageJson) {
    const packageJsonPath = path.join(targetDir, "package.json");
    fs.writeFileSync(packageJsonPath, state.originalPackageJson);
  }

  if (state.originalHardhatConfig) {
    const configPath = getHardhatConfigPath(targetDir);
    if (configPath) {
      fs.writeFileSync(configPath, state.originalHardhatConfig);
    }
  }

  // Remove created files (in reverse order)
  for (const filePath of state.createdFiles.reverse()) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Remove created directories (in reverse order, only if empty)
  for (const dirPath of state.createdDirs.reverse()) {
    if (fs.existsSync(dirPath)) {
      const contents = fs.readdirSync(dirPath);
      if (contents.length === 0) {
        fs.rmdirSync(dirPath);
      }
    }
  }
}

/**
 * Adds example contract and test files to the project
 */
function addExampleFiles(
  exampleName: string,
  targetDir: string,
  rollbackState: RollbackState,
  createBackups: boolean = false
): void {
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
  const contractDest = path.join(targetDir, "contracts", `${contractName}.sol`);
  const contractsDir = path.join(targetDir, "contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
    rollbackState.createdDirs.push(contractsDir);
  }

  const isContractOverwrite = fs.existsSync(contractDest);
  if (isContractOverwrite && createBackups) {
    createBackup(contractDest);
  }
  if (!isContractOverwrite) {
    rollbackState.createdFiles.push(contractDest);
  }

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
    rollbackState.createdDirs.push(testDir);
  }

  const isTestOverwrite = fs.existsSync(testDest);
  if (isTestOverwrite && createBackups) {
    createBackup(testDest);
  }
  if (!isTestOverwrite) {
    rollbackState.createdFiles.push(testDest);
  }

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
        rollbackState.createdDirs.push(depDestDir);
      }

      if (fs.existsSync(depDestPath)) {
        p.log.info(`Skipped (exists): ${depName}`);
      } else if (fs.existsSync(depSource)) {
        fs.copyFileSync(depSource, depDestPath);
        rollbackState.createdFiles.push(depDestPath);
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

  // Step 1: Detect Hardhat project
  s.start("Detecting Hardhat project...");

  const detection = detectHardhatProject(absoluteDir);
  if (!detection.isValid) {
    s.stop(pc.red("✗ Not a valid Hardhat project"));
    p.log.error(ERROR_MESSAGES.NOT_HARDHAT);
    p.log.message(pc.dim(`Reason: ${detection.error}`));
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

  // Step 3: Validate source files exist
  const rootDir = getRootDir();
  const validation = validateSourceFiles(exampleName as string, rootDir);
  if (!validation.valid) {
    p.log.error("Source file validation failed:");
    for (const error of validation.errors) {
      p.log.message(pc.dim(`  - ${error}`));
    }
    process.exit(1);
  }

  // Step 4: Check for file overwrites
  const overwrites = getOverwriteList(
    exampleName as string,
    absoluteDir,
    rootDir
  );
  if (overwrites.length > 0) {
    p.log.warn(pc.yellow("The following files will be overwritten:"));
    for (const file of overwrites) {
      p.log.message(pc.dim(`  - ${file}`));
    }

    const confirmOverwrite = await p.confirm({
      message: "Do you want to continue and overwrite these files?",
      initialValue: false,
    });

    if (p.isCancel(confirmOverwrite) || !confirmOverwrite) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
  }

  // Step 5: Check for dependency conflicts
  const conflicts = checkDependencyConflicts(absoluteDir);
  let preserveExisting = false;

  if (conflicts.length > 0) {
    p.log.warn(pc.yellow("Dependency version conflicts detected:"));
    for (const conflict of conflicts) {
      p.log.message(
        pc.dim(`  - ${conflict.pkg}: ${conflict.existing} → ${conflict.new}`)
      );
    }

    const conflictChoice = await p.select({
      message: "How would you like to handle these conflicts?",
      options: [
        { value: "update", label: "Update to FHEVM versions (recommended)" },
        { value: "preserve", label: "Keep existing versions" },
        { value: "cancel", label: "Cancel operation" },
      ],
    });

    if (p.isCancel(conflictChoice) || conflictChoice === "cancel") {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    preserveExisting = conflictChoice === "preserve";
  }

  // Initialize rollback state
  const rollbackState: RollbackState = {
    createdFiles: [],
    createdDirs: [],
  };

  p.log.message("");

  try {
    // Step 6: Update package.json
    s.start("Updating package.json with FHEVM dependencies...");
    rollbackState.originalPackageJson = updatePackageJson(
      absoluteDir,
      preserveExisting
    );
    s.stop(pc.green("✓ package.json updated"));

    // Step 7: Update hardhat.config
    s.start("Updating hardhat.config with FHEVM plugin...");
    const configPath = getHardhatConfigPath(absoluteDir);
    if (configPath) {
      rollbackState.originalHardhatConfig = fs.readFileSync(
        configPath,
        "utf-8"
      );
    }
    const configChanged = updateHardhatConfig(absoluteDir);
    if (configChanged === null) {
      s.stop(pc.dim("⊘ FHEVM plugin already configured"));
    } else {
      s.stop(pc.green("✓ hardhat.config updated"));
    }

    // Step 8: Add example files
    p.log.message("");
    p.log.message(pc.bold("Adding example files..."));
    addExampleFiles(
      exampleName as string,
      absoluteDir,
      rollbackState,
      overwrites.length > 0
    );

    // Clean up backups on success
    if (overwrites.length > 0) {
      const contractName = getContractName(
        EXAMPLES[exampleName as string].contract
      );
      if (contractName) {
        removeBackup(
          path.join(absoluteDir, "contracts", `${contractName}.sol`)
        );
      }
      const testFileName = path.basename(EXAMPLES[exampleName as string].test);
      removeBackup(path.join(absoluteDir, "test", testFileName));
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
  } catch (error) {
    // Rollback on failure
    p.log.error("An error occurred. Rolling back changes...");
    rollback(rollbackState, absoluteDir);

    // Restore backups if any
    if (overwrites.length > 0) {
      const contractName = getContractName(
        EXAMPLES[exampleName as string].contract
      );
      if (contractName) {
        restoreBackup(
          path.join(absoluteDir, "contracts", `${contractName}.sol`)
        );
      }
      const testFileName = path.basename(EXAMPLES[exampleName as string].test);
      restoreBackup(path.join(absoluteDir, "test", testFileName));
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    p.log.error(`Failed: ${errorMessage}`);
    process.exit(1);
  }
}
