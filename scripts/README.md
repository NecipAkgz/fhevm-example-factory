# FHEVM Example Factory - Scripts

This directory contains the unified CLI tool for generating standalone FHEVM example repositories and documentation.

## Quick Start

```bash
# Interactive mode with guided prompts
npm run create

# Show all available commands
npm run create-help
```

## Scripts Overview

### Unified CLI: `create.ts`

A modern, interactive CLI built with `@clack/prompts` that provides a beautiful developer experience. Supports both interactive mode (menus) and direct mode (command line arguments).

**Features:**

- 🎯 **Interactive Mode** - Guided prompts for easy navigation
- ⚡ **Direct Mode** - Fast command line usage for automation
- 📦 **Single Example Generator** - Create standalone project from any example
- 📂 **Category Generator** - Bundle multiple related examples
- 📄 **Documentation Generator** - GitBook-compatible markdown output
- 🎨 **Beautiful Output** - Colored terminal output with spinners

**What it does:**

1. Clones the `fhevm-hardhat-template/` base template
2. Copies specified contract(s) and test(s) from source
3. Updates deployment scripts with correct contract names
4. Generates example-specific `README.md`
5. Updates `package.json` with example metadata
6. Creates a ready-to-use, standalone repository

## Available Commands

| Command                                   | Description                                        |
| ----------------------------------------- | -------------------------------------------------- |
| `npm run create`                          | Interactive mode with guided prompts               |
| `npm run create-example <name> [output]`  | Generate a single example project                  |
| `npm run create-category <name> [output]` | Generate a category project with multiple examples |
| `npm run create-docs <example>`           | Generate GitBook documentation for one example     |
| `npm run create-docs-all`                 | Generate documentation for all examples            |
| `npm run create-help`                     | Show help with all options                         |

## Usage Examples

### Interactive Mode (Recommended)

The easiest way to get started - guided prompts walk you through the process:

```bash
npm run create
```

**Example output:**

```
┌   🔐 FHEVM Example Factory
│
◇  What would you like to do?
│  Create a single example
│
◇  Select an example:
│  fhe-counter
│
◇  Project name:
│  my-fhe-counter-project
│
◇  Output directory:
│  ./output/my-fhe-counter-project
│
◇  Project created successfully!
│
◆  📁 Created: output/my-fhe-counter-project
●  📝 Example: FHE Counter
│
◇  🚀 Quick Start ─────────────────────╮
│                                      │
│  $ cd output/my-fhe-counter-project  │
│  $ npm install                       │
│  $ npm run compile                   │
│  $ npm run test                      │
│                                      │
├──────────────────────────────────────╯
│
└  🎉 Happy coding with FHEVM!
```

### Create a Single Example (Direct)

```bash
# Generate fhe-counter example
npm run create-example fhe-counter ./output/fhe-counter-example

# Navigate to generated example
cd output/fhe-counter-example

# Install and test
npm install
npm run compile
npm run test
```

### Create a Category Project

```bash
# Generate all basic examples in one project
npm run create-category basic ./output/basic-examples

# Includes: FHECounter, EncryptSingleValue, EncryptMultipleValues,
#           UserDecryptSingleValue, UserDecryptMultipleValues, etc.
```

### Generate Documentation

```bash
# Generate docs for single example
npm run create-docs fhe-counter

# Generate all documentation
npm run create-docs-all
```

**Output Format:**
The generator creates GitBook-compatible markdown files in `docs/` with:

- Description and info hints
- Tabbed interface for contract and test code
- Proper syntax highlighting
- Organized in SUMMARY.md

## Available Examples

| Example                          | Description                                        |
| -------------------------------- | -------------------------------------------------- |
| `fhe-counter`                    | Basic encrypted counter                            |
| `encrypt-single-value`           | Single value encryption                            |
| `encrypt-multiple-values`        | Multiple value encryption                          |
| `user-decrypt-single-value`      | User decryption (single)                           |
| `user-decrypt-multiple-values`   | User decryption (multiple)                         |
| `public-decrypt-single-value`    | Public decryption (single)                         |
| `public-decrypt-multiple-values` | Public decryption (multiple)                       |
| `fhe-add`                        | FHE addition operations                            |
| `fhe-if-then-else`               | FHE conditional operations                         |
| `fhe-arithmetic`                 | All arithmetic (add, sub, mul, div, rem, min, max) |
| `fhe-comparison`                 | All comparisons (eq, ne, gt, lt, ge, le, select)   |
| `fhe-access-control`             | Access control (allow, allowThis, allowTransient)  |
| `fhe-input-proof`                | Input proof validation                             |
| `fhe-handles`                    | Handle lifecycle management                        |
| `fhe-anti-patterns`              | Common mistakes and correct patterns               |

## Available Categories

| Category     | Contracts | Description                                    |
| ------------ | --------- | ---------------------------------------------- |
| `basic`      | 9         | Encryption, decryption, basic operations       |
| `concepts`   | 4         | Access control, proofs, handles, anti-patterns |
| `operations` | 4         | Arithmetic, comparison, conditionals           |

## Project Structure

```
scripts/
├── README.md               # This file
├── create.ts               # Main CLI (interactive + direct mode)
└── shared/
    ├── config.ts           # All EXAMPLES and CATEGORIES definitions
    ├── utils.ts            # Utility functions
    └── index.ts            # Module exports
```

**Note:** All scripts are written in TypeScript for better type safety and maintainability.

## Configuration

All examples and categories are defined in `shared/config.ts` as the **single source of truth**.

### Example Configuration

```typescript
// shared/config.ts
export interface ExampleConfig {
  contract: string; // Path to Solidity contract
  test: string; // Path to TypeScript test
  testFixture?: string; // Optional fixture file
  description: string; // Full description for docs
  category: string; // Category grouping
  docsOutput: string; // Output path for documentation
  title: string; // Display title
}

export const EXAMPLES: Record<string, ExampleConfig> = {
  "fhe-counter": {
    contract: "contracts/basic/FHECounter.sol",
    test: "test/basic/FHECounter.ts",
    description:
      "This example demonstrates how to build a confidential counter...",
    category: "Basic",
    docsOutput: "docs/fhe-counter.md",
    title: "FHE Counter",
  },
  // ... more examples
};
```

### Category Configuration

```typescript
export interface CategoryConfig {
  name: string; // Display name
  description: string; // Category description
  contracts: Array<{
    // List of contracts
    sol: string;
    test?: string;
  }>;
}

export const CATEGORIES: Record<string, CategoryConfig> = {
  basic: {
    name: "Basic FHEVM Examples",
    description: "Fundamental FHEVM operations...",
    contracts: [
      {
        sol: "contracts/basic/FHECounter.sol",
        test: "test/basic/FHECounter.ts",
      },
      // ... more contracts
    ],
  },
};
```

## Development Workflow

### Adding a New Example

1. **Write the contract** in `contracts/<category>/`

   ```solidity
   // contracts/basic/MyExample.sol
   contract MyExample is SepoliaConfig {
       // Implementation with detailed comments
   }
   ```

2. **Write comprehensive tests** in `test/<category>/`

   ```typescript
   // test/basic/MyExample.ts
   describe("MyExample", function () {
     // Tests with explanatory comments
     // Include both success and failure cases
   });
   ```

3. **Update configuration** in `scripts/shared/config.ts`

   ```typescript
   // Add to EXAMPLES object:
   "my-new-example": {
     contract: "contracts/basic/MyExample.sol",
     test: "test/basic/MyExample.ts",
     description: "What this example demonstrates.",
     category: "Basic",
     docsOutput: "docs/fhe-my-new-example.md",
     title: "My New Example",
   },
   ```

4. **Test the generation**

   ```bash
   npm run create-example my-new-example ./test-output
   cd test-output && npm install && npm run compile && npm run test
   ```

5. **Generate documentation**
   ```bash
   npm run create-docs my-new-example
   ```

### Testing Generated Examples

Always test that generated examples work:

```bash
cd output/my-example
npm install
npm run compile
npm run test
```

## Maintenance

When updating `@fhevm/solidity` or other dependencies:

1. Update the base template in `fhevm-hardhat-template/`
2. Regenerate all examples to ensure compatibility
3. Update documentation if APIs have changed
4. Test all generated examples compile and pass tests

```bash
# Quick regeneration of all docs
npm run create-docs-all
```

## Troubleshooting

**"Unknown example" error:**

- Check that the example name exists in `shared/config.ts`
- Run `npm run create-help` to see available examples

**Contract name extraction fails:**

- Ensure contract declaration is on its own line
- Format: `contract ContractName is BaseContract {`

**Generated example doesn't compile:**

- Check that all dependencies are in base template
- Verify import paths are correct
- Ensure no template-specific files are referenced

**Documentation missing in SUMMARY.md:**

- Check category name matches existing categories
- Verify output path is in `docs/` directory
- Run generator again

## Contributing

When adding new examples:

1. Ensure contracts include detailed comments explaining FHE concepts
2. Tests should demonstrate both correct usage and common pitfalls
3. Use ✅/❌ markers to highlight good vs bad patterns
4. Update configuration in `shared/config.ts`
5. Test the generated standalone repository
6. Verify documentation renders correctly in GitBook

---
