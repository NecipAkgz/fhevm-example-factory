/**
 * Utility functions for creating FHEVM example projects
 */
/**
 * Get contract name from file path
 */
export declare function getContractName(contractPath: string): string | null;
/**
 * Recursively copy directory
 */
export declare function copyDirectoryRecursive(src: string, dest: string): void;
/**
 * Download file from GitHub repository
 */
export declare function downloadFileFromGitHub(filePath: string, outputPath: string): Promise<void>;
/**
 * Clone template repository to temporary directory
 */
export declare function cloneTemplate(tempDir: string): Promise<string>;
/**
 * Initialize git submodule for template
 */
export declare function initSubmodule(repoPath: string): Promise<void>;
/**
 * Run a shell command
 */
export declare function runCommand(cmd: string, args: string[], cwd: string): Promise<string>;
/**
 * Extract test results from npm test output
 */
export declare function extractTestResults(output: string): string | null;
/**
 * Generate README for single example project
 */
export declare function generateExampleReadme(exampleName: string, description: string, contractName: string): string;
/**
 * Generate README for category project
 */
export declare function generateCategoryReadme(categoryName: string, description: string, contractNames: string[]): string;
/**
 * Generate deploy script
 */
export declare function generateDeployScript(contractName: string): string;
//# sourceMappingURL=utils.d.ts.map