#!/usr/bin/env node

/**
 * create-fhevm-example - CLI for creating FHEVM example projects
 *
 * Usage:
 *   npx create-fhevm-example                    # Interactive mode
 *   npx create-fhevm-example --example <name>   # Create single example
 *   npx create-fhevm-example --category <name>  # Create category project
 *
 * FILE STRUCTURE:
 * ================
 * 1. IMPORTS
 * 2. CONSTANTS - Category icons, order, etc.
 * 3. PROJECT BUILDERS - createSingleExample, createCategoryProject
 * 4. PROMPT HELPERS - Category/example selection prompts
 * 5. INSTALL & TEST - Build and test utilities
 * 6. INTERACTIVE MODE - Main interactive flow
 * 7. DIRECT MODE - CLI argument handling
 * 8. MAIN ENTRY POINT
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { EXAMPLES, CATEGORIES } from "./config.js";
import {
  cloneTemplate,
  initSubmodule,
  copyDirectoryRecursive,
  getContractName,
  downloadFileFromGitHub,
  runCommand,
  extractTestResults,
  generateDeployScript,
} from "./utils.js";
import { runAddMode } from "./add-mode.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Simple folder icon for all categories
 */
const CATEGORY_ICON = "📁";

/**
 * Display order for example categories in the interactive prompt
 */
const CATEGORY_ORDER = [
  "Basic",
  "Basic - Encryption",
  "Basic - Decryption",
  "Basic - FHE Operations",
  "Concepts",
  "Openzeppelin",
  "Advanced",
];

// =============================================================================
// PROJECT BUILDERS
// =============================================================================

/**
 * Creates a single example project from the template
 *
 * Steps:
 * 1. Copy template directory
 * 2. Download contract and test files from GitHub
 * 3. Update package.json and deploy scripts
 * 4. Clean up template-specific files
 */
async function createSingleExample(
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

  // Step 1: Copy template
  copyDirectoryRecursive(templateDir, outputDir);

  // Clean up .git and initialize fresh repository
  const gitDir = path.join(outputDir, ".git");
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  // Step 2: Remove template contract and download example contract
  const templateContract = path.join(outputDir, "contracts", "FHECounter.sol");
  if (fs.existsSync(templateContract)) {
    fs.unlinkSync(templateContract);
  }

  await downloadFileFromGitHub(
    example.contract,
    path.join(outputDir, "contracts", `${contractName}.sol`)
  );

  // Step 3: Clean up and download test file
  const contractsGitkeep = path.join(outputDir, "contracts", ".gitkeep");
  if (fs.existsSync(contractsGitkeep)) {
    fs.unlinkSync(contractsGitkeep);
  }

  const testDir = path.join(outputDir, "test");
  fs.readdirSync(testDir).forEach((file) => {
    if (file.endsWith(".ts") || file === ".gitkeep") {
      fs.unlinkSync(path.join(testDir, file));
    }
  });

  await downloadFileFromGitHub(
    example.test,
    path.join(outputDir, "test", path.basename(example.test))
  );

  // Step 4: Update configuration files
  fs.writeFileSync(
    path.join(outputDir, "deploy", "deploy.ts"),
    generateDeployScript(contractName)
  );

  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.name = `fhevm-example-${exampleName}`;
  packageJson.description = example.description;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Step 5: Remove template-specific task
  const configPath = path.join(outputDir, "hardhat.config.ts");
  let configContent = fs.readFileSync(configPath, "utf-8");
  configContent = configContent.replace(
    /import "\.\/tasks\/FHECounter";\n?/g,
    ""
  );
  fs.writeFileSync(configPath, configContent);

  const oldTaskFile = path.join(outputDir, "tasks", "FHECounter.ts");
  if (fs.existsSync(oldTaskFile)) {
    fs.unlinkSync(oldTaskFile);
  }

  // Initialize git repository
  try {
    await runCommand("git", ["init"], outputDir);
  } catch (error) {
    // Git init is optional, silently continue if it fails
  }
}

/**
 * Creates a category project with multiple examples
 *
 * Steps:
 * 1. Copy template directory
 * 2. Download all contracts and tests for the category
 * 3. Update package.json
 * 4. Clean up template-specific files
 */
async function createCategoryProject(
  categoryName: string,
  outputDir: string,
  tempRepoPath: string
): Promise<void> {
  const category = CATEGORIES[categoryName];
  if (!category) {
    throw new Error(`Unknown category: ${categoryName}`);
  }

  const templateDir = path.join(tempRepoPath, "fhevm-hardhat-template");

  // Step 1: Copy template
  copyDirectoryRecursive(templateDir, outputDir);

  // Clean up .git and initialize fresh repository
  const gitDir = path.join(outputDir, ".git");
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  // Step 2: Clear template files
  const templateContract = path.join(outputDir, "contracts", "FHECounter.sol");
  if (fs.existsSync(templateContract)) fs.unlinkSync(templateContract);

  const contractsGitkeep = path.join(outputDir, "contracts", ".gitkeep");
  if (fs.existsSync(contractsGitkeep)) fs.unlinkSync(contractsGitkeep);

  const testDir = path.join(outputDir, "test");
  fs.readdirSync(testDir).forEach((file) => {
    if (file.endsWith(".ts") || file === ".gitkeep") {
      fs.unlinkSync(path.join(testDir, file));
    }
  });

  // Step 3: Download all contracts and tests
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

  // Step 4: Update configuration files
  const configPath = path.join(outputDir, "hardhat.config.ts");
  let configContent = fs.readFileSync(configPath, "utf-8");
  configContent = configContent.replace(
    /import "\.\/tasks\/FHECounter";\n?/g,
    ""
  );
  fs.writeFileSync(configPath, configContent);

  const oldTaskFile = path.join(outputDir, "tasks", "FHECounter.ts");
  if (fs.existsSync(oldTaskFile)) {
    fs.unlinkSync(oldTaskFile);
  }

  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.name = `fhevm-examples-${categoryName}`;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Initialize git repository
  try {
    await runCommand("git", ["init"], outputDir);
  } catch (error) {
    // Git init is optional, silently continue if it fails
  }
}

// =============================================================================
// PROMPT HELPERS
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
 * Returns the selected category name
 */
async function promptSelectCategory(): Promise<string | symbol> {
  const categoryCounts = countExamplesPerCategory();

  // Get all categories, prioritizing CATEGORY_ORDER, then alphabetically sorted others
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
 * Returns the selected example name
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

/**
 * Prompts user to select a category project
 * Returns the selected category key (lowercase)
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
// INSTALL & TEST
// =============================================================================

/**
 * Runs npm install, compile, and test in the project directory
 */
async function runInstallAndTest(projectPath: string): Promise<void> {
  const steps = [
    {
      name: "Installing dependencies",
      cmd: "npm",
      args: ["install"],
      showOutput: false,
    },
    {
      name: "Compiling contracts",
      cmd: "npm",
      args: ["run", "compile"],
      showOutput: false,
    },
    {
      name: "Running tests",
      cmd: "npm",
      args: ["run", "test"],
      showOutput: true,
    },
  ];

  for (const step of steps) {
    const s = p.spinner();
    s.start(step.name + "...");

    try {
      const output = await runCommand(step.cmd, step.args, projectPath);

      if (step.showOutput) {
        const testResults = extractTestResults(output);
        s.stop(
          testResults
            ? pc.green(`✓ ${step.name} - ${testResults}`)
            : pc.green(`✓ ${step.name} completed`)
        );
      } else {
        s.stop(pc.green(`✓ ${step.name} completed`));
      }
    } catch (error) {
      s.stop(pc.red(`✗ ${step.name} failed`));
      if (error instanceof Error) {
        p.log.error(error.message);
      }
      throw new Error(`${step.name} failed`);
    }
  }

  p.log.success(pc.green("All steps completed successfully!"));
}

/**
 * Shows quick start commands for the created project
 */
function showQuickStart(relativePath: string): void {
  p.note(
    `${pc.dim("$")} cd ${relativePath}\n${pc.dim("$")} npm install\n${pc.dim(
      "$"
    )} npm run compile\n${pc.dim("$")} npm run test`,
    "🚀 Quick Start"
  );
}

/**
 * Asks user if they want to install and test, then runs or shows quick start
 */
async function askInstallAndTest(
  resolvedOutput: string,
  relativePath: string
): Promise<void> {
  const shouldInstall = await p.confirm({
    message: "Install dependencies and run tests?",
    initialValue: false,
  });

  if (p.isCancel(shouldInstall)) {
    showQuickStart(relativePath);
    return;
  }

  if (shouldInstall) {
    p.log.message("");
    await runInstallAndTest(resolvedOutput);
  } else {
    showQuickStart(relativePath);
  }
}

// =============================================================================
// INTERACTIVE MODE
// =============================================================================

/**
 * Main interactive mode flow
 * Guides user through project creation with prompts
 */
async function runInteractiveMode(): Promise<void> {
  console.clear();
  p.intro(pc.bgCyan(pc.black(" 🔐 Create FHEVM Example ")));

  // Step 1: Choose mode (single example or category)
  const mode = await p.select({
    message: "What would you like to create?",
    options: [
      {
        value: "single",
        label: "Single example",
        hint: "One example contract with tests",
      },
      {
        value: "category",
        label: "Category project",
        hint: "Multiple examples by category",
      },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  let exampleName: string | symbol = "";
  let categoryName: string | symbol = "";
  let projectName: string | symbol = "";

  // Step 2: Select based on mode
  if (mode === "single") {
    // Single example: first select category, then example
    const selectedCategory = await promptSelectCategory();
    if (p.isCancel(selectedCategory)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    exampleName = await promptSelectExampleFromCategory(
      selectedCategory as string
    );
    if (p.isCancel(exampleName)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    projectName = await p.text({
      message: "Project name:",
      placeholder: `my-${exampleName}-project`,
      defaultValue: `my-${exampleName}-project`,
    });
  } else {
    // Category project: select category directly
    categoryName = await promptSelectCategoryProject();
    if (p.isCancel(categoryName)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    projectName = await p.text({
      message: "Project name:",
      placeholder: `my-${categoryName}-project`,
      defaultValue: `my-${categoryName}-project`,
    });
  }

  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Step 3: Output directory
  const outputDir = await p.text({
    message: "Output directory:",
    placeholder: `./${projectName}`,
    defaultValue: `./${projectName}`,
  });

  if (p.isCancel(outputDir)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const resolvedOutput = path.resolve(process.cwd(), outputDir as string);

  if (fs.existsSync(resolvedOutput)) {
    p.log.error(`Directory already exists: ${resolvedOutput}`);
    process.exit(1);
  }

  // Step 4: Create project
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fhevm-"));
  const s = p.spinner();

  try {
    s.start("Downloading template...");
    const tempRepoPath = await cloneTemplate(tempDir);

    s.message("Initializing submodules...");
    await initSubmodule(tempRepoPath);

    s.message("Creating project...");
    if (mode === "single") {
      await createSingleExample(
        exampleName as string,
        resolvedOutput,
        tempRepoPath
      );
    } else {
      await createCategoryProject(
        categoryName as string,
        resolvedOutput,
        tempRepoPath
      );
    }

    s.stop("Project created successfully!");

    const relativePath = path.relative(process.cwd(), resolvedOutput);
    p.log.success(`📁 Created: ${pc.cyan(relativePath)}`);

    if (mode === "single") {
      const exampleConfig = EXAMPLES[exampleName as string];
      p.log.info(
        `📝 Example: ${pc.yellow(exampleConfig?.title || exampleName)}`
      );
    } else {
      const categoryConfig = CATEGORIES[categoryName as string];
      p.log.info(
        `📦 Category: ${pc.yellow(categoryConfig?.name || categoryName)}`
      );
      p.log.info(
        `📄 Contracts: ${pc.green(
          String(categoryConfig?.contracts.length || 0)
        )}`
      );
    }

    await askInstallAndTest(resolvedOutput, relativePath);
  } catch (error) {
    s.stop("Failed to create project");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  p.outro(pc.green("🎉 Happy coding with FHEVM!"));
}

// =============================================================================
// DIRECT MODE (CLI Arguments)
// =============================================================================

/**
 * Shows help information for CLI usage
 */
function showHelp(): void {
  console.log(`
${pc.cyan("create-fhevm-example")}

${pc.yellow("Usage:")}
  npx create-fhevm-example                     ${pc.dim("# Interactive mode")}
  npx create-fhevm-example --example <name>    ${pc.dim(
    "# Create single example"
  )}
  npx create-fhevm-example --category <name>   ${pc.dim(
    "# Create category project"
  )}

${pc.yellow("Options:")}
  --example <name>     Create a single example project
  --category <name>    Create a category project
  --add                Add FHEVM to existing Hardhat project
  --target <dir>       Target directory for --add mode (default: current dir)
  --output <dir>       Output directory (default: ./<project-name>)
  --install            Auto-install dependencies
  --test               Auto-run tests (requires --install)
  --help, -h           Show this help message

${pc.yellow("Examples:")}
  ${pc.green("npx create-fhevm-example --example fhe-counter")}
  ${pc.green("npx create-fhevm-example --category basic --output ./my-project")}
  ${pc.green("npx create-fhevm-example --add")}
  ${pc.green("npx create-fhevm-example --add --target ./my-existing-project")}
  ${pc.green("npx create-fhevm-example --example fhe-counter --install --test")}

${pc.yellow("Available examples:")}
  ${Object.keys(EXAMPLES).join(", ")}

${pc.yellow("Available categories:")}
  ${Object.keys(CATEGORIES).join(", ")}
`);
}

/**
 * Parses CLI arguments into a key-value object
 */
function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("--")) {
        parsed[key] = nextArg;
        i++;
      } else {
        parsed[key] = true;
      }
    } else if (arg === "-h") {
      parsed["help"] = true;
    }
  }

  return parsed;
}

/**
 * Handles direct mode (CLI with arguments, non-interactive)
 */
async function runDirectMode(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args);

  if (parsedArgs["help"]) {
    showHelp();
    return;
  }

  // Handle --add mode
  if (parsedArgs["add"]) {
    const targetDir = parsedArgs["target"] as string | undefined;
    await runAddMode(targetDir);
    return;
  }

  const exampleName = parsedArgs["example"] as string;
  const categoryName = parsedArgs["category"] as string;
  const outputDir = parsedArgs["output"] as string;
  const shouldInstall = parsedArgs["install"] === true;

  // Validation
  if (!exampleName && !categoryName) {
    console.error(pc.red("Error: Either --example or --category is required"));
    showHelp();
    process.exit(1);
  }

  if (exampleName && categoryName) {
    console.error(pc.red("Error: Cannot use both --example and --category"));
    process.exit(1);
  }

  const mode = exampleName ? "example" : "category";
  const name = (exampleName || categoryName) as string;

  if (mode === "example" && !EXAMPLES[name]) {
    console.error(pc.red(`Error: Unknown example "${name}"`));
    console.log("Available:", Object.keys(EXAMPLES).join(", "));
    process.exit(1);
  }

  if (mode === "category" && !CATEGORIES[name]) {
    console.error(pc.red(`Error: Unknown category "${name}"`));
    console.log("Available:", Object.keys(CATEGORIES).join(", "));
    process.exit(1);
  }

  const defaultOutput =
    mode === "example" ? `./my-${name}-project` : `./my-${name}-examples`;
  const output = outputDir || defaultOutput;
  const resolved = path.resolve(process.cwd(), output);

  if (fs.existsSync(resolved)) {
    console.error(pc.red(`Error: Directory already exists: ${resolved}`));
    process.exit(1);
  }

  // Create project
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fhevm-"));

  try {
    console.log(pc.cyan(`Creating ${mode}: ${name}`));
    console.log(pc.dim("Downloading template..."));

    const tempRepoPath = await cloneTemplate(tempDir);

    console.log(pc.dim("Initializing submodules..."));
    await initSubmodule(tempRepoPath);

    console.log(pc.dim("Creating project..."));
    if (mode === "example") {
      await createSingleExample(name, resolved, tempRepoPath);
    } else {
      await createCategoryProject(name, resolved, tempRepoPath);
    }

    console.log(pc.green(`✓ Created: ${output}`));

    if (shouldInstall) {
      console.log(pc.dim("\nInstalling dependencies..."));
      await runInstallAndTest(resolved);
    } else {
      console.log(
        pc.dim(
          `\nNext: cd ${output} && npm install && npm run compile && npm run test`
        )
      );
    }
  } catch (error) {
    console.error(
      pc.red("Error:"),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    await runDirectMode(args);
  } else {
    await runInteractiveMode();
  }
}

main().catch((error) => {
  console.error(pc.red("Fatal error:"), error);
  process.exit(1);
});
