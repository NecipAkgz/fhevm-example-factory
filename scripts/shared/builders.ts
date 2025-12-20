/**
 * Project Builders - Core logic for scaffolding FHEVM projects.
 *
 * Handles the creation of single example projects, category-based
 * project bundles, and specialized test environments.
 */

import * as fs from "fs";
import * as path from "path";
import { EXAMPLES, CATEGORIES } from "./config";
import {
  TEMPLATE_DIR_NAME,
  copyDirectoryRecursive,
  getContractName,
  getRootDir,
  getTemplateDir,
  TEST_TYPES_CONTENT,
} from "./utils";
import {
  downloadFileFromGitHub,
  runCommand,
  generateDeployScript,
  cleanupTemplate,
  updateProjectPackageJson,
} from "./generators";

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
// Project Scaffolding
// =============================================================================

/**
 * Creates a single example project from the template
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

  // 1. Copy template and clean up
  copyDirectoryRecursive(templateDir, outputDir);
  cleanupTemplate(outputDir);

  // 2. Download example contract and dependencies
  await downloadFileFromGitHub(
    example.contract,
    path.join(outputDir, "contracts", `${contractName}.sol`)
  );

  if (example.dependencies) {
    await downloadDependencies(example.dependencies, outputDir);
  }

  // 3. Download test file
  await downloadFileFromGitHub(
    example.test,
    path.join(outputDir, "test", path.basename(example.test))
  );

  // 4. Update deploy script and package.json
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

  await initGitRepo(outputDir);
}

/**
 * Creates a category project with multiple examples
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

  // 1. Copy template and clean up
  copyDirectoryRecursive(templateDir, outputDir);
  cleanupTemplate(outputDir);

  // 2. Download all contracts and tests
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

  // 3. Collect and download dependencies
  const allDependencies = new Set<string>();
  const allNpmDependencies: Record<string, string> = {};

  for (const [exampleName, exampleConfig] of Object.entries(EXAMPLES)) {
    // Check if example belongs to this category
    const configCategoryLower = exampleConfig.category
      .toLowerCase()
      .replace(/\s+/g, "");
    if (
      configCategoryLower === categoryName ||
      exampleConfig.category === category.name.replace(" Examples", "")
    ) {
      if (exampleConfig.dependencies) {
        exampleConfig.dependencies.forEach((dep) => allDependencies.add(dep));
      }
      if (exampleConfig.npmDependencies) {
        Object.assign(allNpmDependencies, exampleConfig.npmDependencies);
      }
    }
  }

  if (allDependencies.size > 0) {
    await downloadDependencies(Array.from(allDependencies), outputDir);
  }

  // 4. Update package.json
  updateProjectPackageJson(
    outputDir,
    `fhevm-examples-${categoryName}`,
    undefined,
    allNpmDependencies
  );

  await initGitRepo(outputDir);
}

// =============================================================================
// Specialized Builders
// =============================================================================

/**
 * Creates a temporary test project using LOCAL files (used by maintenance.ts)
 */
export async function createLocalTestProject(
  exampleNames: string[],
  outputDir: string
): Promise<void> {
  const rootDir = getRootDir();
  const templateDir = getTemplateDir();

  // 1. Setup base project from local template
  copyDirectoryRecursive(templateDir, outputDir);
  cleanupTemplate(outputDir);

  const allNpmDeps: Record<string, string> = {};
  const allContractDeps = new Set<string>();

  // 2. Copy local example files
  for (const exampleName of exampleNames) {
    const example = EXAMPLES[exampleName];
    if (!example) continue;

    const contractPath = path.join(rootDir, example.contract);
    const testPath = path.join(rootDir, example.test);

    if (fs.existsSync(contractPath)) {
      const contractName = getContractName(example.contract);
      if (contractName) {
        fs.copyFileSync(
          contractPath,
          path.join(outputDir, "contracts", `${contractName}.sol`)
        );
      }
    }

    if (fs.existsSync(testPath)) {
      fs.copyFileSync(
        testPath,
        path.join(outputDir, "test", path.basename(example.test))
      );
    }

    if (example.dependencies) {
      example.dependencies.forEach((dep) => allContractDeps.add(dep));
    }
    if (example.npmDependencies) {
      Object.assign(allNpmDeps, example.npmDependencies);
    }
  }

  // 3. Copy dependencies
  for (const depPath of allContractDeps) {
    const depFullPath = path.join(rootDir, depPath);
    if (fs.existsSync(depFullPath)) {
      const relativePath = depPath.replace(/^contracts\//, "");
      const depDestPath = path.join(outputDir, "contracts", relativePath);
      const depDestDir = path.dirname(depDestPath);

      if (!fs.existsSync(depDestDir)) {
        fs.mkdirSync(depDestDir, { recursive: true });
      }
      fs.copyFileSync(depFullPath, depDestPath);
    }
  }

  // 4. Finalize project
  updateProjectPackageJson(
    outputDir,
    "fhevm-test-project",
    `Testing ${exampleNames.length} examples`,
    Object.keys(allNpmDeps).length > 0 ? allNpmDeps : undefined
  );

  const typesPath = path.join(outputDir, "test", "types.ts");
  if (!fs.existsSync(typesPath)) {
    fs.writeFileSync(typesPath, TEST_TYPES_CONTENT);
  }
}
