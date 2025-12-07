#!/usr/bin/env node

/**
 * FHEVM Example Factory - Interactive CLI
 *
 * A modern, interactive CLI for generating FHEVM example projects
 * Built with @clack/prompts for a beautiful developer experience
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
  generateExampleReadme,
  generateCategoryReadme,
  generateGitBookMarkdown,
} from "./shared/utils";

// =============================================================================
// Create Single Example
// =============================================================================

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

  // Copy template
  copyDirectoryRecursive(templateDir, outputDir);

  // Get contract name
  const contractName = getContractName(example.contract);
  if (!contractName) {
    throw new Error("Could not extract contract name");
  }

  // Remove template contract
  const templateContract = path.join(outputDir, "contracts", "FHECounter.sol");
  if (fs.existsSync(templateContract)) {
    fs.unlinkSync(templateContract);
  }

  // Copy contract and test
  fs.copyFileSync(
    contractPath,
    path.join(outputDir, "contracts", `${contractName}.sol`)
  );

  // Remove .gitkeep from contracts (no longer needed)
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

  // Update deploy script
  fs.writeFileSync(
    path.join(outputDir, "deploy", "deploy.ts"),
    generateDeployScript(contractName)
  );

  // Update package.json
  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.name = `fhevm-example-${exampleName}`;
  packageJson.description = example.description;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Update hardhat.config.ts - remove FHECounter task import
  const configPath = path.join(outputDir, "hardhat.config.ts");
  let configContent = fs.readFileSync(configPath, "utf-8");
  configContent = configContent.replace(
    /import "\.\/tasks\/FHECounter";\n?/g,
    ""
  );
  fs.writeFileSync(configPath, configContent);

  // Remove FHECounter task (it's example-specific and not applicable to other contracts)
  const oldTaskFile = path.join(outputDir, "tasks", "FHECounter.ts");
  if (fs.existsSync(oldTaskFile)) {
    fs.unlinkSync(oldTaskFile);
  }

  // Generate README
  fs.writeFileSync(
    path.join(outputDir, "README.md"),
    generateExampleReadme(exampleName, example.description, contractName)
  );
}

// =============================================================================
// Create Category Project
// =============================================================================

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

  // Copy template
  copyDirectoryRecursive(templateDir, outputDir);

  // Clear template files
  const templateContract = path.join(outputDir, "contracts", "FHECounter.sol");
  if (fs.existsSync(templateContract)) fs.unlinkSync(templateContract);

  // Remove .gitkeep from contracts (no longer needed)
  const contractsGitkeep = path.join(outputDir, "contracts", ".gitkeep");
  if (fs.existsSync(contractsGitkeep)) fs.unlinkSync(contractsGitkeep);

  const testDir = path.join(outputDir, "test");
  fs.readdirSync(testDir).forEach((file) => {
    if (file.endsWith(".ts") || file === ".gitkeep") {
      fs.unlinkSync(path.join(testDir, file));
    }
  });

  // Copy contracts and tests
  const contractNames: string[] = [];
  for (const item of category.contracts) {
    const solPath = path.join(rootDir, item.sol);
    if (fs.existsSync(solPath)) {
      const contractName = getContractName(item.sol);
      if (contractName) {
        contractNames.push(contractName);
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

  // Update hardhat.config.ts - remove FHECounter task import
  const configPath = path.join(outputDir, "hardhat.config.ts");
  let configContent = fs.readFileSync(configPath, "utf-8");
  configContent = configContent.replace(
    /import "\.\/tasks\/FHECounter";\n?/g,
    ""
  );
  fs.writeFileSync(configPath, configContent);

  // Remove FHECounter task (it's example-specific)
  const oldTaskFile = path.join(outputDir, "tasks", "FHECounter.ts");
  if (fs.existsSync(oldTaskFile)) {
    fs.unlinkSync(oldTaskFile);
  }

  // Update package.json
  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.name = `fhevm-examples-${categoryName}`;
  packageJson.description = category.description;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Generate README
  fs.writeFileSync(
    path.join(outputDir, "README.md"),
    generateCategoryReadme(category.name, category.description, contractNames)
  );
}

// =============================================================================
// Generate Documentation
// =============================================================================

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

    // Generate GitBook markdown using shared utility
    const markdown = generateGitBookMarkdown(
      example.description,
      contractContent,
      testContent,
      contractName,
      testFileName
    );

    // Use consistent filename with fhe- prefix
    const docFileName = getDocsFileName(name);
    const outputPath = path.join(rootDir, "docs", `${docFileName}.md`);
    fs.writeFileSync(outputPath, markdown);
    count++;
  }

  return count;
}

// =============================================================================
// Install and Test Helper
// =============================================================================

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

function extractTestResults(output: string): string | null {
  // Look for test summary lines like "4 passing (2s)"
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
        if (testResults) {
          s.stop(pc.green(`✓ ${step.name} - ${testResults}`));
        } else {
          s.stop(pc.green(`✓ ${step.name} completed`));
        }
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

function showQuickStart(relativePath: string): void {
  p.note(
    `${pc.dim("$")} cd ${relativePath}\n${pc.dim("$")} npm install\n${pc.dim(
      "$"
    )} npm run compile\n${pc.dim("$")} npm run test`,
    "🚀 Quick Start"
  );
}

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
// CLI Handlers
// =============================================================================

async function handleSingleExample(): Promise<void> {
  // Group examples by category
  const grouped: Record<
    string,
    Array<{ value: string; label: string; hint: string }>
  > = {};
  for (const [key, config] of Object.entries(EXAMPLES)) {
    if (!grouped[config.category]) {
      grouped[config.category] = [];
    }
    grouped[config.category].push({
      value: key,
      label: key,
      hint:
        config.description.slice(0, 50) +
        (config.description.length > 50 ? "..." : ""),
    });
  }

  // Flatten to options
  const options: Array<{ value: string; label: string; hint?: string }> = [];
  for (const [, items] of Object.entries(grouped)) {
    options.push(...items);
  }

  const example = await p.select({
    message: "Select an example:",
    options,
  });

  if (p.isCancel(example)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

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

async function handleCategory(): Promise<void> {
  const category = await p.select({
    message: "Select a category:",
    options: Object.entries(CATEGORIES).map(([key, config]) => ({
      value: key,
      label: config.name,
      hint: `${config.contracts.length} contracts`,
    })),
  });

  if (p.isCancel(category)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

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
// Direct Mode (Non-Interactive)
// =============================================================================

function showHelp(): void {
  console.log(`
${pc.cyan("FHEVM Example Factory")}

${pc.yellow("Usage:")}
  npm run create                               ${pc.dim("# Interactive mode")}
  npm run create-example <name> [output]       ${pc.dim(
    "# Create single example"
  )}
  npm run create-category <name> [output]      ${pc.dim(
    "# Create category project"
  )}
  npm run create-docs <example>                ${pc.dim(
    "# Generate single doc"
  )}
  npm run create-docs-all                      ${pc.dim("# Generate all docs")}

${pc.yellow("Examples:")}
  ${pc.green("npm run create-example fhe-counter ./my-project")}
  ${pc.green("npm run create-category basic ./basic-examples")}
  ${pc.green("npm run create-docs fhe-counter")}
  ${pc.green("npm run create-docs-all")}

${pc.yellow("Available examples:")}
  ${Object.keys(EXAMPLES).join(", ")}

${pc.yellow("Available categories:")}
  ${Object.keys(CATEGORIES).join(", ")}
`);
}

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
      if (!target) {
        console.error(pc.red("Error: Example name or --all required"));
        console.log("Usage: npm run create docs <example|--all>");
        process.exit(1);
      }
      if (target === "--all") {
        console.log(pc.cyan("Generating all documentation..."));
        const count = await generateDocumentation("all");
        console.log(pc.green(`✓ Generated ${count} documentation files`));
      } else {
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
// Main CLI
// =============================================================================

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

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Direct mode with arguments
    await runDirectMode(args);
  } else {
    // Interactive mode
    await runInteractiveMode();
  }
}

main().catch(console.error);
