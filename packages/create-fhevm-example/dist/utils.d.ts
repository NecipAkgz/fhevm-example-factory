/**
 * Utility functions for creating FHEVM example projects
 */
/**
 * Prompt result type (value or cancellation symbol)
 */
export type PromptResult<T> = T | symbol;
/**
 * Example name type
 */
export type ExampleName = string;
/**
 * Category name type
 */
export type CategoryName = string;
/**
 * Project mode type
 */
export type ProjectMode = "single" | "category";
/**
 * Simple folder icon for all categories
 */
export declare const CATEGORY_ICON = "\uD83D\uDCC1";
/**
 * Display order for example categories in the interactive prompt
 */
export declare const CATEGORY_ORDER: string[];
/**
 * Content for test/types.ts file
 */
export declare const TEST_TYPES_CONTENT = "import type { HardhatEthersSigner } from \"@nomicfoundation/hardhat-ethers/signers\";\n\n/**\n * Common signers interface used across test files\n */\nexport interface Signers {\n  owner: HardhatEthersSigner;\n  alice: HardhatEthersSigner;\n}\n";
/**
 * Centralized error messages
 */
export declare const ERROR_MESSAGES: {
    EXAMPLE_REQUIRED: string;
    BOTH_SPECIFIED: string;
    UNKNOWN_EXAMPLE: (name: string) => string;
    UNKNOWN_CATEGORY: (name: string) => string;
    DIR_EXISTS: (path: string) => string;
    NOT_HARDHAT: string;
    CONFIG_NOT_FOUND: string;
    CONTRACT_NAME_FAILED: string;
};
/**
 * Standardized logging functions
 */
export declare const log: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    dim: (msg: string) => void;
    message: (msg: string) => void;
};
/**
 * Validates that an example exists
 */
export declare function validateExample(name: string): void;
/**
 * Validates that a category exists
 */
export declare function validateCategory(name: string): void;
/**
 * Validates that a directory doesn't exist
 */
export declare function validateDirectoryNotExists(dirPath: string): void;
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
 * Generate deploy script
 */
export declare function generateDeployScript(contractName: string): string;
//# sourceMappingURL=utils.d.ts.map