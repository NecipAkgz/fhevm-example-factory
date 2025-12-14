#!/usr/bin/env node

/**
 * FHEVM Example Factory - Interactive Menu
 *
 * Main entry point with mode selection:
 * - Single Example
 * - Category Project
 * - Documentation
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { spawn } from "child_process";
import * as path from "path";

function showHelp(): void {
  console.log(`
${pc.bgCyan(pc.black(pc.bold(" 🔐 FHEVM Example Factory ")))}
${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}

${pc.cyan(pc.bold("📋 COMMANDS"))}

  ${pc.green("npm run create")}               ${pc.dim(
    "→"
  )} Interactive menu ${pc.yellow("(recommended)")}
  ${pc.green("npm run create:example")} ${pc.dim("[name]")}  ${pc.dim(
    "→"
  )} Create single example
  ${pc.green("npm run create:category")} ${pc.dim("[name]")} ${pc.dim(
    "→"
  )} Create category project
  ${pc.green("npm run create:docs")} ${pc.dim("[name]")}     ${pc.dim(
    "→"
  )} Generate documentation
  ${pc.green("npm run create:help")}          ${pc.dim("→")} Show this help

${pc.cyan(pc.bold("🎯 INTERACTIVE MODE"))}

  ${pc.dim("$")} ${pc.white("npm run create")}
  ${pc.dim("  ├─")} Select: ${pc.magenta("Example")} │ ${pc.magenta(
    "Category"
  )} │ ${pc.magenta("Documentation")}
  ${pc.dim("  └─")} Follow the guided prompts

${pc.cyan(pc.bold("⚡ DIRECT MODE EXAMPLES"))}

  ${pc.dim("$")} ${pc.white("npm run create:example")} ${pc.yellow(
    "fhe-counter"
  )} ${pc.blue("./my-project")}
  ${pc.dim("$")} ${pc.white("npm run create:category")} ${pc.yellow(
    "basic"
  )} ${pc.blue("./output/basic-examples")}
  ${pc.dim("$")} ${pc.white("npm run create:docs")}

${pc.cyan(pc.bold("🛠️  MAINTENANCE"))}

  ${pc.green("npm run test:all")}         ${pc.dim(
    "→"
  )} Test all examples interactively
  ${pc.green("npm run generate:config")}  ${pc.dim(
    "→"
  )} Regenerate config from contracts

${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}
${pc.dim("📚 Documentation:")} ${pc.blue("scripts/README.md")}
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle --help flag
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  console.clear();
  p.intro(pc.bgCyan(pc.black(" 🔐 FHEVM Example Factory ")));

  const mode = await p.select({
    message: "What would you like to do?",
    options: [
      {
        value: "example",
        label: "Create a single example",
        hint: "Standalone project with one contract",
      },
      {
        value: "category",
        label: "Create a category project",
        hint: "Multiple related examples in one project",
      },
      {
        value: "docs",
        label: "Generate documentation",
        hint: "GitBook-compatible markdown",
      },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const scriptMap: Record<string, string> = {
    example: "create-example.ts",
    category: "create-category.ts",
    docs: "generate-docs.ts",
  };

  const script = path.join(__dirname, scriptMap[mode as string]);

  // Run the selected script
  const child = spawn("npx", ["ts-node", script], {
    stdio: "inherit",
    shell: true,
  });

  child.on("close", (code) => {
    process.exit(code || 0);
  });
}

main().catch(console.error);
