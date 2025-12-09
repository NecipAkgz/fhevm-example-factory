#!/usr/bin/env node
/**
 * create-fhevm-example - CLI for creating FHEVM example projects
 *
 * Usage:
 *   npx create-fhevm-example
 *   npx create-fhevm-example --example fhe-counter
 *   npx create-fhevm-example --category basic
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { EXAMPLES, CATEGORIES } from "./config.js";
import { cloneTemplate, initSubmodule, copyDirectoryRecursive, getContractName, downloadFileFromGitHub, runCommand, extractTestResults, generateDeployScript, } from "./utils.js";
// =============================================================================
// Create Single Example
// =============================================================================
async function createSingleExample(exampleName, outputDir, tempRepoPath) {
    const example = EXAMPLES[exampleName];
    if (!example) {
        throw new Error(`Unknown example: ${exampleName}`);
    }
    const templateDir = path.join(tempRepoPath, "fhevm-hardhat-template");
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
    // Download contract and test from GitHub
    await downloadFileFromGitHub(example.contract, path.join(outputDir, "contracts", `${contractName}.sol`));
    // Remove .gitkeep from contracts
    const contractsGitkeep = path.join(outputDir, "contracts", ".gitkeep");
    if (fs.existsSync(contractsGitkeep)) {
        fs.unlinkSync(contractsGitkeep);
    }
    // Clear test directory
    const testDir = path.join(outputDir, "test");
    fs.readdirSync(testDir).forEach((file) => {
        if (file.endsWith(".ts") || file === ".gitkeep") {
            fs.unlinkSync(path.join(testDir, file));
        }
    });
    // Download test file
    await downloadFileFromGitHub(example.test, path.join(outputDir, "test", path.basename(example.test)));
    // Update deploy script
    fs.writeFileSync(path.join(outputDir, "deploy", "deploy.ts"), generateDeployScript(contractName));
    // Update package.json
    const packageJsonPath = path.join(outputDir, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    packageJson.name = `fhevm-example-${exampleName}`;
    packageJson.description = example.description;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    // Update hardhat.config.ts - remove FHECounter task import
    const configPath = path.join(outputDir, "hardhat.config.ts");
    let configContent = fs.readFileSync(configPath, "utf-8");
    configContent = configContent.replace(/import "\.\/tasks\/FHECounter";\n?/g, "");
    fs.writeFileSync(configPath, configContent);
    // Remove FHECounter task
    const oldTaskFile = path.join(outputDir, "tasks", "FHECounter.ts");
    if (fs.existsSync(oldTaskFile)) {
        fs.unlinkSync(oldTaskFile);
    }
    // Note: README.md from template is kept as-is
}
// =============================================================================
// Create Category Project
// =============================================================================
async function createCategoryProject(categoryName, outputDir, tempRepoPath) {
    const category = CATEGORIES[categoryName];
    if (!category) {
        throw new Error(`Unknown category: ${categoryName}`);
    }
    const templateDir = path.join(tempRepoPath, "fhevm-hardhat-template");
    // Copy template
    copyDirectoryRecursive(templateDir, outputDir);
    // Clear template files
    const templateContract = path.join(outputDir, "contracts", "FHECounter.sol");
    if (fs.existsSync(templateContract))
        fs.unlinkSync(templateContract);
    // Remove .gitkeep from contracts
    const contractsGitkeep = path.join(outputDir, "contracts", ".gitkeep");
    if (fs.existsSync(contractsGitkeep))
        fs.unlinkSync(contractsGitkeep);
    // Clear test directory
    const testDir = path.join(outputDir, "test");
    fs.readdirSync(testDir).forEach((file) => {
        if (file.endsWith(".ts") || file === ".gitkeep") {
            fs.unlinkSync(path.join(testDir, file));
        }
    });
    // Download contracts and tests
    const contractNames = [];
    for (const item of category.contracts) {
        const contractName = getContractName(item.sol);
        if (contractName) {
            contractNames.push(contractName);
            await downloadFileFromGitHub(item.sol, path.join(outputDir, "contracts", `${contractName}.sol`));
        }
        if (item.test) {
            await downloadFileFromGitHub(item.test, path.join(outputDir, "test", path.basename(item.test)));
        }
    }
    // Update hardhat.config.ts - remove FHECounter task import
    const configPath = path.join(outputDir, "hardhat.config.ts");
    let configContent = fs.readFileSync(configPath, "utf-8");
    configContent = configContent.replace(/import "\.\/tasks\/FHECounter";\n?/g, "");
    fs.writeFileSync(configPath, configContent);
    // Remove FHECounter task
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
    // Note: README.md from template is kept as-is
}
// =============================================================================
// Install and Test
// =============================================================================
async function runInstallAndTest(projectPath) {
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
                }
                else {
                    s.stop(pc.green(`✓ ${step.name} completed`));
                }
            }
            else {
                s.stop(pc.green(`✓ ${step.name} completed`));
            }
        }
        catch (error) {
            s.stop(pc.red(`✗ ${step.name} failed`));
            if (error instanceof Error) {
                p.log.error(error.message);
            }
            throw new Error(`${step.name} failed`);
        }
    }
    p.log.success(pc.green("All steps completed successfully!"));
}
function showQuickStart(relativePath) {
    p.note(`${pc.dim("$")} cd ${relativePath}\n${pc.dim("$")} npm install\n${pc.dim("$")} npm run compile\n${pc.dim("$")} npm run test`, "🚀 Quick Start");
}
async function askInstallAndTest(resolvedOutput, relativePath) {
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
    }
    else {
        showQuickStart(relativePath);
    }
}
// =============================================================================
// Interactive Mode
// =============================================================================
async function runInteractiveMode() {
    console.clear();
    p.intro(pc.bgCyan(pc.black(" 🔐 Create FHEVM Example ")));
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
    if (mode === "single") {
        // Category icons for visual organization
        const categoryIcons = {
            Basic: "📚",
            "Basic - Encryption": "🔐",
            "Basic - Decryption": "🔓",
            "FHE Operations": "🔢",
            Concepts: "💡",
            OpenZeppelin: "🛡️",
            Advanced: "🚀",
        };
        // Group examples by category
        const grouped = {};
        for (const [key, config] of Object.entries(EXAMPLES)) {
            if (!grouped[config.category]) {
                grouped[config.category] = [];
            }
            const icon = categoryIcons[config.category] || "📁";
            grouped[config.category].push({
                value: key,
                label: `${icon} ${key}`,
                hint: config.description.slice(0, 60) +
                    (config.description.length > 60 ? "..." : ""),
            });
        }
        // Build options with category order
        const options = [];
        const categoryOrder = [
            "Basic",
            "Basic - Encryption",
            "Basic - Decryption",
            "FHE Operations",
            "Concepts",
            "OpenZeppelin",
            "Advanced",
        ];
        for (const category of categoryOrder) {
            if (grouped[category]) {
                options.push(...grouped[category]);
            }
        }
        exampleName = await p.select({
            message: "Select an example:",
            options,
        });
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
        // Category icons for visual organization
        const categoryIcons = {
            basic: "📚",
            concepts: "💡",
            operations: "🔢",
            openzeppelin: "🛡️",
            advanced: "🚀",
        };
        categoryName = await p.select({
            message: "Select a category:",
            options: Object.entries(CATEGORIES).map(([key, config]) => ({
                value: key,
                label: `${categoryIcons[key] || "📁"} ${config.name}`,
                hint: `${config.contracts.length} contracts`,
            })),
        });
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
    // Clone repository to temp directory
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
        // Cleanup temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
    p.outro(pc.green("🎉 Happy coding with FHEVM!"));
}
// =============================================================================
// Direct Mode (CLI Arguments)
// =============================================================================
function showHelp() {
    console.log(`
${pc.cyan("create-fhevm-example")}

${pc.yellow("Usage:")}
  npx create-fhevm-example                     ${pc.dim("# Interactive mode")}
  npx create-fhevm-example --example <name>    ${pc.dim("# Create single example")}
  npx create-fhevm-example --category <name>   ${pc.dim("# Create category project")}

${pc.yellow("Options:")}
  --example <name>     Create a single example project
  --category <name>    Create a category project
  --output <dir>       Output directory (default: ./<project-name>)
  --install            Auto-install dependencies
  --test               Auto-run tests (requires --install)
  --help, -h           Show this help message

${pc.yellow("Examples:")}
  ${pc.green("npx create-fhevm-example --example fhe-counter")}
  ${pc.green("npx create-fhevm-example --category basic --output ./my-project")}
  ${pc.green("npx create-fhevm-example --example fhe-counter --install --test")}

${pc.yellow("Available examples:")}
  ${Object.keys(EXAMPLES).join(", ")}

${pc.yellow("Available categories:")}
  ${Object.keys(CATEGORIES).join(", ")}
`);
}
async function runDirectMode(args) {
    const parsedArgs = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith("--")) {
            const key = arg.slice(2);
            const nextArg = args[i + 1];
            if (nextArg && !nextArg.startsWith("--")) {
                parsedArgs[key] = nextArg;
                i++;
            }
            else {
                parsedArgs[key] = true;
            }
        }
        else if (arg === "-h") {
            parsedArgs["help"] = true;
        }
    }
    if (parsedArgs["help"]) {
        showHelp();
        return;
    }
    const exampleName = parsedArgs["example"];
    const categoryName = parsedArgs["category"];
    const outputDir = parsedArgs["output"];
    const shouldInstall = parsedArgs["install"] === true;
    const shouldTest = parsedArgs["test"] === true;
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
    const name = (exampleName || categoryName);
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
    const defaultOutput = mode === "example" ? `./my-${name}-project` : `./my-${name}-examples`;
    const output = outputDir || defaultOutput;
    const resolved = path.resolve(process.cwd(), output);
    if (fs.existsSync(resolved)) {
        console.error(pc.red(`Error: Directory already exists: ${resolved}`));
        process.exit(1);
    }
    // Clone repository to temp directory
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
        }
        else {
            await createCategoryProject(name, resolved, tempRepoPath);
        }
        console.log(pc.green(`✓ Created: ${output}`));
        if (shouldInstall) {
            console.log(pc.dim("\nInstalling dependencies..."));
            await runInstallAndTest(resolved);
        }
        else {
            console.log(pc.dim(`\nNext: cd ${output} && npm install && npm run compile && npm run test`));
        }
    }
    catch (error) {
        console.error(pc.red("Error:"), error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
    finally {
        // Cleanup temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}
// =============================================================================
// Main
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
    console.error(pc.red("Fatal error:"), error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map