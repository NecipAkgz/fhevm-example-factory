/**
 * User Interface - Prompts & Commands
 *
 * Interactive prompts and command execution for CLI.
 * Combines functionality from prompts.ts and commands.ts
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { EXAMPLES, CATEGORIES } from "./config.js";
import {
  CATEGORY_ICON,
  CATEGORY_ORDER,
  runCommand,
  extractTestResults,
} from "./utils.js";

// =============================================================================
// Category Helpers
// =============================================================================

/**
 * Counts how many examples exist in each category
 */
export function countExamplesPerCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const config of Object.values(EXAMPLES)) {
    counts[config.category] = (counts[config.category] || 0) + 1;
  }
  return counts;
}

// =============================================================================
// Selection Prompts
// =============================================================================

/**
 * Prompts user to select a category
 */
export async function promptSelectCategory(): Promise<string | symbol> {
  const categoryCounts = countExamplesPerCategory();

  // Get all categories, prioritizing CATEGORY_ORDER, then alphabetically sorted others
  const allCategories = Object.keys(categoryCounts);
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((cat) => allCategories.includes(cat)),
    ...allCategories.filter((cat) => !CATEGORY_ORDER.includes(cat)).sort(),
  ];

  return p.select({
    message: "Select a category:",
    options: orderedCategories.map((category) => ({
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
export async function promptSelectExampleFromCategory(
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
export async function promptSelectCategoryProject(): Promise<string | symbol> {
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
// Install & Test Commands
// =============================================================================

/**
 * Runs npm install, compile, and test in the project directory
 */
export async function runInstallAndTest(projectPath: string): Promise<void> {
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
 * Shows quick start commands for the created project
 */
export function showQuickStart(relativePath: string): void {
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
export async function askInstallAndTest(
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
