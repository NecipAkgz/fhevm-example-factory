import * as p from "@clack/prompts";
import pc from "picocolors";

import { EXAMPLES } from "./shared/config";
import { handleInteractiveExample } from "./create-example";
import { handleInteractiveCategory } from "./create-category";
import { handleInteractiveDocs } from "./generate-docs";

async function main(): Promise<void> {
  console.clear();

  p.intro(
    pc.bgCyan(
      pc.black(` ⚡ FHEVM Example Factory (${Object.keys(EXAMPLES).length}) `)
    )
  );

  const action = await p.select({
    message: "What would you like to do?",
    options: [
      {
        value: "example",
        label: "Create a single example project",
        hint: "Ready-to-use Hardhat environment",
      },
      {
        value: "category",
        label: "Create a category-based project",
        hint: "Bundle all examples from a category",
      },
      {
        value: "docs",
        label: "Generate documentation",
        hint: "Markdown files for GitBook",
      },
    ],
  });

  if (p.isCancel(action)) {
    p.cancel("Operation Cancelled!");
    process.exit(0);
  }

  try {
    switch (action) {
      case "example":
        await handleInteractiveExample();
        break;
      case "category":
        await handleInteractiveCategory();
        break;
      case "docs":
        await handleInteractiveDocs();
        break;
    }
  } catch (error) {
    p.log.error("An unexpected error occurred:");
    p.log.error(error instanceof Error ? error.message : String(error));
  }
}

main().catch(console.error);
