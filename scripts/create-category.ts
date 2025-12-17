#!/usr/bin/env node

/**
 * Create Category - Category Project Generator
 *
 * Creates a project with multiple FHEVM examples from a category:
 * - Template files from fhevm-hardhat-template
 * - All contracts and tests from selected category
 * - Configured package.json with aggregated dependencies
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";

import { EXAMPLES, CATEGORIES } from "./shared/config";
import {
  getRootDir,
  getContractName,
  copyDirectoryRecursive,
  getTemplateDir,
  cleanupTemplate,
  CATEGORY_ICON,
} from "./shared/utils";
import { runCommand, askInstallAndTest } from "./shared/commands";

// =============================================================================
// Project Builder
// =============================================================================

/**
 * Creates a category project with multiple examples
 */
async function createCategoryProject(
  categoryName: string,
  outputDir: string
): Promise<void> {
  const rootDir = getRootDir();
  const templateDir = getTemplateDir();
  const category = CATEGORIES[categoryName];

  if (!category) {
    throw new Error(`Unknown category: ${categoryName}`);
  }

  // Step 1: Copy template and clean up
  copyDirectoryRecursive(templateDir, outputDir);
  cleanupTemplate(outputDir);

  // Step 2: Copy all contracts and tests for the category
  const allDependencies = new Set<string>();

  for (const item of category.contracts) {
    const solPath = path.join(rootDir, item.sol);
    if (fs.existsSync(solPath)) {
      const contractName = getContractName(item.sol);
      if (contractName) {
        fs.copyFileSync(
          solPath,
          path.join(outputDir, "contracts", `${contractName}.sol`)
        );
      }
    }
    if (item.test) {
      const testPath = path.join(rootDir, item.test);
      if (fs.existsSync(testPath)) {
        fs.copyFileSync(
          testPath,
          path.join(outputDir, "test", path.basename(item.test))
        );
      }
    }

    for (const [exampleName, exampleConfig] of Object.entries(EXAMPLES)) {
      if (exampleConfig.contract === item.sol && exampleConfig.dependencies) {
        exampleConfig.dependencies.forEach((dep) => allDependencies.add(dep));
      }
    }
  }

  // Copy all collected dependencies
  if (allDependencies.size > 0) {
    for (const depPath of allDependencies) {
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
  }

  // Step 3: Update package.json

  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.name = `fhevm-examples-${categoryName}`;

  // Collect npm dependencies from all examples in this category
  const categoryDeps: Record<string, string> = {};
  for (const [exampleName, exampleConfig] of Object.entries(EXAMPLES)) {
    if (category.contracts.some((c) => c.sol === exampleConfig.contract)) {
      if (exampleConfig.npmDependencies) {
        Object.assign(categoryDeps, exampleConfig.npmDependencies);
      }
    }
  }

  if (Object.keys(categoryDeps).length > 0) {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    Object.assign(packageJson.dependencies, categoryDeps);
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Initialize git repository
  try {
    await runCommand("git", ["init"], outputDir);
  } catch (error) {
    // Git init is optional
  }
}

// =============================================================================
// Prompt Helpers
// =============================================================================

/**
 * Prompts user to select a category project
 */
async function promptSelectCategoryProject(): Promise<string | symbol> {
  return p.select({
    message: "Select a category:",
    options: Object.entries(CATEGORIES).map(([key, config]) => ({
      value: key,
      label: `${CATEGORY_ICON} ${config.name}`,
      hint: `${config.contracts.length} contracts`,
    })),
  });
}

// =============================================================================
// Interactive Mode
// =============================================================================

/**
 * Handles the "Create category project" flow
 */
export async function handleInteractiveCategory(): Promise<void> {
  console.clear();
  p.intro(pc.bgCyan(pc.black(" 🔐 Create Category Project ")));

  // Step 1: Select category
  const category = await promptSelectCategoryProject();
  if (p.isCancel(category)) {
    p.cancel("Operation cancelled.");
    return;
  }

  // Step 2: Get project details
  const projectName = await p.text({
    message: "Project name:",
    placeholder: `my-${category}-project`,
    defaultValue: `my-${category}-project`,
  });

  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled.");
    return;
  }

  const outputDir = await p.text({
    message: "Output directory:",
    placeholder: `./output/${projectName}`,
    defaultValue: `./output/${projectName}`,
  });

  if (p.isCancel(outputDir)) {
    p.cancel("Operation cancelled.");
    return;
  }

  const resolvedOutput = path.resolve(process.cwd(), outputDir as string);

  if (fs.existsSync(resolvedOutput)) {
    p.log.error(`Directory already exists: ${resolvedOutput}`);
    return;
  }

  // Step 3: Create project
  const s = p.spinner();
  s.start("Creating category project...");

  try {
    await createCategoryProject(category as string, resolvedOutput);
    s.stop("Project created successfully!");

    const categoryConfig = CATEGORIES[category as string];
    const relativePath = path.relative(process.cwd(), resolvedOutput);

    p.log.success(`📁 Created: ${pc.cyan(relativePath)}`);
    p.log.info(`📦 Category: ${pc.yellow(categoryConfig?.name || category)}`);
    p.log.info(
      `📄 Contracts: ${pc.green(String(categoryConfig?.contracts.length || 0))}`
    );

    await askInstallAndTest(resolvedOutput, relativePath);
    p.outro(pc.green("🎉 Happy coding with FHEVM!"));
  } catch (error) {
    s.stop("Failed to create project");
    p.log.error(error instanceof Error ? error.message : String(error));
  }
}

// =============================================================================
// Direct Mode (CLI)
// =============================================================================

/**
 * Handles direct mode with CLI arguments
 */
export async function handleDirect(args: string[]): Promise<void> {
  const [categoryName, outputDir] = args;

  if (!categoryName) {
    console.error(pc.red("Error: Category name required"));
    console.log("Usage: npm run create:category <name> [output-dir]");
    console.log("\nAvailable categories:", Object.keys(CATEGORIES).join(", "));
    process.exit(1);
  }

  if (!CATEGORIES[categoryName]) {
    console.error(pc.red(`Error: Unknown category "${categoryName}"`));
    console.log("Available:", Object.keys(CATEGORIES).join(", "));
    process.exit(1);
  }

  const output = outputDir || `./output/${categoryName}-examples`;
  const resolved = path.resolve(process.cwd(), output);

  if (fs.existsSync(resolved)) {
    console.error(pc.red(`Error: Directory already exists: ${resolved}`));
    process.exit(1);
  }

  console.log(pc.cyan(`Creating category project: ${categoryName}`));
  await createCategoryProject(categoryName, resolved);
  console.log(pc.green(`✓ Created: ${output}`));
  console.log(
    pc.dim(
      `\nNext: cd ${output} && npm install && npm run compile && npm run test`
    )
  );
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    await handleDirect(args);
  } else {
    await handleInteractiveCategory();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
