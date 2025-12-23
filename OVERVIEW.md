# Technical Overview

A CLI toolkit for scaffolding FHEVM smart contract projects. Use `npx create-fhevm-example` to create complete Hardhat projects from 28+ examples.

**Contents:** [How It Works](#how-it-works) · [NPM vs Local Dev](#npm-package-vs-local-development) · [Project Structure](#project-structure) · [Architecture](#architecture-decisions) · [Scripts](#understanding-the-scripts) · [Adding Examples](#how-to-add-a-new-example) · [Key Concepts](#key-concepts-to-understand) · [Troubleshooting](#troubleshooting)

---

## How It Works

**Interactive Flow:**
1. User runs `npx create-fhevm-example`
2. CLI shows prompts → select example/category
3. Builders clone template + download files from GitHub
4. Configure package.json + generate deploy script
5. Output ready-to-use Hardhat project

---

## NPM Package vs Local Development

This project serves **two different audiences**:

### End Users (NPM Package)
```bash
npx create-fhevm-example
```
- Uses the published `create-fhevm-example` package from NPM
- **All files bundled** in the package (`contracts/`, `test/`, `fhevm-hardhat-template/`)
- **Offline capable** - No network required during scaffolding
- No need to clone the repository
- Fast scaffolding with local file copy

### Contributors (Local Development)
```bash
git clone https://github.com/NecipAkgz/fhevm-example-factory
npm install
npm run create
```
- Works directly with the source code
- Can add new examples and test locally
- Uses `LOCAL_DEV=1` environment variable for developer-specific help
- Can run all maintenance scripts (`test:all`, `generate:config`, etc.)

---

## Project Structure

```
fhevm-example-factory/
│
├── contracts/                  # 📝 All example smart contracts
│
├── test/                       # 🧪 Test files (mirrors contracts/)
│
├── docs/                       # 📚 Generated GitBook documentation
│
├── scripts/                    # 🔧 CLI source code
│   ├── index.ts               # Main CLI entry point
│   ├── shared/                # Shared utilities
│   │   ├── config.ts          # Auto-generated example registry
│   │   ├── utils.ts           # Core utilities (logging, naming, validation)
│   │   ├── generators.ts      # Template & code generation
│   │   ├── builders.ts        # Project scaffolding logic
│   │   └── ui.ts              # CLI prompts & interaction
│   └── commands/              # CLI commands
│       ├── add-mode.ts        # --add feature
│       ├── doctor.ts          # Health checker (env + submodule)
│       ├── generate-config.ts # Config auto-generator
│       ├── generate-docs.ts   # Docs generator
│       └── maintenance.ts     # Test runner
│
└── fhevm-hardhat-template/    # 📦 Official Zama template (git submodule)
```

---

## Architecture Decisions

### Why Bundle Files in Package?

The NPM package includes all example files (~180KB compressed):
- **Offline capable** - No network required during scaffolding
- **Fast scaffolding** - Local file copy instead of GitHub downloads
- **Reliable** - No dependency on GitHub availability
- Contains: `contracts/`, `test/`, `fhevm-hardhat-template/`

### Why Git Submodule for Template?

The `fhevm-hardhat-template/` is Zama's **official starter template**:
- Ensures compatibility with FHEVM's latest version
- Updates independently from this project
- Provides consistent Hardhat configuration
- Users get production-ready setup automatically

### Why TypeScript → Dist?

The project is written in TypeScript but published as JavaScript:
- Source: `scripts/*.ts` (development)
- Build: `npm run build` → `dist/scripts/*.js` (production)
- NPM package only includes `dist/` folder
- `prepublishOnly` ensures automatic build before publishing

---

## Understanding the Scripts

The `scripts/` folder is organized into two subfolders:

- **`shared/`** - Reusable utilities (config, builders, utils, generators, ui)
- **`commands/`** - Individual CLI commands (add-mode, doctor, generate-*, maintenance)

### `scripts/index.ts` - The Main Entry Point

This is where everything starts. When you run `npx create-fhevm-example`, this file handles:

- **Interactive Mode**: Shows beautiful prompts asking what you want to create
- **Quick Mode**: Parses `--example`, `--category`, `--add` flags
- **Help Display**: Shows different help based on developer vs end-user context

### `shared/config.ts` - The Example Registry

**⚠️ Auto-generated - don't edit manually!**

This file contains metadata for all examples:

```typescript
export const EXAMPLES = {
  "fhe-counter": {
    contract: "contracts/basic/encryption/FHECounter.sol",
    test: "test/basic/encryption/FHECounter.ts",
    description: "Confidential counter using FHEVM...",
    category: "Basic - Encryption",
    title: "FHE Counter"
  },
  // ... 27 more examples
};
```

Why is this important?
- CLI reads this to know what examples exist
- Contains paths for downloading contracts
- Stores npm/contract dependencies for each example
- Used for category grouping

### `shared/builders.ts` - Project Scaffolding Logic

This is the core engine that creates projects. It has three main functions:

| Function | What It Does |
|----------|--------------|
| `createSingleExample()` | Creates a project with one example |
| `createCategoryProject()` | Creates a project with all examples from a category |
| `createLocalTestProject()` | Creates a temp project for testing (used by test runner) |

**What happens inside `createSingleExample()`:**

```
1. Copy fhevm-hardhat-template → output directory
2. Remove template-specific files (FHECounter.sol, old tests)
3. Copy the selected contract from package
4. Copy the test file from package
5. Copy any dependencies (other .sol files)
6. Generate a deploy script for the contract
7. Update package.json with project name & npm deps
8. Run 'git init' in the new project
```

### `shared/utils.ts` - Core Utilities

Constants, logging, and helper functions:

- `log` - Colored console output (`log.success()`, `log.error()`, etc.)
- `handleError()` - Standardized error handler with exit
- `getContractName()` - Extracts contract name from source file
- `toKebabCase()` - Converts `"FHECounter"` → `"fhe-counter"`
- Validation functions for examples, categories, and paths

### `shared/generators.ts` - Template & Code Generation

Template processing and documentation generation:

- `cleanupTemplate()` - Prepares scaffolded project
- `generateDeployScript()` - Creates Hardhat deploy script
- `extractFHEFunctions()` - Parses contract for `FHE.xxx()` calls
- `extractFHETypes()` - Parses contract for encrypted types (`euint32`, etc.)
- `generateFHEApiSection()` - Creates collapsible API reference markdown
- `generateGitBookMarkdown()` - Creates GitBook-compatible documentation
- `runCommand()` - Executes shell commands
- `updateProjectPackageJson()` - Updates package.json with dependencies

### `shared/ui.ts` - Interactive Prompts

Provides the beautiful CLI interface using `@clack/prompts`:

- `promptSelectCategory()` - Shows category selection with example counts
- `promptSelectExampleFromCategory()` - Shows examples in a category
- `runInstallAndTest()` - Runs npm install/compile/test with spinners

### `commands/add-mode.ts` - Add to Existing Projects

The `--add` feature allows injecting FHEVM into an existing Hardhat project:

```
1. Detect if it's a valid Hardhat project
2. Ask user which example to add
3. Add FHEVM dependencies to package.json
4. Add "@fhevm/hardhat-plugin" import to hardhat.config.ts
5. Download contract and test files
6. Handle file conflicts (skip/overwrite/rename)
```

### `commands/generate-config.ts` - Auto-Discovery Engine

Scans `contracts/` and automatically generates `shared/config.ts`:

```
1. Walk through all .sol files in contracts/
2. Extract @notice tag from each file → becomes description
3. Find matching test file in test/
4. Infer category from folder path
5. Generate config.ts with all metadata
```

**Key Rule:** Every contract must have a `@notice` tag in its NatSpec comments!

```solidity
/**
 * @notice This description becomes the example's description in config.ts
 */
contract MyExample {
```

### `commands/generate-docs.ts` - Documentation Generator

Creates GitBook-compatible markdown from source:

```
1. Read contract source code
2. Read test source code
3. Extract FHE types and functions used (auto-generates API reference)
4. Combine into tabbed markdown with {% tabs %}
5. Save to docs/ folder
```

Features:
- **FHE API Reference**: Auto-detects `FHE.xxx()` calls and generates collapsible reference section
- **Syntax Highlighting**: Solidity and TypeScript code blocks
- **GitBook Hints**: Info boxes for usage instructions

### `commands/maintenance.ts` - Test Runner

Tests multiple examples efficiently:

```
1. User selects examples (interactive or CLI)
2. Create temp project with all selected examples
3. Install deps, compile, run tests
4. Report results per test file
5. Clean up temp project
```

### `commands/doctor.ts` - Health Checker

Validates your development environment:
- ✅ Node.js >= 20
- ✅ Git installed
- ✅ All paths in config.ts are valid
- ✅ Submodule is up to date

---

## How to Add a New Example

### Step 1: Create the Contract

```bash
# Create folder if needed
mkdir -p contracts/your-category

# Create contract file
touch contracts/your-category/MyExample.sol
```

The contract MUST have a `@notice` tag (auto-discovered by config generator):

```solidity
/**
 * @notice Your example description - this becomes the config description
 */
contract MyExample is ZamaEthereumConfig {
    // Implementation...
}
```

### Step 2: Create the Test

```bash
touch test/your-category/MyExample.ts
```

Write Hardhat tests following existing patterns.

### Step 3: Generate Config

```bash
npm run generate:config
```

This scans your new files and updates `config.ts` automatically.

### Step 4: Add Dependencies (if needed)

If your example needs npm packages or other contracts, manually add them:

```typescript
// In scripts/config.ts, find your example and add:
"my-example": {
  // ... auto-generated fields ...
  npmDependencies: {
    "@openzeppelin/contracts": "^5.4.0"
  },
  dependencies: [
    "contracts/mocks/SomeDependency.sol"
  ]
}
```

### Step 5: Test & Document

```bash
# Test the scaffolded project
npm run create:example my-example ./test-output
cd test-output && npm install && npm test

# Generate documentation
npm run create:docs my-example
```

---

## Key Concepts to Understand

### 1. Git Submodule for Template

The `fhevm-hardhat-template/` folder is a git submodule pointing to Zama's official template. This ensures generated projects always use the latest official configuration.

Update it with:
```bash
git submodule update --remote --merge
```

### 2. Build & Publishing Process

**TypeScript Compilation:**
```bash
npm run build  # Compiles scripts/*.ts → dist/scripts/*.js
```

**Package Preparation:**
```json
{
  "prepack": "mv README.md GITHUB_README.md && cp NPM_README.md README.md",
  "postpack": "mv GITHUB_README.md README.md",
  "prepublishOnly": "npm run build"
}
```

**What happens during `npm publish`:**
1. `prepublishOnly` runs → TypeScript compiles to `dist/`
2. `prepack` runs → Swaps README.md for NPM-specific version
3. Package is created with only `dist/` folder (defined in `files` field)
4. `postpack` runs → Restores original README.md

### 3. LOCAL_DEV Environment Variable

Controls CLI behavior and help output:

**Developer Mode (`LOCAL_DEV=1`):**
```bash
npm run create  # Sets LOCAL_DEV=1 automatically
```
- Help shows: `npm run create`, `npm run test:all`, etc.
- Enables "Generate documentation" option in interactive mode
- Uses local files instead of downloading from GitHub
- Displays developer-specific commands

**User Mode (default):**
```bash
npx create-fhevm-example
```
- Help shows: `npx create-fhevm-example --example`, etc.
- No documentation generation option
- Downloads files from GitHub
- Displays end-user commands

**Implementation:**
```typescript
// In scripts/index.ts
const isDev = process.env.LOCAL_DEV === "1";

if (isDev) {
  // Show npm run commands
  options.push({
    value: "docs",
    label: "Generate documentation"
  });
} else {
  // Show npx commands only
}
```

### 4. Preserved Manual Configuration

When you run `npm run generate:config`, it:
- Scans for new contracts automatically
- Preserves manually-added `npmDependencies` and `dependencies` fields
- Regenerates everything else

---

## Troubleshooting

### "No @notice found in..."
Your contract needs a NatSpec comment with `@notice` tag. Add it before the contract declaration.

### "No test file found for..."
Create a matching test file at `test/<category>/ContractName.ts`.

### Config changes not appearing
Run `npm run generate:config` to regenerate.

### Tests failing after update
Run `npm run doctor` to check environment, submodule status, and all paths.
