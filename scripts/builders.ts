/**
 * Project Builders
 *
 * Creates single example and category projects from templates.
 */

import * as fs from "fs";
import * as path from "path";
import { EXAMPLES, CATEGORIES } from "./config";
import {
  TEMPLATE_DIR_NAME,
  copyDirectoryRecursive,
  getContractName,
  downloadFileFromGitHub,
  runCommand,
  generateDeployScript,
  cleanupTemplate,
  updateProjectPackageJson,
} from "./utils";

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
 * @param exampleName - Name of the example to create
 * @param outputDir - Target directory for the project
 * @param tempRepoPath - Path to cloned template repository
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

  const templateDir = path.join(tempRepoPath, TEMPLATE_DIR_NAME);
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

  updateProjectPackageJson(
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
 * @param categoryName - Name of the category to create
 * @param outputDir - Target directory for the project
 * @param tempRepoPath - Path to cloned template repository
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

  const templateDir = path.join(tempRepoPath, TEMPLATE_DIR_NAME);

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
  updateProjectPackageJson(
    outputDir,
    `fhevm-examples-${categoryName}`,
    undefined,
    allNpmDependencies
  );

  // Initialize git repository
  await initGitRepo(outputDir);
}
