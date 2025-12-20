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
  copyDirectoryRecursive,
  getContractName,
  getRootDir,
  getTemplateDir,
  TEST_TYPES_CONTENT,
} from "./utils";
import {
  generateDeployScript,
  cleanupTemplate,
  updateProjectPackageJson,
} from "./generators";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Copies contract dependencies from package to output directory
 */
function copyDependencies(dependencies: string[], outputDir: string): void {
  const rootDir = getRootDir();
  for (const depPath of dependencies) {
    const sourcePath = path.join(rootDir, depPath);
    const relativePath = depPath.replace(/^contracts\//, "");
    const depDestPath = path.join(outputDir, "contracts", relativePath);
    const depDestDir = path.dirname(depDestPath);

    if (!fs.existsSync(depDestDir)) {
      fs.mkdirSync(depDestDir, { recursive: true });
    }

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, depDestPath);
    }
  }
}

/**
 * Initializes git repository (optional, fails silently)
 */
function initGitRepo(outputDir: string): void {
  try {
    require("child_process").execSync("git init", {
      cwd: outputDir,
      stdio: "ignore",
    });
  } catch {
    // Git init is optional
  }
}

// =============================================================================
// Project Scaffolding
// =============================================================================

/**
 * Creates a single example project from the template
 */
export function createSingleExample(
  exampleName: string,
  outputDir: string
): void {
  const example = EXAMPLES[exampleName];
  if (!example) {
    throw new Error(`Unknown example: ${exampleName}`);
  }

  const rootDir = getRootDir();
  const templateDir = getTemplateDir();
  const contractName = getContractName(example.contract);
  if (!contractName) {
    throw new Error("Could not extract contract name");
  }

  // 1. Copy template and clean up
  copyDirectoryRecursive(templateDir, outputDir);
  cleanupTemplate(outputDir);

  // 2. Copy example contract from package
  const contractSource = path.join(rootDir, example.contract);
  fs.copyFileSync(
    contractSource,
    path.join(outputDir, "contracts", `${contractName}.sol`)
  );

  // 3. Copy dependencies
  if (example.dependencies) {
    copyDependencies(example.dependencies, outputDir);
  }

  // 4. Copy test file
  const testSource = path.join(rootDir, example.test);
  fs.copyFileSync(
    testSource,
    path.join(outputDir, "test", path.basename(example.test))
  );

  // 5. Update deploy script and package.json
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

  initGitRepo(outputDir);
}

/**
 * Creates a category project with multiple examples
 */
export function createCategoryProject(
  categoryName: string,
  outputDir: string
): void {
  const category = CATEGORIES[categoryName];
  if (!category) {
    throw new Error(`Unknown category: ${categoryName}`);
  }

  const rootDir = getRootDir();
  const templateDir = getTemplateDir();

  // 1. Copy template and clean up
  copyDirectoryRecursive(templateDir, outputDir);
  cleanupTemplate(outputDir);

  // 2. Copy all contracts and tests from package
  for (const item of category.contracts) {
    const contractName = getContractName(item.sol);
    if (contractName) {
      const contractSource = path.join(rootDir, item.sol);
      if (fs.existsSync(contractSource)) {
        fs.copyFileSync(
          contractSource,
          path.join(outputDir, "contracts", `${contractName}.sol`)
        );
      }
    }

    if (item.test) {
      const testSource = path.join(rootDir, item.test);
      if (fs.existsSync(testSource)) {
        fs.copyFileSync(
          testSource,
          path.join(outputDir, "test", path.basename(item.test))
        );
      }
    }
  }

  // 3. Collect and copy dependencies
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
    copyDependencies(Array.from(allDependencies), outputDir);
  }

  // 4. Update package.json
  updateProjectPackageJson(
    outputDir,
    `fhevm-examples-${categoryName}`,
    undefined,
    allNpmDependencies
  );

  initGitRepo(outputDir);
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
