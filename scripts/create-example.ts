#!/usr/bin/env node

/**
 * Create Example - Single Example Project Generator
 *
 * Creates a standalone FHEVM example project with:
 * - Template files from fhevm-hardhat-template
 * - Selected example contract and test
 * - Configured package.json and deploy scripts
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";

import { EXAMPLES } from "./shared/config";
import {
  getRootDir,
  getContractName,
  copyDirectoryRecursive,
  getTemplateDir,
  generateDeployScript,
  cleanupTemplate,
  CATEGORY_ICON,
  CATEGORY_ORDER,
} from "./shared/utils";
import { runCommand, askInstallAndTest } from "./shared/commands";

// =============================================================================
// Project Builder
// =============================================================================

/**
 * Creates a single example project by copying template and example files
 */
export async function createSingleExample(
  exampleName: string,
  outputDir: string
): Promise<void> {
  const rootDir = getRootDir();
  const templateDir = getTemplateDir();
  const example = EXAMPLES[exampleName];

  if (!example) {
    throw new Error(`Unknown example: ${exampleName}`);
  }

  const contractPath = path.join(rootDir, example.contract);
  const testPath = path.join(rootDir, example.test);

  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract not found: ${example.contract}`);
  }
  if (!fs.existsSync(testPath)) {
    throw new Error(`Test not found: ${example.test}`);
  }

  const contractName = getContractName(example.contract);
  if (!contractName) {
    throw new Error("Could not extract contract name");
  }

  // Step 1: Copy template and clean up
  copyDirectoryRecursive(templateDir, outputDir);
  cleanupTemplate(outputDir);

  // Step 2: Copy example contract
  fs.copyFileSync(
    contractPath,
    path.join(outputDir, "contracts", `${contractName}.sol`)
  );

  // Copy contract dependencies (e.g. mock contracts)
  if (example.dependencies) {
    for (const depPath of example.dependencies) {
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

  // Step 3: Copy test file
  fs.copyFileSync(
    testPath,
    path.join(outputDir, "test", path.basename(example.test))
  );

  // Step 3: Update configuration files
  fs.writeFileSync(
    path.join(outputDir, "deploy", "deploy.ts"),
    generateDeployScript(contractName)
  );

  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.name = `fhevm-example-${exampleName}`;
  packageJson.description = example.description;

  if (example.npmDependencies) {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    Object.assign(packageJson.dependencies, example.npmDependencies);
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
 * Counts how many examples exist in each category
 */
function countExamplesPerCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const config of Object.values(EXAMPLES)) {
    counts[config.category] = (counts[config.category] || 0) + 1;
  }
  return counts;
}

/**
 * Prompts user to select a category
 */
async function promptSelectCategory(): Promise<string | symbol> {
  const categoryCounts = countExamplesPerCategory();

  const allCategories = Object.keys(categoryCounts);
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((cat) => allCategories.includes(cat)),
    ...allCategories.filter((cat) => !CATEGORY_ORDER.includes(cat)).sort(),
  ];

  return p.select({
    message: "Select a category:",
    options: orderedCategories.map((category) => ({
      value: category,
      label: `${CATEGORY_ICON} ${category}`,
      hint: `${categoryCounts[category] || 0} example${
        categoryCounts[category] !== 1 ? "s" : ""
      }`,
    })),
  });
}

/**
 * Prompts user to select an example from a specific category
 */
async function promptSelectExampleFromCategory(
  category: string
): Promise<string | symbol> {
  const categoryExamples = Object.entries(EXAMPLES)
    .filter(([, config]) => config.category === category)
    .map(([key, config]) => ({
      value: key,
      label: key,
      hint:
        config.description.slice(0, 80) +
        (config.description.length > 80 ? "..." : ""),
    }));

  return p.select({
    message: `Select an example from ${category}:`,
    options: categoryExamples,
  });
}

// =============================================================================
// Interactive Mode
// =============================================================================

/**
 * Handles the "Create single example" flow
 */
export async function handleInteractiveExample(): Promise<void> {
  console.clear();
  p.intro(pc.bgCyan(pc.black(" 🔐 Create FHEVM Example ")));

  // Step 1: Select category
  const selectedCategory = await promptSelectCategory();
  if (p.isCancel(selectedCategory)) {
    p.cancel("Operation cancelled.");
    return;
  }

  // Step 2: Select example from category
  const example = await promptSelectExampleFromCategory(
    selectedCategory as string
  );
  if (p.isCancel(example)) {
    p.cancel("Operation cancelled.");
    return;
  }

  // Step 3: Get project details
  const projectName = await p.text({
    message: "Project name:",
    placeholder: `my-${example}-project`,
    defaultValue: `my-${example}-project`,
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

  // Step 4: Create project
  const s = p.spinner();
  s.start("Creating example project...");

  try {
    await createSingleExample(example as string, resolvedOutput);
    s.stop("Project created successfully!");

    const exampleConfig = EXAMPLES[example as string];
    const relativePath = path.relative(process.cwd(), resolvedOutput);

    p.log.success(`📁 Created: ${pc.cyan(relativePath)}`);
    p.log.info(`📝 Example: ${pc.yellow(exampleConfig?.title || example)}`);

    await askInstallAndTest(resolvedOutput, relativePath);
    p.outro(pc.green("✅ Setup complete. Happy encrypting!"));
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
  const [exampleName, outputDir] = args;

  if (!exampleName) {
    console.error(pc.red("Error: Example name required"));
    console.log("Usage: npm run create:example <name> [output-dir]");
    console.log("\nAvailable examples:", Object.keys(EXAMPLES).join(", "));
    process.exit(1);
  }

  if (!EXAMPLES[exampleName]) {
    console.error(pc.red(`Error: Unknown example "${exampleName}"`));
    console.log("Available:", Object.keys(EXAMPLES).join(", "));
    process.exit(1);
  }

  const output = outputDir || `./output/${exampleName}`;
  const resolved = path.resolve(process.cwd(), output);

  if (fs.existsSync(resolved)) {
    console.error(pc.red(`Error: Directory already exists: ${resolved}`));
    process.exit(1);
  }

  console.log(pc.cyan(`Creating example: ${exampleName}`));
  await createSingleExample(exampleName, resolved);
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
    await handleInteractiveExample();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
