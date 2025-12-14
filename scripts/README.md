# FHEVM Example Factory - Scripts

CLI tools for generating standalone FHEVM example repositories and documentation.

## Quick Start

```bash
# Interactive menu (recommended)
npm run create

# Direct commands
npm run create:example fhe-counter ./output/my-project
npm run create:category basic ./output/basic-examples
npm run create:docs
```

## Scripts Overview

| Script | Description |
|--------|-------------|
| `create` | Interactive menu (Example, Category, Docs) |
| `create:example <name> [output]` | Generate a single example project |
| `create:category <name> [output]` | Generate a category project |
| `create:docs [example]` | Generate GitBook documentation |
| `create:help` | Show help with all available commands |
| `test:all` | Test all examples interactively |
| `generate:config` | Auto-generate config from contracts |

## Project Structure

```
scripts/
├── create.ts              # Interactive menu (main entry)
├── create-example.ts      # Single example generator
├── create-category.ts     # Category project generator
├── generate-docs.ts       # Documentation generator
├── generate-config.ts     # Auto-discovery config generator
├── maintenance.ts         # Testing tools (test-all)
├── README.md              # This file
└── shared/
    ├── index.ts           # Barrel exports
    ├── config.ts          # Auto-generated examples & categories
    ├── utils.ts           # File utilities, naming, constants
    └── commands.ts        # Command execution, install & test
```

## Shared Utilities

### `shared/utils.ts`

**File System:**
- `getRootDir()` - Project root directory
- `getTemplateDir()` - Hardhat template directory
- `getContractName(path)` - Extract contract name from Solidity file
- `copyDirectoryRecursive(src, dest)` - Copy directory with exclusions
- `cleanupTemplate(outputDir)` - Clean template files after copying

**Naming:**
- `toKebabCase(str)` - Convert to kebab-case
- `contractNameToExampleName(name)` - FHECounter → fhe-counter
- `contractNameToTitle(name)` - FHECounter → FHE Counter
- `formatCategoryName(folder)` - fhe-operations → FHE Operations
- `capitalize(str)` - First letter uppercase

**Constants:**
- `CATEGORY_ICON` - 📁
- `CATEGORY_ORDER` - Category display order
- `TEST_TYPES_CONTENT` - Content for test/types.ts

### `shared/commands.ts`

**Command Execution:**
- `runCommand(cmd, args, cwd)` - Run command, return output
- `runCommandWithStatus(cmd, args, cwd)` - Run command, return success/failure

**Output Parsing:**
- `extractTestResults(output)` - Parse test results
- `extractErrorMessage(output)` - Parse error messages

**Install & Test:**
- `runInstallAndTest(projectPath)` - Run npm install, compile, test
- `showQuickStart(relativePath)` - Show quick start commands
- `askInstallAndTest(resolvedPath, relativePath)` - Prompt user

### `shared/config.ts`

Auto-generated file containing:
- `EXAMPLES` - All example configurations
- `CATEGORIES` - All category configurations
- `getExampleNames()`, `getCategoryNames()` - List helpers
- `getExample(name)`, `getCategory(name)` - Lookup helpers

## Available Examples

| Category | Examples |
|----------|----------|
| **Basic** | fhe-counter, encrypt-single-value, encrypt-multiple-values |
| **Decryption** | user-decrypt-single-value, user-decrypt-multiple-values, public-decrypt-single-value, public-decrypt-multiple-values |
| **FHE Operations** | fhe-add, fhe-arithmetic, fhe-comparison, fhe-if-then-else |
| **Concepts** | fhe-access-control, fhe-handles, fhe-input-proof, fhe-anti-patterns |
| **Gaming** | rock-paper-scissors, encrypted-lottery, encrypted-poker |
| **Openzeppelin** | erc7984, erc7984-erc20-wrapper, erc7984-erc20-swap, erc7984-vesting, erc7984-token-governor |
| **Advanced** | blind-auction, hidden-voting, private-payroll, encrypted-escrow, private-kyc |

## Adding a New Example

1. **Create Contract** in `contracts/<category>/YourExample.sol`
   ```solidity
   /**
    * @notice Your description here - becomes the example description!
    */
   contract YourExample {
     // Implementation
   }
   ```

2. **Create Test** in `test/<category>/YourExample.ts`

3. **Generate Config**
   ```bash
   npm run generate:config
   ```

4. **Test Generated Project**
   ```bash
   npm run create:example your-example ./test-output
   cd test-output && npm install && npm run compile && npm run test
   ```

## Maintenance

```bash
# Test all examples
npm run test:all

# Regenerate config after adding contracts
npm run generate:config

# Regenerate all documentation
npm run create:docs
```

## Troubleshooting

**"Unknown example" error:**
- Check example name exists in `shared/config.ts`
- Run `npm run generate:config` to regenerate

**Contract name extraction fails:**
- Ensure contract declaration is on its own line
- Format: `contract ContractName is BaseContract {`

**Generated example doesn't compile:**
- Check all dependencies are in base template
- Verify import paths are correct
