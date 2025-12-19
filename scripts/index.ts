#!/usr/bin/env node

/**
 * create-fhevm-example - CLI for creating FHEVM example projects
 *
 * Usage:
 *   npx create-fhevm-example                    # Interactive mode
 *   npx create-fhevm-example --example <name>   # Create single example
 *   npx create-fhevm-example --category <name>  # Create category project
 *   npx create-fhevm-example --add              # Add to existing project
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { EXAMPLES, CATEGORIES } from "./config";

import {
  cloneTemplate,
  initSubmodule,
  log,
  handleError,
  ERROR_MESSAGES,
  validateExample,
  validateCategory,
  validateDirectoryNotExists,
} from "./utils";

import { createSingleExample, createCategoryProject } from "./builders";

import {
  promptSelectCategory,
  promptSelectExampleFromCategory,
  promptSelectCategoryProject,
  askInstallAndTest,
  runInstallAndTest,
} from "./ui";

import { runAddMode } from "./add-mode";
import { handleInteractiveDocs as runDocGeneration } from "./generate-docs";

// =============================================================================
// INTERACTIVE MODE
// =============================================================================

/** Project configuration from interactive prompts */
interface ProjectConfig {
  mode: "single" | "category";
  name: string;
  outputDir: string;
}

/** Prompts user to select mode and returns project configuration */
async function getProjectConfig(): Promise<ProjectConfig | null> {
  // Build options - docs only available in local dev mode
  const options = [
    {
      value: "single",
      label: "Create a single example project",
      hint: "One example contract with tests",
    },
    {
      value: "category",
      label: "Create a category-based project",
      hint: "Bundle all examples from a category",
    },
  ];

  // Add docs option only in local dev mode (npm run create)
  if (process.env.LOCAL_DEV === "1") {
    options.push({
      value: "docs",
      label: "Generate documentation",
      hint: "Generate GitBook docs for examples",
    });
  }

  const mode = await p.select({
    message: "What would you like to create?",
    options,
  });

  if (p.isCancel(mode)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  let name: string;

  if (mode === "single") {
    const category = await promptSelectCategory();
    if (p.isCancel(category)) {
      p.cancel("Operation cancelled.");
      return null;
    }

    const example = await promptSelectExampleFromCategory(category as string);
    if (p.isCancel(example)) {
      p.cancel("Operation cancelled.");
      return null;
    }

    name = example as string;
  } else if (mode === "docs") {
    // Handle docs mode - call generate-docs interactive
    await runDocGeneration();
    return null; // Exit after docs generation
  } else {
    const category = await promptSelectCategoryProject();
    if (p.isCancel(category)) {
      p.cancel("Operation cancelled.");
      return null;
    }

    name = category as string;
  }

  const projectName = await p.text({
    message: "Project name:",
    placeholder: `my-${name}-project`,
    defaultValue: `my-${name}-project`,
  });
  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  const outputDir = await p.text({
    message: "Output directory:",
    placeholder: `./${projectName}`,
    defaultValue: `./${projectName}`,
  });
  if (p.isCancel(outputDir)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  return {
    mode: mode as "single" | "category",
    name,
    outputDir: outputDir as string,
  };
}

/** Scaffolds project and shows completion message */
async function scaffoldProject(config: ProjectConfig): Promise<void> {
  const resolvedOutput = path.resolve(process.cwd(), config.outputDir);

  if (fs.existsSync(resolvedOutput)) {
    p.log.error(`Directory already exists: ${resolvedOutput}`);
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fhevm-"));
  const s = p.spinner();

  try {
    s.start("Downloading template...");
    const tempRepoPath = await cloneTemplate(tempDir);

    s.message("Initializing submodules...");
    await initSubmodule(tempRepoPath);

    s.message("Scaffolding your confidential project...");
    if (config.mode === "single") {
      await createSingleExample(config.name, resolvedOutput, tempRepoPath);
    } else {
      await createCategoryProject(config.name, resolvedOutput, tempRepoPath);
    }

    s.stop("🎉 Project scaffolded successfully!");

    const relativePath = path.relative(process.cwd(), resolvedOutput);
    p.log.success(`📁 Created: ${pc.cyan(relativePath)}`);

    if (config.mode === "single") {
      const exampleConfig = EXAMPLES[config.name];
      if (exampleConfig) {
        p.log.info(`📝 Example: ${pc.yellow(exampleConfig.title)}`);
      }
    } else {
      const categoryConfig = CATEGORIES[config.name];
      if (categoryConfig) {
        p.log.info(`📦 Category: ${pc.yellow(categoryConfig.name)}`);
        p.log.info(
          `📄 Contracts: ${pc.green(String(categoryConfig.contracts.length))}`
        );
      }
    }

    await askInstallAndTest(resolvedOutput, relativePath);
  } catch (error) {
    s.stop(pc.red("Failed to create project"));
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  p.outro(pc.green("✅ Setup complete. Happy encrypting!"));
}

/** Main interactive mode entry point */
async function runInteractiveMode(): Promise<void> {
  console.clear();
  p.intro(pc.bgCyan(pc.black(" ⚡ FHEVM Example Factory ")));

  const config = await getProjectConfig();
  if (!config) return;

  await scaffoldProject(config);
}

// =============================================================================
// QUICK MODE (CLI Arguments)
// =============================================================================

function showHelp(): void {
  console.log(`
${pc.bgCyan(pc.black(pc.bold(" 🔐 create-fhevm-example ")))}
${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}

${pc.cyan(pc.bold("📋 USAGE"))}

  ${pc.dim("$")} ${pc.white(
    "npx create-fhevm-example"
  )}                  ${pc.dim("→")} Interactive mode ${pc.yellow(
    "(recommended)"
  )}
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green(
    "--example"
  )} ${pc.yellow("<name>")}  ${pc.dim("→")} Create single example
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green(
    "--category"
  )} ${pc.yellow("<name>")} ${pc.dim("→")} Create category project
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green(
    "--add"
  )}               ${pc.dim("→")} Add to existing project

${pc.cyan(pc.bold("⚙️  OPTIONS"))}

  ${pc.green("--example")} ${pc.dim(
    "<name>"
  )}      Create a single example project
  ${pc.green("--category")} ${pc.dim("<name>")}     Create a category project
  ${pc.green("--add")}                 Add FHEVM to existing Hardhat project
  ${pc.green("--target")} ${pc.dim(
    "<dir>"
  )}        Target directory for --add mode
  ${pc.green("--output")} ${pc.dim("<dir>")}        Output directory
  ${pc.green("--install")}             Auto-install dependencies
  ${pc.green("--test")}                Auto-run tests (requires --install)
  ${pc.green("--help")}${pc.dim(", -h")}            Show this help message

${pc.cyan(pc.bold("⚡ EXAMPLES"))}

  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green(
    "--example"
  )} ${pc.yellow("fhe-counter")}
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green(
    "--category"
  )} ${pc.yellow("basic")} ${pc.green("--output")} ${pc.blue("./my-project")}
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green("--add")}
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green(
    "--example"
  )} ${pc.yellow("fhe-counter")} ${pc.green("--install")} ${pc.green("--test")}

${pc.cyan(pc.bold("📦 AVAILABLE EXAMPLES"))}

  ${pc.dim(Object.keys(EXAMPLES).slice(0, 10).join(", "))}
  ${pc.dim("...")} and ${pc.yellow(
    String(Object.keys(EXAMPLES).length - 10)
  )} more

${pc.cyan(pc.bold("📁 AVAILABLE CATEGORIES"))}

  ${Object.keys(CATEGORIES)
    .map((c) => pc.yellow(c))
    .join(", ")}

${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}
${pc.dim("📚 Documentation:")} ${pc.blue(
    "https://github.com/NecipAkgz/fhevm-example-factory"
  )}
`);
}

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

async function runDirectMode(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args);

  if (parsedArgs["help"]) {
    showHelp();
    return;
  }

  if (parsedArgs["add"]) {
    const targetDir = parsedArgs["target"] as string | undefined;
    await runAddMode(targetDir);
    return;
  }

  const exampleName = parsedArgs["example"] as string;
  const categoryName = parsedArgs["category"] as string;
  const outputDir = parsedArgs["output"] as string;
  const shouldInstall = parsedArgs["install"] === true;

  if (!exampleName && !categoryName) {
    log.error(ERROR_MESSAGES.EXAMPLE_REQUIRED);
    showHelp();
    handleError("Missing required argument");
  }

  if (exampleName && categoryName) {
    handleError(ERROR_MESSAGES.BOTH_SPECIFIED);
  }

  const mode = exampleName ? "example" : "category";
  const name = (exampleName || categoryName) as string;

  try {
    if (mode === "example") {
      validateExample(name);
    } else {
      validateCategory(name);
    }
  } catch (error) {
    log.message(
      "Available: " +
        Object.keys(mode === "example" ? EXAMPLES : CATEGORIES).join(", ")
    );
    handleError(error);
  }

  const defaultOutput =
    mode === "example" ? `./my-${name}-project` : `./my-${name}-examples`;
  const output = outputDir || defaultOutput;
  const resolved = path.resolve(process.cwd(), output);

  try {
    validateDirectoryNotExists(resolved);
  } catch (error) {
    handleError(error);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fhevm-"));

  try {
    log.info(`\n🚀 Creating ${mode}: ${pc.yellow(name)}`);
    log.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    log.dim("Downloading template...");

    const tempRepoPath = await cloneTemplate(tempDir);

    log.dim("Initializing submodules...");
    await initSubmodule(tempRepoPath);

    log.dim("Building project...");
    if (mode === "example") {
      await createSingleExample(name, resolved, tempRepoPath);
    } else {
      await createCategoryProject(name, resolved, tempRepoPath);
    }

    log.success(`\n✨ Successfully created: ${pc.cyan(output)}`);

    if (shouldInstall) {
      log.dim("Installing dependencies and running tests...");
      await runInstallAndTest(resolved);
    } else {
      log.message(pc.dim("\nNext steps:"));
      log.message(`  ${pc.cyan("cd")} ${output}`);
      log.message(`  ${pc.cyan("npm install")}`);
      log.message(`  ${pc.cyan("npm run compile")}`);
      log.message(`  ${pc.cyan("npm run test")}`);
    }
  } catch (error) {
    handleError(error);
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
  handleError(error);
});
