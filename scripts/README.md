# FHEVM Example Factory Scripts

This directory contains the core TypeScript source code for the `create-fhevm-example` CLI tool.

## Directory Structure

```
scripts/
├── index.ts               # Main CLI entry point
├── commands/              # CLI command implementations
│   ├── add-mode.ts        # Add example to existing project
│   ├── doctor.ts          # Environment health checker
│   ├── generate-config.ts # Config generator
│   ├── generate-docs.ts   # GitBook documentation generator
│   └── maintenance.ts     # Test runner and maintenance tools
└── shared/                # Shared utilities and configurations
    ├── builders.ts        # Project scaffolding logic
    ├── config.ts          # Examples and categories configuration
    ├── generators.ts      # README and file generators
    ├── ui.ts              # CLI UI helpers (colors, spinners)
    └── utils.ts           # Common utility functions
```

## Scripts Overview

### 1. `index.ts` - Main CLI Entry Point

The main CLI that creates standalone FHEVM example projects with interactive or direct modes.

**Usage:**
```bash
# Interactive mode
ts-node scripts/index.ts

# Create single example
ts-node scripts/index.ts --example <name> [--output <dir>]
ts-node scripts/index.ts --example fhe-counter --output ./my-counter-project

# Create category project
ts-node scripts/index.ts --category <name> [--output <dir>]
ts-node scripts/index.ts --category basicencryption --output ./basic-encryption-project

# Show help
ts-node scripts/index.ts --help
```

**Features:**
- Interactive mode with guided prompts
- Direct mode for CI/CD pipelines
- Copies contracts and tests from bundled assets
- Generates example-specific README.md
- Updates package.json with example metadata
- Creates a ready-to-use, standalone repository

**Available Examples:**

| Category | Examples |
|----------|----------|
| `basicencryption` | `fhe-counter`, `encrypt-single-value`, `encrypt-multiple-values` |
| `basicdecryption` | `user-decrypt-single-value`, `user-decrypt-multiple-values`, `public-decrypt-single-value`, `public-decrypt-multiple-values` |
| `basicfheoperations` | `fhe-add`, `fhe-arithmetic`, `fhe-comparison`, `fhe-if-then-else` |
| `conceptscore` | `fhe-access-control`, `fhe-handles`, `fhe-input-proof` |
| `conceptsantipatterns` | `control-flow`, `operations-gas-noise`, `permissions` |
| `gaming` | `rock-paper-scissors`, `encrypted-lottery`, `encrypted-poker` |
| `advanced` | `blind-auction`, `hidden-voting`, `private-kyc`, `private-payroll`, `encrypted-escrow` |
| `openzeppelin` | `erc7984`, `erc7984-erc20-wrapper`, `swap-erc7984-to-erc20`, `swap-erc7984-to-erc7984`, `vesting-wallet` |

---

### 2. `commands/generate-docs.ts` - Documentation Generator

Generates GitBook-formatted documentation from contract and test files.

**Usage:**
```bash
# Generate docs for single example
ts-node scripts/commands/generate-docs.ts <example-name>
ts-node scripts/commands/generate-docs.ts fhe-counter

# Generate docs for all examples
ts-node scripts/commands/generate-docs.ts --all

# Show help
ts-node scripts/commands/generate-docs.ts --help
```

**Features:**
- Extracts contract and test code
- Generates GitBook markdown with tabs
- Creates side-by-side contract/test view
- Includes hints and proper formatting

**Output Format:**
The generator creates GitBook-compatible markdown files in `docs/` with:
- Description and info hints
- Tabbed interface for contract and test code
- Proper syntax highlighting

---

### 3. `commands/maintenance.ts` - Test Runner

Runs tests across all examples to ensure quality.

**Usage:**
```bash
# Interactive mode - select examples to test
ts-node scripts/commands/maintenance.ts test

# Run all tests directly
ts-node scripts/commands/maintenance.ts test --all

# Test specific examples
ts-node scripts/commands/maintenance.ts test blind-auction
ts-node scripts/commands/maintenance.ts test fhe-counter,fhe-add
```

**Features:**
- Runs tests in isolated environment
- Reports success/failure for each example
- Colored output with progress indicators

---

### 4. `commands/doctor.ts` - Environment Health Checker

Validates your development environment setup.

**Usage:**
```bash
ts-node scripts/commands/doctor.ts
```

**Features:**
- Verifies Node.js version (requires v20+)
- Checks required dependencies
- Validates Git submodule status
- Reports issues with actionable fixes

---

### 5. `commands/generate-config.ts` - Configuration Generator

Auto-generates `shared/config.ts` by scanning contracts and tests.

**Usage:**
```bash
ts-node scripts/commands/generate-config.ts
```

**Features:**
- Scans `contracts/` and `test/` directories
- Extracts contract names and categories
- Generates typed configuration
- Eliminates manual config updates

---

### 6. `commands/add-mode.ts` - Add Example to Existing Project

Adds FHEVM examples to an existing Hardhat project.

**Usage:**
```bash
# Add example to current directory (interactive)
ts-node scripts/index.ts --add

# Add example to specific target directory
ts-node scripts/index.ts --add --target <dir>
ts-node scripts/index.ts --add --target ./my-hardhat-project
```

**Features:**
- Detects existing Hardhat project
- Adds contracts and tests to existing project
- Updates package.json with FHEVM dependencies
- Updates hardhat.config with FHEVM plugin
- Installs required npm dependencies
- Supports rollback on failure

---

## NPM Scripts

These scripts are defined in `package.json` for convenience:

| Script | Description |
|--------|-------------|
| `npm run create` | Run CLI in interactive mode (local dev) |
| `npm run create:example` | Create a single example |
| `npm run create:category` | Create a category project |
| `npm run create:docs` | Generate GitBook documentation |
| `npm run test` | Run tests (interactive selection) |
| `npm run test:all` | Run all tests directly |
| `npm run doctor` | Check environment health |
| `npm run generate:config` | Generate configuration files |
| `npm run help:create` | Show CLI help |
| `npm run help:docs` | Show docs generator help |
| `npm run help:test` | Show test runner help |

---

## Adding a New Example

1. Add contract to `contracts/<category>/`
2. Add test to `test/<category>/`
3. Generate configuration automatically:
    This will scan contracts and tests, then update `shared/config.ts` automatically.
   ```bash
   ts-node scripts/commands/generate-config.ts
   ```
4. Test the example:
   ```bash
   ts-node scripts/commands/maintenance.ts test <example-name>
   ```
5. Generate docs:
   ```bash
   ts-node scripts/commands/generate-docs.ts <example-name>
   ```

---
