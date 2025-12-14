/**
 * Project Builders
 *
 * Creates single example and category projects from templates.
 * Similar to main project's create-example.ts and create-category.ts
 */
/**
 * Cleans up template-specific files after copying
 * Similar to cleanupTemplate() in main project's shared/utils.ts
 */
export declare function cleanupTemplate(outputDir: string): void;
/**
 * Creates a single example project from the template
 *
 * Steps:
 * 1. Copy template directory and clean up
 * 2. Download contract and test files from GitHub
 * 3. Update package.json and deploy scripts
 */
export declare function createSingleExample(exampleName: string, outputDir: string, tempRepoPath: string): Promise<void>;
/**
 * Creates a category project with multiple examples
 *
 * Steps:
 * 1. Copy template directory and clean up
 * 2. Download all contracts and tests for the category
 * 3. Update package.json
 */
export declare function createCategoryProject(categoryName: string, outputDir: string, tempRepoPath: string): Promise<void>;
//# sourceMappingURL=builders.d.ts.map