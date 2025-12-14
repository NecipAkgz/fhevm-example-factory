/**
 * User Interface - Prompts & Commands
 *
 * Interactive prompts and command execution for CLI.
 * Combines functionality from prompts.ts and commands.ts
 */
/**
 * Counts how many examples exist in each category
 */
export declare function countExamplesPerCategory(): Record<string, number>;
/**
 * Prompts user to select a category
 */
export declare function promptSelectCategory(): Promise<string | symbol>;
/**
 * Prompts user to select an example from a specific category
 */
export declare function promptSelectExampleFromCategory(category: string): Promise<string | symbol>;
/**
 * Prompts user to select a category project
 */
export declare function promptSelectCategoryProject(): Promise<string | symbol>;
/**
 * Runs npm install, compile, and test in the project directory
 */
export declare function runInstallAndTest(projectPath: string): Promise<void>;
/**
 * Shows quick start commands for the created project
 */
export declare function showQuickStart(relativePath: string): void;
/**
 * Asks user if they want to install and test
 */
export declare function askInstallAndTest(resolvedOutput: string, relativePath: string): Promise<void>;
//# sourceMappingURL=ui.d.ts.map