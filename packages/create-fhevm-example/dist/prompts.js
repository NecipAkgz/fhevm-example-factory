/**
 * Interactive Prompts
 *
 * Category and example selection prompts for interactive mode.
 * Similar structure to main project's interactive flows.
 */
import * as p from "@clack/prompts";
import { EXAMPLES, CATEGORIES } from "./config.js";
import { CATEGORY_ICON, CATEGORY_ORDER } from "./utils.js";
// =============================================================================
// Category Helpers
// =============================================================================
/**
 * Counts how many examples exist in each category
 */
export function countExamplesPerCategory() {
    const counts = {};
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
 * Returns the selected category name
 */
export async function promptSelectCategory() {
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
            hint: `${categoryCounts[category] || 0} example${categoryCounts[category] !== 1 ? "s" : ""}`,
        })),
    });
}
/**
 * Prompts user to select an example from a specific category
 * Returns the selected example name
 */
export async function promptSelectExampleFromCategory(category) {
    const categoryExamples = Object.entries(EXAMPLES)
        .filter(([, config]) => config.category === category)
        .map(([key, config]) => ({
        value: key,
        label: key,
        hint: config.description.slice(0, 80) +
            (config.description.length > 80 ? "..." : ""),
    }));
    return p.select({
        message: `Select an example from ${category}:`,
        options: categoryExamples,
    });
}
/**
 * Prompts user to select a category project
 * Returns the selected category key (lowercase)
 */
export async function promptSelectCategoryProject() {
    return p.select({
        message: "Select a category:",
        options: Object.entries(CATEGORIES).map(([key, config]) => ({
            value: key,
            label: `${CATEGORY_ICON} ${config.name}`,
            hint: `${config.contracts.length} contracts`,
        })),
    });
}
//# sourceMappingURL=prompts.js.map