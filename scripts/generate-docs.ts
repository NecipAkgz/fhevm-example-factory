#!/usr/bin/env node

/**
 * Generate Documentation - GitBook Documentation Generator
 *
 * Generates GitBook-compatible markdown documentation for FHEVM examples:
 * - Extracts contract and test code
 * - Formats with GitBook tabs and hints
 * - Outputs to docs/ directory
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";

import { EXAMPLES, getDocsFileName } from "./shared/config";
import {
  getRootDir,
  getContractName,
  generateGitBookMarkdown,
} from "./shared/utils";

// =============================================================================
// Documentation Generator
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
// Interactive Mode
// =============================================================================

/**
 * Handles the "Generate documentation" flow
 */
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
// Direct Mode (CLI)
// =============================================================================

/**
 * Handles direct mode with CLI arguments
 */
export async function handleDirect(args: string[]): Promise<void> {
  const [target] = args;

  // No argument = generate all docs
  if (!target) {
    console.log(pc.cyan("Generating all documentation..."));
    const count = await generateDocumentation("all");
    console.log(pc.green(`✓ Generated ${count} documentation files`));
    return;
  }

  // Specific example name
  if (!EXAMPLES[target]) {
    console.error(pc.red(`Error: Unknown example "${target}"`));
    console.log("Available:", Object.keys(EXAMPLES).join(", "));
    process.exit(1);
  }

  console.log(pc.cyan(`Generating docs for: ${target}`));
  await generateDocumentation(target);
  console.log(pc.green(`✓ Generated: docs/${getDocsFileName(target)}.md`));
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    await handleDirect(args);
  } else {
    await handleInteractiveDocs();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
