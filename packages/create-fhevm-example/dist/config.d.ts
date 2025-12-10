/**
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY ⚠️
 *
 * This file is auto-generated from scripts/shared/config.ts
 * Run 'npm run sync:config' to update it.
 *
 * Source: scripts/shared/config.ts
 */
export interface ExampleConfig {
    /** Path to the Solidity contract file */
    contract: string;
    /** Path to the TypeScript test file */
    test: string;
    /** Optional additional contract dependencies */
    dependencies?: string[];
    /** Optional npm packages to install */
    npmDependencies?: Record<string, string>;
    /** Full description for documentation */
    description: string;
    /** Category for grouping */
    category: string;
    /** Title for documentation */
    title: string;
}
export interface CategoryConfig {
    /** Display name */
    name: string;
    /** Description of the category */
    description: string;
    /** List of contracts in this category */
    contracts: Array<{
        sol: string;
        test?: string;
    }>;
}
export declare const REPO_URL = "https://github.com/NecipAkgz/fhevm-example-factory";
export declare const REPO_BRANCH = "main";
export declare const TEMPLATE_SUBMODULE_PATH = "fhevm-hardhat-template";
export declare const EXAMPLES: Record<string, ExampleConfig>;
export declare const CATEGORIES: Record<string, CategoryConfig>;
//# sourceMappingURL=config.d.ts.map