# create-fhevm-example

Create FHEVM example projects with a single command.

## Quick Start

```bash
npx create-fhevm-example
```

This launches an interactive CLI that guides you through creating a project.

## Direct Mode

```bash
# Create single example
npx create-fhevm-example --example fhe-counter

# Create category project
npx create-fhevm-example --category basic

# With options
npx create-fhevm-example --example fhe-counter --output ./my-project --install
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--example <name>` | Create a single example project |
| `--category <name>` | Create a category project |
| `--output <dir>` | Output directory |
| `--install` | Auto-install dependencies |
| `--test` | Auto-run tests |
| `--help` | Show help |

## Available Examples

**Basic**: `fhe-counter`, `encrypt-single-value`, `encrypt-multiple-values`, `user-decrypt-single-value`, `user-decrypt-multiple-values`, `public-decrypt-single-value`, `public-decrypt-multiple-values`

**FHE Operations**: `fhe-add`, `fhe-if-then-else`, `fhe-arithmetic`, `fhe-comparison`

**Concepts**: `fhe-access-control`, `fhe-input-proof`, `fhe-handles`, `fhe-anti-patterns`

**OpenZeppelin**: `erc7984`, `erc7984-erc20-wrapper`, `swap-erc7984-to-erc20`, `swap-erc7984-to-erc7984`, `vesting-wallet`

**Advanced**: `blind-auction`, `hidden-voting`

## Available Categories

| Category | Description |
|----------|-------------|
| `basic` | Encryption, decryption, basic operations (9 contracts) |
| `concepts` | Access control, proofs, handles (4 contracts) |
| `operations` | Arithmetic, comparison operations (4 contracts) |
| `openzeppelin` | ERC7984, wrappers, swaps (5 contracts) |
| `advanced` | Blind auction, voting (2 contracts) |

## What Gets Created

- ✅ Hardhat configuration for FHEVM
- ✅ Smart contracts and test files
- ✅ Deployment scripts
- ✅ All dependencies configured

## Requirements

- Node.js >= 20
- Git

---

## Developer Only

>This section is for contributors and maintainers of the package.

### Configuration

The CLI uses a configuration file that defines all available examples and categories. This file is **auto-generated** from the main repository.

**Source of Truth**: [`scripts/shared/config.ts`](https://github.com/NecipAkgz/fhevm-example-factory/blob/main/scripts/shared/config.ts)
**Generated File**: `src/config.ts` (do not edit manually)

To customize the repository URL or branch:

```typescript
// In src/config.ts (after sync)
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

2. **Generate config** (auto-discovery):
   ```bash
   npm run generate:config  # Scans contracts, extracts @notice
   npm run sync:config      # Syncs to this package
   ```

3. **Publish**:
   ```bash
   npm version patch  # Increments version
   npm publish        # Auto-runs: sync:config → build → publish
   ```

   The `prepublishOnly` hook automatically:
   - Syncs config from `scripts/shared/config.ts` to `src/config.ts`
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

- `npm run build` - Compile TypeScript
- `npm run dev` - Watch mode
- `npm run sync:config` - Sync config from main repo
- `npm run prepublishOnly` - Auto-runs sync + build before publish

---

## Learn More

- [FHEVM Documentation](https://docs.zama.org/protocol)
- [Example Repository](https://github.com/NecipAkgz/fhevm-example-factory)
- [Zama](https://www.zama.ai/)

## License

BSD-3-Clause-Clear
