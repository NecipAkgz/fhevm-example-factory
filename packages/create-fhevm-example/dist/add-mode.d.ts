/**
 * Detects if the target directory is a valid Hardhat project
 */
export declare function detectHardhatProject(targetDir: string): boolean;
/**
 * Updates package.json with FHEVM dependencies
 */
export declare function updatePackageJson(targetDir: string): void;
/**
 * Updates hardhat.config.ts/js with FHEVM plugin import
 */
export declare function updateHardhatConfig(targetDir: string): void;
/**
 * Adds example contract and test files to the project
 */
export declare function addExampleFiles(exampleName: string, targetDir: string): Promise<void>;
/**
 * Main function to add FHEVM capabilities to an existing Hardhat project
 */
export declare function runAddMode(targetDir?: string): Promise<void>;
//# sourceMappingURL=add-mode.d.ts.map