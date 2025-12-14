/**
 * Project Builders
 *
 * Creates single example and category projects from templates.
 * Similar to main project's create-example.ts and create-category.ts
 */

import * as fs from "fs";
import * as path from "path";
import { EXAMPLES, CATEGORIES } from "./config.js";
import {
  copyDirectoryRecursive,
  getContractName,
  downloadFileFromGitHub,
  runCommand,
  generateDeployScript,
} from "./utils.js";
import { TEST_TYPES_CONTENT } from "./utils.js";

// =============================================================================
// Template Cleanup
// =============================================================================

/**
 * Cleans up template-specific files after copying
 * Similar to cleanupTemplate() in main project's shared/utils.ts
 */
export function cleanupTemplate(outputDir: string): void {
  // Remove .git directory
  const gitDir = path.join(outputDir, ".git");
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  // Remove FHECounter.sol (template example)
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

  // Remove FHECounter task import from hardhat.config.ts
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

  // Create test/types.ts for type safety
  fs.writeFileSync(
    path.join(outputDir, "test", "types.ts"),
    TEST_TYPES_CONTENT
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Downloads contract dependencies to the output directory
 */
async function downloadDependencies(
  dependencies: string[],
  outputDir: string
): Promise<void> {
  for (const depPath of dependencies) {
    const relativePath = depPath.replace(/^contracts\//, "");
    const depDestPath = path.join(outputDir, "contracts", relativePath);
    const depDestDir = path.dirname(depDestPath);

    if (!fs.existsSync(depDestDir)) {
      fs.mkdirSync(depDestDir, { recursive: true });
    }

    await downloadFileFromGitHub(depPath, depDestPath);
  }
}

/**
 * Updates package.json with project name, description, and npm dependencies
 */
function updatePackageJson(
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

/**
 * Initializes git repository (optional, fails silently)
 */
async function initGitRepo(outputDir: string): Promise<void> {
  try {
    await runCommand("git", ["init"], outputDir);
  } catch (error) {
    // Git init is optional
  }
}

// =============================================================================
// Single Example Builder
// =============================================================================

/**
 * Creates a single example project from the template
 *
 * Steps:
 * 1. Copy template directory and clean up
 * 2. Download contract and test files from GitHub
 * 3. Update package.json and deploy scripts
 */
export async function createSingleExample(
  exampleName: string,
  outputDir: string,
  tempRepoPath: string
): Promise<void> {
  const example = EXAMPLES[exampleName];
  if (!example) {
    throw new Error(`Unknown example: ${exampleName}`);
  }

  const templateDir = path.join(tempRepoPath, "fhevm-hardhat-template");
  const contractName = getContractName(example.contract);
  if (!contractName) {
    throw new Error("Could not extract contract name");
  }

  // Step 1: Copy template and clean up
  copyDirectoryRecursive(templateDir, outputDir);
  cleanupTemplate(outputDir);

  // Step 2: Download example contract
  await downloadFileFromGitHub(
    example.contract,
    path.join(outputDir, "contracts", `${contractName}.sol`)
  );

  // Download contract dependencies if specified
  if (example.dependencies) {
    await downloadDependencies(example.dependencies, outputDir);
  }

  // Step 3: Download test file
  await downloadFileFromGitHub(
    example.test,
    path.join(outputDir, "test", path.basename(example.test))
  );

  // Step 4: Update deploy script and package.json
  fs.writeFileSync(
    path.join(outputDir, "deploy", "deploy.ts"),
    generateDeployScript(contractName)
  );

  updatePackageJson(
    outputDir,
    `fhevm-example-${exampleName}`,
    example.description,
    example.npmDependencies
  );

  // Initialize git repository
  await initGitRepo(outputDir);
}

// =============================================================================
// Category Project Builder
// =============================================================================

/**
 * Creates a category project with multiple examples
 *
 * Steps:
 * 1. Copy template directory and clean up
 * 2. Download all contracts and tests for the category
 * 3. Update package.json
 */
export async function createCategoryProject(
  categoryName: string,
  outputDir: string,
  tempRepoPath: string
): Promise<void> {
  const category = CATEGORIES[categoryName];
  if (!category) {
    throw new Error(`Unknown category: ${categoryName}`);
  }

  const templateDir = path.join(tempRepoPath, "fhevm-hardhat-template");

  // Step 1: Copy template and clean up
  copyDirectoryRecursive(templateDir, outputDir);
  cleanupTemplate(outputDir);

  // Step 2: Download all contracts and tests
  for (const item of category.contracts) {
    const contractName = getContractName(item.sol);
    if (contractName) {
      await downloadFileFromGitHub(
        item.sol,
        path.join(outputDir, "contracts", `${contractName}.sol`)
      );
    }

    if (item.test) {
      await downloadFileFromGitHub(
        item.test,
        path.join(outputDir, "test", path.basename(item.test))
      );
    }
  }

  // Collect dependencies from all examples in this category
  const allDependencies = new Set<string>();
  const allNpmDependencies: Record<string, string> = {};

  for (const [exampleName, exampleConfig] of Object.entries(EXAMPLES)) {
    if (exampleConfig.category === category.name.replace(" Examples", "")) {
      if (exampleConfig.dependencies) {
        exampleConfig.dependencies.forEach((dep) => allDependencies.add(dep));
      }
      if (exampleConfig.npmDependencies) {
        Object.assign(allNpmDependencies, exampleConfig.npmDependencies);
      }
    }
  }

  // Download all collected dependencies
  if (allDependencies.size > 0) {
    await downloadDependencies(Array.from(allDependencies), outputDir);
  }

  // Step 3: Update package.json
  updatePackageJson(
    outputDir,
    `fhevm-examples-${categoryName}`,
    undefined,
    allNpmDependencies
  );

  // Initialize git repository
  await initGitRepo(outputDir);
}
