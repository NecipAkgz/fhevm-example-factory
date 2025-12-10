#!/usr/bin/env node

/**
 * FHEVM Example Factory - Interactive CLI
 *
 * A modern, interactive CLI for generating FHEVM example projects
 * Built with @clack/prompts for a beautiful developer experience
 *
 * FILE STRUCTURE:
 * ================
 * 1. IMPORTS
 * 2. CONSTANTS - Category icons, order
 * 3. PROJECT BUILDERS - createSingleExample, createCategoryProject
 * 4. DOCUMENTATION - generateDocumentation
 * 5. COMMAND UTILITIES - runCommand, extractTestResults
 * 6. PROMPT HELPERS - Category/example selection prompts
 * 7. INSTALL & TEST - Build and test utilities
 * 8. CLI HANDLERS - handleSingleExample, handleCategory, handleDocs
 * 9. DIRECT MODE - Non-interactive CLI
 * 10. INTERACTIVE MODE - Main interactive flow
 * 11. MAIN ENTRY POINT
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

import { EXAMPLES, CATEGORIES, getDocsFileName } from "./shared/config";

import {
  getRootDir,
  getContractName,
  copyDirectoryRecursive,
  getTemplateDir,
  generateDeployScript,
  generateGitBookMarkdown,
} from "./shared/utils";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Simple folder icon for all categories
 */
const CATEGORY_ICON = "📁";

/**
 * Display order for example categories
 */
const CATEGORY_ORDER = [
  "Basic",
  "Basic - Encryption",
  "Basic - Decryption",
  "FHE Operations",
  "Concepts",
  "OpenZeppelin",
  "Advanced",
];

// =============================================================================
// PROJECT BUILDERS
// =============================================================================

/**
 * Creates a single example project by copying template and example files
 */
async function createSingleExample(
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

  // Step 1: Copy template
  copyDirectoryRecursive(templateDir, outputDir);

  // Step 2: Remove template files and copy example files
  const templateContract = path.join(outputDir, "contracts", "FHECounter.sol");
  if (fs.existsSync(templateContract)) {
    fs.unlinkSync(templateContract);
  }

  fs.copyFileSync(
    contractPath,
    path.join(outputDir, "contracts", `${contractName}.sol`)
  );

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
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Step 4: Clean up template-specific files
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
}

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

  // Step 1: Copy template
  copyDirectoryRecursive(templateDir, outputDir);

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

  // Step 3: Copy all contracts and tests for the category
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
  packageJson.description = category.description;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

// =============================================================================
// DOCUMENTATION
// =============================================================================

/**
 * Generates GitBook-compatible documentation for examples
 * @param exampleName - Single example name or "all" for all examples
 * @returns Number of documentation files generated
 */
async function generateDocumentation(
  exampleName: string | "all"
): Promise<number> {
  const rootDir = getRootDir();
  let count = 0;

  const examples =
    exampleName === "all" ? Object.keys(EXAMPLES) : [exampleName];

  for (const name of examples) {
    const example = EXAMPLES[name];
    if (!example) continue;

    const contractPath = path.join(rootDir, example.contract);
    const testPath = path.join(rootDir, example.test);

    if (!fs.existsSync(contractPath) || !fs.existsSync(testPath)) continue;

    const contractContent = fs.readFileSync(contractPath, "utf-8");
    const testContent = fs.readFileSync(testPath, "utf-8");
    const contractName = getContractName(example.contract) || "Contract";
    const testFileName = path.basename(example.test);

    const markdown = generateGitBookMarkdown(
      example.description,
      contractContent,
      testContent,
      contractName,
      testFileName
    );

    const outputPath = example.docsOutput
      ? path.join(rootDir, example.docsOutput)
      : path.join(rootDir, "docs", `${getDocsFileName(name)}.md`);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, markdown);
    count++;
  }

  return count;
}

// =============================================================================
// COMMAND UTILITIES
// =============================================================================

/**
 * Runs a shell command and returns the output
 */
function runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(stderr || stdout || `Command failed with code ${code}`)
        );
      }
    });

    child.on("error", reject);
  });
}

/**
 * Extracts test results from npm test output
 */
function extractTestResults(output: string): string | null {
  const passingMatch = output.match(/(\d+)\s+passing/);
  const failingMatch = output.match(/(\d+)\s+failing/);

  if (passingMatch) {
    const passing = passingMatch[1];
    const failing = failingMatch ? failingMatch[1] : "0";
    if (failing === "0") {
      return `${passing} tests passing ✓`;
    } else {
      return `${passing} passing, ${failing} failing`;
    }
  }
  return null;
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
 * Prompts user to select a category (for single example flow)
 */
async function promptSelectCategory(): Promise<string | symbol> {
  const categoryCounts = countExamplesPerCategory();

  return p.select({
    message: "Select a category:",
    options: CATEGORY_ORDER.map((category) => ({
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
 * Shows quick start commands
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
 * Asks user if they want to install and test
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
// CLI HANDLERS
// =============================================================================

/**
 * Handles the "Create single example" flow
 */
async function handleSingleExample(): Promise<void> {
  // Step 1: Select category
  const selectedCategory = await promptSelectCategory();
  if (p.isCancel(selectedCategory)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Step 2: Select example from category
  const example = await promptSelectExampleFromCategory(
    selectedCategory as string
  );
  if (p.isCancel(example)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Step 3: Get project details
  const projectName = await p.text({
    message: "Project name:",
    placeholder: `my-${example}-project`,
    defaultValue: `my-${example}-project`,
  });

  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const outputDir = await p.text({
    message: "Output directory:",
    placeholder: `./output/${projectName}`,
    defaultValue: `./output/${projectName}`,
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
  } catch (error) {
    s.stop("Failed to create project");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Handles the "Create category project" flow
 */
async function handleCategory(): Promise<void> {
  // Step 1: Select category
  const category = await promptSelectCategoryProject();
  if (p.isCancel(category)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Step 2: Get project details
  const projectName = await p.text({
    message: "Project name:",
    placeholder: `my-${category}-project`,
    defaultValue: `my-${category}-project`,
  });

  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const outputDir = await p.text({
    message: "Output directory:",
    placeholder: `./output/${projectName}`,
    defaultValue: `./output/${projectName}`,
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
  } catch (error) {
    s.stop("Failed to create project");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Handles the "Generate documentation" flow
 */
async function handleDocs(): Promise<void> {
  const scope = await p.select({
    message: "Generate documentation for:",
    options: [
      {
        value: "all",
        label: "All examples",
        hint: `${Object.keys(EXAMPLES).length} files`,
      },
      { value: "single", label: "Single example" },
    ],
  });

  if (p.isCancel(scope)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  let target = "all";

  if (scope === "single") {
    const example = await p.select({
      message: "Select an example:",
      options: Object.entries(EXAMPLES).map(([key, config]) => ({
        value: key,
        label: key,
        hint: config.category,
      })),
    });

    if (p.isCancel(example)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    target = example as string;
  }

  const s = p.spinner();
  s.start("Generating documentation...");

  try {
    const count = await generateDocumentation(target as string | "all");
    s.stop(`Generated ${count} documentation file(s)`);

    p.log.success(`📄 Files: ${pc.green(String(count))} documentation file(s)`);
    p.log.info(`📁 Location: ${pc.cyan("docs/")}`);

    if (target !== "all") {
      const docFileName = getDocsFileName(target);
      p.log.message(`   └─ ${pc.dim(docFileName + ".md")}`);
    }

    p.log.message("");
    p.log.message(
      pc.dim("💡 Tip: Run 'npm run create docs --all' to regenerate all docs")
    );
  } catch (error) {
    s.stop("Failed to generate documentation");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// =============================================================================
// DIRECT MODE (Non-Interactive)
// =============================================================================

/**
 * Shows help information
 */
function showHelp(): void {
  console.log(`
${pc.cyan("FHEVM Example Factory")}

${pc.yellow("Usage:")}
  npm run create                               ${pc.dim("# Interactive mode")}
  npm run create:example <name> [output]       ${pc.dim(
    "# Create single example"
  )}
  npm run create:category <name> [output]      ${pc.dim(
    "# Create category project"
  )}
  npm run create:docs [example]                ${pc.dim(
    "# Generate docs (all or specific)"
  )}

${pc.yellow("Examples:")}
  ${pc.green("npm run create:example fhe-counter ./my-project")}
  ${pc.green("npm run create:category basic ./basic-examples")}
  ${pc.green("npm run create:docs fhe-counter")}
  ${pc.green("npm run create:docs")}

${pc.yellow("Available examples:")}
  ${Object.keys(EXAMPLES).join(", ")}

${pc.yellow("Available categories:")}
  ${Object.keys(CATEGORIES).join(", ")}
`);
}

/**
 * Handles direct mode with CLI arguments
 */
async function runDirectMode(args: string[]): Promise<void> {
  const [command, ...rest] = args;

  switch (command) {
    case "example": {
      const [exampleName, outputDir] = rest;
      if (!exampleName) {
        console.error(pc.red("Error: Example name required"));
        console.log("Usage: npm run create example <name> [output-dir]");
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
      break;
    }

    case "category": {
      const [categoryName, outputDir] = rest;
      if (!categoryName) {
        console.error(pc.red("Error: Category name required"));
        console.log("Usage: npm run create category <name> [output-dir]");
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
      break;
    }

    case "docs": {
      const [target] = rest;

      // No argument = generate all docs
      if (!target) {
        console.log(pc.cyan("Generating all documentation..."));
        const count = await generateDocumentation("all");
        console.log(pc.green(`✓ Generated ${count} documentation files`));
      }
      // Specific example name
      else {
        if (!EXAMPLES[target]) {
          console.error(pc.red(`Error: Unknown example "${target}"`));
          console.log("Available:", Object.keys(EXAMPLES).join(", "));
          process.exit(1);
        }
        console.log(pc.cyan(`Generating docs for: ${target}`));
        await generateDocumentation(target);
        console.log(
          pc.green(`✓ Generated: docs/${getDocsFileName(target)}.md`)
        );
      }
      break;
    }

    case "--help":
    case "-h":
    case "help":
      showHelp();
      break;

    default:
      console.error(pc.red(`Unknown command: ${command}`));
      showHelp();
      process.exit(1);
  }
}

// =============================================================================
// INTERACTIVE MODE
// =============================================================================

/**
 * Main interactive mode flow
 */
async function runInteractiveMode(): Promise<void> {
  console.clear();
  p.intro(pc.bgCyan(pc.black(" 🔐 FHEVM Example Factory ")));

  const mode = await p.select({
    message: "What would you like to do?",
    options: [
      {
        value: "single",
        label: "Create a single example",
        hint: "Generate one example project",
      },
      {
        value: "category",
        label: "Create a category project",
        hint: "Generate multiple examples by category",
      },
      {
        value: "docs",
        label: "Generate documentation",
        hint: "Create GitBook-compatible docs",
      },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  if (mode === "single") {
    await handleSingleExample();
  } else if (mode === "category") {
    await handleCategory();
  } else if (mode === "docs") {
    await handleDocs();
  }

  p.outro(pc.green("🎉 Happy coding with FHEVM!"));
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

main().catch(console.error);
