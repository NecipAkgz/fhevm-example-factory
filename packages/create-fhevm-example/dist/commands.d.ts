/**
 * Command Execution & Install/Test
 *
 * Runs npm install, compile, and test commands.
 * Similar to main project's shared/commands.ts
 */
/**
 * Runs npm install, compile, and test in the project directory
 */
export declare function runInstallAndTest(projectPath: string): Promise<void>;
/**
 * Shows quick start commands for the created project
 */
export declare function showQuickStart(relativePath: string): void;
/**
 * Asks user if they want to install and test, then runs or shows quick start
 */
export declare function askInstallAndTest(resolvedOutput: string, relativePath: string): Promise<void>;
//# sourceMappingURL=commands.d.ts.map