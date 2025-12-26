<p align="center">
  <strong>Create FHEVM example projects with a single command</strong>
</p>

<p align="center">
  <a href="https://docs.zama.org/protocol"><img src="https://img.shields.io/badge/docs-fhevm-blue" alt="FHEVM Docs"></a>
  <a href="https://github.com/NecipAkgz/fhevm-example-factory/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-BSD--3--Clause--Clear-green" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node"></a>
</p>

---


## 🚀 Quick Start

Launch the interactive CLI to create your project:

```bash
npx create-fhevm-example
```

![🎬 CLI Demo](https://i.ibb.co/PvtZSQyd/create-fhevm.gif)

---

## 🔧 Add to Existing Hardhat Project

Already have a Hardhat project? Inject FHEVM capabilities without starting from scratch:

```bash
npx create-fhevm-example --add
npx create-fhevm-example --add --target ./my-existing-project
```

This will:
- ✅ Detect your Hardhat project
- ✅ Add FHEVM dependencies to `package.json`
- ✅ Update `hardhat.config.ts` with FHEVM plugin
- ✅ Add an example contract and test of your choice
- ✅ Handle file conflicts intelligently (skip/overwrite/rename)

---

## ⚡ Quick Commands

Skip the prompts and create projects directly:

```bash
# Create single example
npx create-fhevm-example --example fhe-counter

# Create category project
npx create-fhevm-example --category basic

# Add FHEVM example to existing Hardhat project
npx create-fhevm-example --add
npx create-fhevm-example --add --target ./my-existing-project

# With auto-install
npx create-fhevm-example --example fhe-counter --output ./my-project --install
```

---

## 📋 CLI Options

| Option | Description |
| :--- | :--- |
| `--example <name>` | Create a single example project |
| `--category <name>` | Create a category project |
| `--add` | Add FHEVM to an existing Hardhat project |
| `--target <dir>` | Target directory for `--add` mode (default: current dir) |
| `--output <dir>` | Output directory for new projects |
| `--install` | Auto-install dependencies after scaffolding |
| `--help`, `-h` | Show help information |

---

## 📦 Available Examples

**Basic Encryption** (3): `fhe-counter`, `encrypt-single-value`, `encrypt-multiple-values`

**Decryption** (4): `user-decrypt-single-value`, `user-decrypt-multiple-values`, `public-decrypt-single-value`, `public-decrypt-multiple-values`

**FHE Operations** (4): `fhe-add`, `fhe-if-then-else`, `fhe-arithmetic`, `fhe-comparison`

**Concepts** (6): `fhe-access-control`, `fhe-input-proof`, `fhe-handles`, `control-flow`, `permissions`, `operations-gas-noise`

**Gaming** (4): `rock-paper-scissors`, `encrypted-lottery`, `encrypted-poker`, `encrypted-blackjack`

**OpenZeppelin** (5): `erc7984`, `erc7984-erc20-wrapper`, `swap-erc7984-to-erc20`, `swap-erc7984-to-erc7984`, `vesting-wallet`

**Advanced** (6): `blind-auction`, `hidden-voting`, `private-payroll`, `encrypted-escrow`, `private-kyc`, `private-order-book`

---

## ✅ What Gets Created

### New Projects (`--example` / `--category`)

- ✅ Hardhat configuration for FHEVM
- ✅ Smart contracts and comprehensive tests
- ✅ Deployment scripts
- ✅ All dependencies configured

### Existing Projects (`--add`)

- ✅ FHEVM dependencies added to `package.json`
- ✅ FHEVM plugin imported in `hardhat.config.ts`
- ✅ Example contract and test of your choice
- ✅ Intelligent conflict handling (skip/overwrite/rename)

---

## 💻 Requirements

- Node.js >= 20
- Git

---

## 🔗 Learn More

- 📖 [FHEVM Documentation](https://docs.zama.org/protocol)
- 💻 [Source Repository](https://github.com/NecipAkgz/fhevm-example-factory)
- 🌐 [Zama](https://www.zama.ai/)

---

## 📄 License

BSD-3-Clause-Clear
