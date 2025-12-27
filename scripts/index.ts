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

import { EXAMPLES, CATEGORIES } from "./shared/config";

import {
  log,
  handleError,
  ERROR_MESSAGES,
  validateExample,
  validateCategory,
  validateDirectoryNotExists,
} from "./shared/utils";

import { createSingleExample, createCategoryProject } from "./shared/builders";

import {
  promptSelectCategory,
  promptSelectExampleFromCategory,
  promptSelectCategoryProject,
  runInstall,
} from "./shared/ui";

import { runAddMode } from "./commands/add-mode";
import { handleInteractiveDocs as runDocGeneration } from "./commands/generate-docs";

// =============================================================================
// INTERACTIVE MODE
// =============================================================================

/** Helper to check if user cancelled and show message */
function checkCancel<T>(value: T | symbol): value is symbol {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    return true;
  }
  return false;
}

/** Project configuration from interactive prompts */
interface ProjectConfig {
  mode: "single" | "category";
  name: string;
  outputDir: string;
  shouldInstall: boolean;
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

  if (checkCancel(mode)) return null;

  let name: string;

  if (mode === "single") {
    const category = await promptSelectCategory();
    if (checkCancel(category)) return null;

    const example = await promptSelectExampleFromCategory(category as string);
    if (checkCancel(example)) return null;

    name = example as string;
  } else if (mode === "docs") {
    // Handle docs mode - call generate-docs interactive
    await runDocGeneration();
    return null; // Exit after docs generation
  } else {
    const category = await promptSelectCategoryProject();
    if (checkCancel(category)) return null;

    name = category as string;
  }

  const projectName = await p.text({
    message: "Project name:",
    placeholder: name,
    defaultValue: name,
  });
  if (checkCancel(projectName)) return null;

  const outputDir = await p.text({
    message: "Output directory:",
    placeholder: `./${projectName}`,
    defaultValue: `./${projectName}`,
  });
  if (checkCancel(outputDir)) return null;

  const shouldInstall = await p.confirm({
    message: "Install dependencies?",
    initialValue: false,
  });
  if (checkCancel(shouldInstall)) return null;

  return {
    mode: mode as "single" | "category",
    name,
    outputDir: outputDir as string,
    shouldInstall: shouldInstall as boolean,
  };
}

/** Scaffolds project and shows completion message */
async function scaffoldProject(config: ProjectConfig): Promise<void> {
  const resolvedOutput = path.resolve(process.cwd(), config.outputDir);

  if (fs.existsSync(resolvedOutput)) {
    p.log.error(`Directory already exists: ${resolvedOutput}`);
    process.exit(1);
  }

  const s = p.spinner();

  try {
    s.start("Scaffolding your confidential project...");

    if (config.mode === "single") {
      createSingleExample(config.name, resolvedOutput);
    } else {
      createCategoryProject(config.name, resolvedOutput);
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

    if (config.shouldInstall) {
      p.log.message("");
      await runInstall(resolvedOutput);
    } else {
      p.note(
        `${pc.dim("$")} cd ${relativePath}\n${pc.dim(
          "$"
        )} npm install\n${pc.dim("$")} npm run compile\n${pc.dim(
          "$"
        )} npm run test`,
        "🚀 Quick Start"
      );
    }
  } catch (error) {
    s.stop(pc.red("Failed to create project"));
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
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

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  // Short flag mappings
  const shortFlags: Record<string, string> = {
    "-e": "example",
    "-c": "category",
    "-o": "output",
    "-a": "add",
    "-i": "install",
    "-h": "help",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle long flags (--example, --category, etc.)
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        parsed[key] = nextArg;
        i++;
      } else {
        parsed[key] = true;
      }
    }
    // Handle short flags (-e, -c, -o, -a, -i, -h)
    else if (arg.startsWith("-") && shortFlags[arg]) {
      const key = shortFlags[arg];
      const nextArg = args[i + 1];

      // Flags that take values: -e, -c, -o
      if (
        ["example", "category", "output"].includes(key) &&
        nextArg &&
        !nextArg.startsWith("-")
      ) {
        parsed[key] = nextArg;
        i++;
      } else {
        parsed[key] = true;
      }
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

  const defaultOutput = mode === "example" ? `./${name}` : `./${name}-examples`;
  const output = outputDir || defaultOutput;
  const resolved = path.resolve(process.cwd(), output);

  try {
    validateDirectoryNotExists(resolved);
  } catch (error) {
    handleError(error);
  }

  try {
    log.info(`\n🚀 Creating ${mode}: ${pc.yellow(name)}`);
    log.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    log.dim("Building project...");

    if (mode === "example") {
      createSingleExample(name, resolved);
    } else {
      createCategoryProject(name, resolved);
    }

    log.success(`\n✨ Successfully created: ${pc.cyan(output)}`);

    if (shouldInstall) {
      log.dim("Installing dependencies...");
      await runInstall(resolved);
    } else {
      log.message(pc.dim("\nNext steps:"));
      log.message(`  ${pc.cyan("cd")} ${output}`);
      log.message(`  ${pc.cyan("npm install")}`);
      log.message(`  ${pc.cyan("npm run compile")}`);
      log.message(`  ${pc.cyan("npm run test")}`);
    }
  } catch (error) {
    handleError(error);
  }
}

// =============================================================================
// QUICK MODE (CLI Arguments)
// =============================================================================

function showHelp(): void {
  const isDev = process.env.LOCAL_DEV === "1";

  if (isDev) {
    // Developer help - show npm run scripts
    console.log(`
${pc.bgCyan(pc.black(pc.bold(" 🔐 FHEVM Example Factory - Developer Mode ")))}
${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}

${pc.cyan(pc.bold("📋 CREATE COMMANDS"))}

  ${pc.green("npm run create")}              Interactive mode ${pc.yellow(
      "(recommended)"
    )}
  ${pc.green("npm run create:example")} ${pc.dim(
      "<name>"
    )}  Create single example
  ${pc.green("npm run create:category")} ${pc.dim(
      "<name>"
    )} Create category project
  ${pc.green("npm run generate:docs")}         Generate documentation

${pc.cyan(pc.bold("🛠️  MAINTENANCE"))}

  ${pc.green("npm run test:all")}            Test multiple examples
  ${pc.green("npm run generate:config")}     Update contract registry
  ${pc.green("npm run doctor")}              System health check

${pc.cyan(pc.bold("❓ HELP"))}

  ${pc.green("npm run help:create")}         This help
  ${pc.green("npm run help:docs")}           Docs generator help
  ${pc.green("npm run help:test")}           Test runner help

${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}
`);
  } else {
    // End-user help - show npx commands
    console.log(`
${pc.bgCyan(pc.black(pc.bold(" 🔐 create-fhevm-example ")))}
${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}

${pc.cyan(pc.bold("📋 USAGE"))}

  ${pc.dim("$")} npx create-fhevm-example                    ${pc.dim(
      "→"
    )} Interactive ${pc.yellow("(recommended)")}
  ${pc.dim("$")} npx create-fhevm-example ${pc.green("--example")} ${pc.yellow(
      "<name>"
    )}   ${pc.dim("→")} Single example
  ${pc.dim("$")} npx create-fhevm-example ${pc.green("--category")} ${pc.yellow(
      "<name>"
    )}  ${pc.dim("→")} Category project
  ${pc.dim("$")} npx create-fhevm-example ${pc.green(
      "--add"
    )}                ${pc.dim("→")} Add to existing project

${pc.cyan(pc.bold("⚙️  OPTIONS"))}

  ${pc.green("--example")} ${pc.dim("<name>")}     Single example project
  ${pc.green("--category")} ${pc.dim("<name>")}    Category project
  ${pc.green("--add")}                Add FHEVM to existing Hardhat project
  ${pc.green("--output")} ${pc.dim("<dir>")}       Output directory
  ${pc.green("--install")}            Auto-install dependencies
  ${pc.green("--help")}               Show this help

${pc.cyan(pc.bold("⚡ EXAMPLES"))}

  ${pc.dim("$")} npx create-fhevm-example --example fhe-counter
  ${pc.dim("$")} npx create-fhevm-example --category basic --output ./my-project
  ${pc.dim("$")} npx create-fhevm-example --add

${pc.cyan(pc.bold("📦 AVAILABLE"))}

  Examples: ${pc.dim(Object.keys(EXAMPLES).slice(0, 5).join(", "))} ${pc.dim(
      "..."
    )} (${Object.keys(EXAMPLES).length} total)
  Categories: ${Object.keys(CATEGORIES)
    .map((c) => pc.yellow(c))
    .join(", ")}

${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}
${pc.dim("📚 Docs:")} ${pc.blue(
      "https://github.com/NecipAkgz/fhevm-example-factory"
    )}
`);
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
