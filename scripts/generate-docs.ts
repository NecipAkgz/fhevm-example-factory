#!/usr/bin/env node

/**
 * Documentation Generator - Creates GitBook-compatible markdown docs.
 *
 * Processes FHEVM examples to produce structured documentation,
 * including contract descriptions and automated index updates.
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";

import { EXAMPLES, getDocsFileName } from "./config";
import {
  getRootDir,
  getContractName,
  generateGitBookMarkdown,
  log,
  handleError,
} from "./utils";

// =============================================================================
// Documentation Generator
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
// Interactive Mode
// =============================================================================

export async function handleInteractiveDocs(): Promise<void> {
  console.clear();
  p.intro(pc.bgCyan(pc.black(" 📚 Generate Documentation ")));

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
    return;
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
      return;
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
      pc.dim("💡 Tip: Run 'npm run create:docs' to regenerate all docs")
    );
    p.outro(pc.green("🎉 Documentation generated!"));
  } catch (error) {
    s.stop("Failed to generate documentation");
    p.log.error(error instanceof Error ? error.message : String(error));
  }
}

// =============================================================================
// QUICK MODE (CLI)
// =============================================================================

export async function handleDirect(args: string[]): Promise<void> {
  const [target] = args;

  if (!target) {
    log.info("Generating all documentation...");
    const count = await generateDocumentation("all");
    log.success(`✓ Generated ${count} documentation files`);
    return;
  }

  if (!EXAMPLES[target]) {
    log.message("Available: " + Object.keys(EXAMPLES).join(", "));
    handleError(`Unknown example "${target}"`);
  }

  log.info(`Generating docs for: ${target}`);
  await generateDocumentation(target);
  log.success(`✓ Generated: docs/${getDocsFileName(target)}.md`);
}

// =============================================================================
// Help
// =============================================================================

function showHelp(): void {
  log.info("📚 FHEVM Documentation Generator");
  log.message("");
  log.message("Usage:");
  log.message("  npm run create:docs              Generate all docs");
  log.message(
    "  npm run create:docs <example>    Generate specific example doc"
  );
  log.message("");
  log.message("Examples:");
  log.dim("  npm run create:docs");
  log.dim("  npm run create:docs fhe-counter");
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  await handleDirect(args);
}

const isMainModule = process.argv[1]?.includes("generate-docs");
if (isMainModule) {
  main().catch(console.error);
}
