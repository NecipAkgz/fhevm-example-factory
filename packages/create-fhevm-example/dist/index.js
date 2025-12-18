#!/usr/bin/env node
/**
 * create-fhevm-example - CLI for creating FHEVM example projects
 *
 * Usage:
 *   npx create-fhevm-example                    # Interactive mode
 *   npx create-fhevm-example --example <name>   # Create single example
 *   npx create-fhevm-example --category <name>  # Create category project
 *   npx create-fhevm-example --add              # Add to existing project
 *
 * This is the main entry point - similar to scripts/create.ts in main project.
 * Actual logic is split into:
 *   - builders.ts   (createSingleExample, createCategoryProject)
 *   - ui.ts         (prompts + commands)
 *   - utils.ts      (file operations + constants + utilities)
 *   - config.ts     (examples & categories)
 *   - add-mode.ts   (add to existing project)
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
// Config
import { EXAMPLES, CATEGORIES } from "./config.js";
// Utilities
import { cloneTemplate, initSubmodule, log, ERROR_MESSAGES, validateExample, validateCategory, validateDirectoryNotExists, } from "./utils.js";
// Builders
import { createSingleExample, createCategoryProject } from "./builders.js";
// UI (Prompts + Commands)
import { promptSelectCategory, promptSelectExampleFromCategory, promptSelectCategoryProject, askInstallAndTest, runInstallAndTest, } from "./ui.js";
// Add Mode
import { runAddMode } from "./add-mode.js";
// =============================================================================
// INTERACTIVE MODE
// =============================================================================
/**
 * Main interactive mode flow
 * Guides user through project creation with prompts
 */
async function runInteractiveMode() {
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
    let exampleName = "";
    let categoryName = "";
    let projectName = "";
    // Step 2: Select based on mode
    if (mode === "single") {
        const selectedCategory = await promptSelectCategory();
        if (p.isCancel(selectedCategory)) {
            p.cancel("Operation cancelled.");
            process.exit(0);
        }
        exampleName = await promptSelectExampleFromCategory(selectedCategory);
        if (p.isCancel(exampleName)) {
            p.cancel("Operation cancelled.");
            process.exit(0);
        }
        projectName = await p.text({
            message: "Project name:",
            placeholder: `my-${exampleName}-project`,
            defaultValue: `my-${exampleName}-project`,
        });
    }
    else {
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
    const resolvedOutput = path.resolve(process.cwd(), outputDir);
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
            await createSingleExample(exampleName, resolvedOutput, tempRepoPath);
        }
        else {
            await createCategoryProject(categoryName, resolvedOutput, tempRepoPath);
        }
        s.stop("Project created successfully!");
        const relativePath = path.relative(process.cwd(), resolvedOutput);
        p.log.success(`📁 Created: ${pc.cyan(relativePath)}`);
        if (mode === "single") {
            const exampleConfig = EXAMPLES[exampleName];
            p.log.info(`📝 Example: ${pc.yellow(exampleConfig?.title || exampleName)}`);
        }
        else {
            const categoryConfig = CATEGORIES[categoryName];
            p.log.info(`📦 Category: ${pc.yellow(categoryConfig?.name || categoryName)}`);
            p.log.info(`📄 Contracts: ${pc.green(String(categoryConfig?.contracts.length || 0))}`);
        }
        await askInstallAndTest(resolvedOutput, relativePath);
    }
    catch (error) {
        s.stop("Failed to create project");
        p.log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
    finally {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
    p.outro(pc.green("✅ Setup complete. Happy encrypting!"));
}
// =============================================================================
// DIRECT MODE (CLI Arguments)
// =============================================================================
/**
 * Shows help information for CLI usage
 */
function showHelp() {
    console.log(`
${pc.bgCyan(pc.black(pc.bold(" 🔐 create-fhevm-example ")))}
${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}

${pc.cyan(pc.bold("📋 USAGE"))}

  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")}                  ${pc.dim("→")} Interactive mode ${pc.yellow("(recommended)")}
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green("--example")} ${pc.yellow("<name>")}  ${pc.dim("→")} Create single example
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green("--category")} ${pc.yellow("<name>")} ${pc.dim("→")} Create category project
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green("--add")}               ${pc.dim("→")} Add to existing project

${pc.cyan(pc.bold("⚙️  OPTIONS"))}

  ${pc.green("--example")} ${pc.dim("<name>")}      Create a single example project
  ${pc.green("--category")} ${pc.dim("<name>")}     Create a category project
  ${pc.green("--add")}                 Add FHEVM to existing Hardhat project
  ${pc.green("--target")} ${pc.dim("<dir>")}        Target directory for --add mode
  ${pc.green("--output")} ${pc.dim("<dir>")}        Output directory
  ${pc.green("--install")}             Auto-install dependencies
  ${pc.green("--test")}                Auto-run tests (requires --install)
  ${pc.green("--help")}${pc.dim(", -h")}            Show this help message

${pc.cyan(pc.bold("⚡ EXAMPLES"))}

  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green("--example")} ${pc.yellow("fhe-counter")}
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green("--category")} ${pc.yellow("basic")} ${pc.green("--output")} ${pc.blue("./my-project")}
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green("--add")}
  ${pc.dim("$")} ${pc.white("npx create-fhevm-example")} ${pc.green("--example")} ${pc.yellow("fhe-counter")} ${pc.green("--install")} ${pc.green("--test")}

${pc.cyan(pc.bold("📦 AVAILABLE EXAMPLES"))}

  ${pc.dim(Object.keys(EXAMPLES).slice(0, 10).join(", "))}
  ${pc.dim("...")} and ${pc.yellow(String(Object.keys(EXAMPLES).length - 10))} more

${pc.cyan(pc.bold("📁 AVAILABLE CATEGORIES"))}

  ${Object.keys(CATEGORIES)
        .map((c) => pc.yellow(c))
        .join(", ")}

${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}
${pc.dim("📚 Documentation:")} ${pc.blue("https://github.com/NecipAkgz/fhevm-example-factory")}
`);
}
/**
 * Parses CLI arguments into a key-value object
 */
function parseArgs(args) {
    const parsed = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith("--")) {
            const key = arg.slice(2);
            const nextArg = args[i + 1];
            if (nextArg && !nextArg.startsWith("--")) {
                parsed[key] = nextArg;
                i++;
            }
            else {
                parsed[key] = true;
            }
        }
        else if (arg === "-h") {
            parsed["help"] = true;
        }
    }
    return parsed;
}
/**
 * Handles direct mode (CLI with arguments, non-interactive)
 */
async function runDirectMode(args) {
    const parsedArgs = parseArgs(args);
    if (parsedArgs["help"]) {
        showHelp();
        return;
    }
    // Handle --add mode
    if (parsedArgs["add"]) {
        const targetDir = parsedArgs["target"];
        await runAddMode(targetDir);
        return;
    }
    const exampleName = parsedArgs["example"];
    const categoryName = parsedArgs["category"];
    const outputDir = parsedArgs["output"];
    const shouldInstall = parsedArgs["install"] === true;
    // Validation
    if (!exampleName && !categoryName) {
        log.error(ERROR_MESSAGES.EXAMPLE_REQUIRED);
        showHelp();
        process.exit(1);
    }
    if (exampleName && categoryName) {
        log.error(ERROR_MESSAGES.BOTH_SPECIFIED);
        process.exit(1);
    }
    const mode = exampleName ? "example" : "category";
    const name = (exampleName || categoryName);
    try {
        if (mode === "example") {
            validateExample(name);
        }
        else {
            validateCategory(name);
        }
    }
    catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        log.message("Available: " +
            Object.keys(mode === "example" ? EXAMPLES : CATEGORIES).join(", "));
        process.exit(1);
    }
    const defaultOutput = mode === "example" ? `./my-${name}-project` : `./my-${name}-examples`;
    const output = outputDir || defaultOutput;
    const resolved = path.resolve(process.cwd(), output);
    try {
        validateDirectoryNotExists(resolved);
    }
    catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
    // Create project
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fhevm-"));
    try {
        log.info(`Creating ${mode}: ${name}`);
        log.dim("Downloading template...");
        const tempRepoPath = await cloneTemplate(tempDir);
        log.dim("Initializing submodules...");
        await initSubmodule(tempRepoPath);
        log.dim("Creating project...");
        if (mode === "example") {
            await createSingleExample(name, resolved, tempRepoPath);
        }
        else {
            await createCategoryProject(name, resolved, tempRepoPath);
        }
        log.success(`✓ Created: ${output}`);
        if (shouldInstall) {
            log.dim("\nInstalling dependencies...");
            await runInstallAndTest(resolved);
        }
        else {
            log.dim(`\nNext: cd ${output} && npm install && npm run compile && npm run test`);
        }
    }
    catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
    finally {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}
// =============================================================================
// MAIN ENTRY POINT
// =============================================================================
async function main() {
    const args = process.argv.slice(2);
    if (args.length > 0) {
        await runDirectMode(args);
    }
    else {
        await runInteractiveMode();
    }
}
main().catch((error) => {
    log.error("Fatal error: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
});
//# sourceMappingURL=index.js.map