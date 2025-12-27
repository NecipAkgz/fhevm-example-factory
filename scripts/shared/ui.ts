/**
 * User Interface - CLI Prompts and Interaction Logic.
 *
 * Provides centralized components for user input, selection menus,
 * and standard command execution feedback for the CLI.
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { EXAMPLES, CATEGORIES } from "./config";
import { CATEGORY_ICON, CATEGORY_ORDER, MAX_DESCRIPTION_LENGTH } from "./utils";
import { runCommand } from "./generators";

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

  const allCategories = Object.keys(categoryCounts);
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((cat) => allCategories.includes(cat)),
    ...allCategories.filter((cat) => !CATEGORY_ORDER.includes(cat)).sort(),
  ];

  return p.select({
    message: "Select a category:",
    options: orderedCategories.map((category) => ({
      value: category,
      label: `${CATEGORY_ICON} ${pc.cyan(category)}`,
      hint: pc.dim(
        `${categoryCounts[category] || 0} example${
          categoryCounts[category] !== 1 ? "s" : ""
        }`
      ),
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
      label: pc.yellow(key),
      hint: pc.dim(
        config.description.slice(0, MAX_DESCRIPTION_LENGTH) +
          (config.description.length > MAX_DESCRIPTION_LENGTH ? "..." : "")
      ),
    }));

  return p.select({
    message: `Select an example from ${pc.cyan(category)}:`,
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
      label: `${CATEGORY_ICON} ${pc.cyan(config.name)}`,
      hint: pc.dim(`${config.contracts.length} contracts`),
    })),
  });
}

// =============================================================================
// Install & Test Commands
// =============================================================================

/**
 * Runs npm install in the project directory
 */
export async function runInstall(projectPath: string): Promise<void> {
  const s = p.spinner();
  s.start("Installing dependencies...");

  try {
    await runCommand("npm", ["install"], projectPath);
    s.stop(pc.green("✓ Dependencies installed"));
  } catch (error) {
    s.stop(pc.red("✗ Installation failed"));
    if (error instanceof Error) {
      p.log.error(error.message);
    }
    throw new Error("Installation failed");
  }

  p.log.success(
    pc.green("🎉 Ready! Run 'npm run compile' then 'npm run test'.")
  );
}
