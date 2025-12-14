#!/usr/bin/env node
/**
 * create-fhevm-example - CLI for creating FHEVM example projects
 *
 * Usage:
 *   npx create-fhevm-example                    # Interactive mode
 *   npx create-fhevm-example --example <name>   # Create single example
 *   npx create-fhevm-example --category <name>  # Create category project
 *   npx create-fhevm-example --add              # Add to existing project
 *
 * This is the main entry point - similar to scripts/create.ts in main project.
 * Actual logic is split into:
 *   - builders.ts   (createSingleExample, createCategoryProject)
 *   - ui.ts         (prompts + commands)
 *   - utils.ts      (file operations + constants + utilities)
 *   - config.ts     (examples & categories)
 *   - add-mode.ts   (add to existing project)
 */
export {};
//# sourceMappingURL=index.d.ts.map