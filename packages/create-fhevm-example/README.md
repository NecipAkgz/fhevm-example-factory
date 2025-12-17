# create-fhevm-example

Create FHEVM example projects with a single command.

## Quick Start

```bash
npx create-fhevm-example
```

![🎬 CLI Demo](https://i.ibb.co/d4YWwh7V/package.gif)

This launches an interactive CLI that guides you through creating a project.

## Direct Mode

```bash
# Create single example
npx create-fhevm-example --example fhe-counter

# Create category project
npx create-fhevm-example --category basic

# Add FHEVM example to existing Hardhat project
npx create-fhevm-example --add
npx create-fhevm-example --add --target ./my-existing-project

# With options
npx create-fhevm-example --example fhe-counter --output ./my-project --install
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--example <name>` | Create a single example project |
| `--category <name>` | Create a category project |
| `--add` | Add FHEVM to existing Hardhat project |
| `--target <dir>` | Target directory for --add mode (default: current dir) |
| `--output <dir>` | Output directory |
| `--install` | Auto-install dependencies |
| `--test` | Auto-run tests |
| `--help` | Show help |

## Available Examples

**Basic**: `fhe-counter`, `encrypt-single-value`, `encrypt-multiple-values`, `user-decrypt-single-value`, `user-decrypt-multiple-values`, `public-decrypt-single-value`, `public-decrypt-multiple-values`

**FHE Operations**: `fhe-add`, `fhe-if-then-else`, `fhe-arithmetic`, `fhe-comparison`

**Concepts**: `fhe-access-control`, `fhe-input-proof`, `fhe-handles`, `fhe-anti-patterns`

**Gaming**: `rock-paper-scissors`, `encrypted-lottery`, `encrypted-poker`

**OpenZeppelin**: `erc7984`, `erc7984-erc20-wrapper`, `swap-erc7984-to-erc20`, `swap-erc7984-to-erc7984`, `vesting-wallet`

**Advanced**: `blind-auction`, `hidden-voting`, `private-payroll`, `encrypted-escrow`, `private-kyc`

## Available Categories

| Category | Description |
|----------|-------------|
| `basic` | Basic encryption and counter examples (1 contract) |
| `basicencryption` | Single and multiple value encryption (2 contracts) |
| `basicdecryption` | Public and user decryption examples (4 contracts) |
| `basicfheoperations` | FHE arithmetic and comparison (4 contracts) |
| `concepts` | Access control, proofs, handles, anti-patterns (4 contracts) |
| `gaming` | Rock-paper-scissors, lottery, poker (3 contracts) |
| `openzeppelin` | ERC7984, wrappers, swaps, vesting (5 contracts) |
| `advanced` | Blind auction, voting, payroll, escrow, KYC (5 contracts) |

## What Gets Created

### New Projects (--example / --category)

- ✅ Hardhat configuration for FHEVM
- ✅ Smart contracts and test files
- ✅ Deployment scripts
- ✅ All dependencies configured

### Existing Projects (--add)

- ✅ FHEVM dependencies added to `package.json`
- ✅ FHEVM plugin imported in `hardhat.config.ts`
- ✅ Example contract and test of your choice
- ✅ Intelligent file conflict handling (skip/overwrite/rename)

## Requirements

- Node.js >= 20
- Git

---

## Developer Only

>This section is for contributors and maintainers of the package.

### File Structure

The package follows a modular structure similar to the main project's `scripts/` directory:

```
src/
├── index.ts      # Main entry point + CLI modes (~320 lines)
├── builders.ts   # createSingleExample, createCategoryProject (~250 lines)
├── ui.ts         # Interactive prompts + install/test commands (~180 lines)
├── utils.ts      # Utilities + constants + validation + logging (~350 lines)
├── config.ts     # Auto-generated examples & categories (~440 lines)
└── add-mode.ts   # Add FHEVM to existing projects (~370 lines)
```

**Key Components:**
- `index.ts` - Main CLI entry point, handles interactive and direct modes
- `builders.ts` - Project creation logic (single example, category project)
- `ui.ts` - User interface (prompts + commands, replaces old prompts.ts + commands.ts)
- `utils.ts` - File operations, constants, validation, logging utilities
- `config.ts` - Auto-generated configuration from monorepo contracts
- `add-mode.ts` - Add FHEVM to existing Hardhat projects

**Design Principles:**
- **Modular**: Each file has a single responsibility
- **Aligned**: Mirrors main project's `scripts/` structure
- **Maintainable**: Easy to understand and update
- **Type-safe**: Full TypeScript coverage
- **Consistent**: Standardized logging, error handling, validation

### Configuration

The CLI uses a configuration file that defines all available examples and categories. This file is **auto-generated** by scanning the monorepo's contracts directory.

**Generated File**: `src/config.ts` (do not edit manually)

To customize the repository URL or branch:

```typescript
// In src/config.ts
export const REPO_URL = "https://github.com/YourUsername/your-repo";
export const REPO_BRANCH = "main";
```

### Adding New Examples

To add a new example to the CLI:

1. **Create contract with `@notice` tag** in the main repository:
   ```solidity
   /**
    * @notice Your example description - auto-discovered!
    */
   contract YourExample { }
   ```

2. **Update package config** (from monorepo):
   ```bash
   cd packages/create-fhevm-example
   npm run update:config  # Scans ../../contracts, generates src/config.ts
   ```

3. **Publish**:
   ```bash
   npm version patch  # Increments version
   npm publish        # Auto-runs: update:config → build → publish
   ```

   The `prepublishOnly` hook automatically:
   - Updates config by scanning monorepo contracts (if available)
   - Builds TypeScript to `dist/`
   - Publishes to NPM

### Local Development

```bash
# Clone and setup
git clone https://github.com/NecipAkgz/fhevm-example-factory.git
cd fhevm-example-factory/packages/create-fhevm-example
npm install

# Build
npm run build

# Test locally
npm link
create-fhevm-example --help

# Unlink when done
npm unlink -g create-fhevm-example
```

### Scripts

- `npm run build` - Compile TypeScript to `dist/`
- `npm run dev` - Watch mode for development
- `npm run update:config` - Regenerate config from monorepo contracts
- `npm run prepublishOnly` - Auto-runs before publish (update:config + build)

---

## Learn More

- [FHEVM Documentation](https://docs.zama.org/protocol)
- [Example Repository](https://github.com/NecipAkgz/fhevm-example-factory)
- [Zama](https://www.zama.ai/)

## License

BSD-3-Clause-Clear
