# create-fhevm-example

Create FHEVM example projects with a single command.

## Quick Start

```bash
npx create-fhevm-example
```

![🎬 CLI Demo](https://i.ibb.co/d4YWwh7V/package.gif)

This launches an interactive CLI that guides you through creating a project.

## Quick Commands

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
| `basicencryption` | Single and multiple value encryption (3 contracts) |
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

## Learn More

- [FHEVM Documentation](https://docs.zama.org/protocol)
- [Example Repository](https://github.com/NecipAkgz/fhevm-example-factory)
- [Zama](https://www.zama.ai/)

## License

BSD-3-Clause-Clear
