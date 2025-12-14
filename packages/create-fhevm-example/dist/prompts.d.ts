/**
 * Interactive Prompts
 *
 * Category and example selection prompts for interactive mode.
 * Similar structure to main project's interactive flows.
 */
/**
 * Counts how many examples exist in each category
 */
export declare function countExamplesPerCategory(): Record<string, number>;
/**
 * Prompts user to select a category
 * Returns the selected category name
 */
export declare function promptSelectCategory(): Promise<string | symbol>;
/**
 * Prompts user to select an example from a specific category
 * Returns the selected example name
 */
export declare function promptSelectExampleFromCategory(category: string): Promise<string | symbol>;
/**
 * Prompts user to select a category project
 * Returns the selected category key (lowercase)
 */
export declare function promptSelectCategoryProject(): Promise<string | symbol>;
//# sourceMappingURL=prompts.d.ts.map