<p align="center">
  <img src="https://github.com/zama-ai/fhevm/raw/main/docs/.gitbook/assets/fhevm-header-dark.png" width="300px" />
</p>

<h1 align="center">🔐 FHEVM Examples Generator</h1>

<p align="center">
  <strong>A comprehensive toolkit for creating standalone FHEVM example repositories with automated documentation generation.</strong>
</p>

<p align="center">
  <a href="https://docs.zama.org/protocol"><img src="https://img.shields.io/badge/docs-fhevm-blue" alt="FHEVM Docs"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-BSD--3--Clause--Clear-green" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node"></a>
  <a href="#"><img src="https://img.shields.io/badge/solidity-0.8.x-blue" alt="Solidity"></a>
</p>

---

## 📖 Overview

This project provides tools and examples for building **privacy-preserving smart contracts** using [FHEVM](https://github.com/zama-ai/fhevm) by Zama. FHEVM enables Fully Homomorphic Encryption (FHE) operations directly on the blockchain, allowing computations on encrypted data without revealing the underlying values.

### ✨ Key Features

| Feature                    | Description                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| 🎯 **20+ Examples**        | Comprehensive collection covering encryption, decryption, operations, and OpenZeppelin integration |
| 🛠️ **Interactive CLI**     | Modern command-line interface with beautiful prompts                                               |
| 📦 **Standalone Projects** | Generate complete, runnable Hardhat projects from any example                                      |
| 📚 **Auto Documentation**  | Generate GitBook-formatted documentation automatically                                             |
| 🔗 **Hardhat Template**    | Pre-configured template with all FHEVM dependencies                                                |

### 🔑 Key Dependencies

| Package                 | Version  | Purpose                     |
| ----------------------- | -------- | --------------------------- |
| `@fhevm/solidity`       | ^0.9.1   | Core FHEVM Solidity library |
| `@fhevm/hardhat-plugin` | ^0.3.0-1 | Hardhat testing integration |
| `@zama-fhe/relayer-sdk` | ^0.3.0-5 | Decryption relayer SDK      |
| `hardhat-deploy`        | ^0.11.45 | Deployment management       |
| `encrypted-types`       | ^0.0.4   | TypeScript encrypted types  |

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20
- **npm** >= 7.0.0
- **Git** (for submodule support)

---

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/NecipAkgz/fhevm-example-factory.git
cd fhevm-example-factory
npm install
```

### Interactive Mode (Recommended)

```bash
npm run create
```

<p align="left">
  <img src="https://i.ibb.co/sdYVXFXm/create-cli.gif" alt="Interactive CLI Demo" width="400px" />
</p>

This launches an interactive CLI where you can:

- Select an example or category
- Choose output directory
- Optionally run install, compile, and test

### Generate a Single Example

```bash
# Direct
npm run create-example <name> [output]

# Example
npm run create-example fhe-counter ./my-fhe-counter
```

### Generate a Category (Multiple Examples)

```bash
# Direct
npm run create-category <name> [output]

# Example
npm run create-category basic ./my-basic-examples
```

### Generate Documentation

```bash
# Direct
npm run create-docs <name>

# Example
npm run create-docs fhe-counter

# All examples
npm run create-docs-all
```

### Help

This command shows all available options.

```bash
npm run create --help
```

---

## 📂 Project Structure

```
fhevm-examples-generator/
│
├── 📁 fhevm-hardhat-template/    # Base Hardhat template (git submodule)
│   ├── contracts/                # Template contract
│   ├── test/                     # Template tests
│   ├── deploy/                   # Deployment scripts
│   └── hardhat.config.ts         # Hardhat configuration
│
├── 📁 contracts/                 # All example contracts
│   ├── basic/                    # Basic FHE operations
│   │   ├── FHECounter.sol
│   │   └── ...
│   ├── concepts/                 # Critical FHEVM concepts
│   │   ├── FHEAccessControl.sol
│   │   └── ...
│   └── openzeppelin/             # OpenZeppelin integration
│       ├── ERC7984.sol
│       └── ...
│
├── 📁 test/                      # All test files (mirrors contracts/)
│
├── 📁 docs/                      # Generated GitBook documentation
│
├── 📁 scripts/                   # Automation tools
│   ├── create.ts                 # Main CLI entry point
│   └── shared/                   # Shared utilities
│       ├── config.ts             # Example & category configurations
│       └── utils.ts              # Helper functions
│
└── README.md                     # This file
```

---

## 📋 Available Examples

**20 examples total** - Click to expand each category:

<details>
<summary><b>🟢 Basic & Encryption Examples (3)</b></summary>

| Example                   | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `fhe-counter`             | Simple encrypted counter demonstrating FHE basics     |
| `encrypt-single-value`    | FHE encryption mechanism and common pitfalls          |
| `encrypt-multiple-values` | Handling multiple encrypted values in one transaction |

</details>

<details>
<summary><b>🔓 Decryption Examples (4)</b></summary>

| Example                          | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `user-decrypt-single-value`      | User decryption with permission requirements  |
| `user-decrypt-multiple-values`   | Decrypting multiple values for a user         |
| `public-decrypt-single-value`    | On-chain public decryption of a single value  |
| `public-decrypt-multiple-values` | On-chain public decryption of multiple values |

</details>

<details>
<summary><b>➕ FHE Operations (4)</b></summary>

| Example            | Description                                       |
| ------------------ | ------------------------------------------------- |
| `fhe-add`          | Addition operations on encrypted values           |
| `fhe-arithmetic`   | All arithmetic: add, sub, mul, div, rem, min, max |
| `fhe-comparison`   | All comparisons: eq, ne, gt, lt, ge, le, select   |
| `fhe-if-then-else` | Conditional operations on encrypted values        |

</details>

<details>
<summary><b>🧠 Critical Concepts (4)</b></summary>

| Example              | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `fhe-access-control` | `FHE.allow`, `FHE.allowThis`, `FHE.allowTransient` patterns |
| `fhe-input-proof`    | Input proof validation, batched inputs                      |
| `fhe-handles`        | Handle creation, computation, immutability                  |
| `fhe-anti-patterns`  | Common mistakes and correct alternatives                    |

</details>

<details>
<summary><b>🏛️ OpenZeppelin Integration (5)</b></summary>

| Example                   | Description                           |
| ------------------------- | ------------------------------------- |
| `erc7984`                 | Confidential token standard (ERC7984) |
| `erc7984-erc20-wrapper`   | Wrap ERC20 into confidential ERC7984  |
| `swap-erc7984-to-erc20`   | Swap confidential to public tokens    |
| `swap-erc7984-to-erc7984` | Fully confidential atomic swaps       |
| `vesting-wallet`          | Linear vesting with encrypted amounts |

</details>

---

## 📦 Categories

Generate entire category projects with multiple related examples:

| Category       | Examples | Description                                    |
| -------------- | -------- | ---------------------------------------------- |
| `basic`        | 9        | Encryption, decryption, FHE operations         |
| `concepts`     | 4        | Access control, proofs, handles, anti-patterns |
| `operations`   | 4        | Arithmetic, comparison, conditionals           |
| `openzeppelin` | 5        | ERC7984, wrappers, swaps, vesting              |

```bash
npm run create-category basic ./my-basic-project
```

---

## 🔧 Automation Tools

> 📖 For detailed documentation, see [scripts/README.md](scripts/README.md)

### Single Example Generator

Generates complete standalone Hardhat projects for individual examples:

- Clones base template from `fhevm-hardhat-template/`
- Copies contract and test files
- Updates `hardhat.config.ts` configuration
- Generates deploy scripts
- Creates example-specific README

```bash
npm run create-example fhe-counter ./my-counter
```

### Category Project Generator

Creates projects with multiple related examples:

- Copies all contracts from a category
- Includes all corresponding tests
- Generates unified deployment scripts
- Creates comprehensive README
- Perfect for learning multiple related concepts

```bash
npm run create-category openzeppelin ./my-oz-examples
```

### Documentation Generator

Creates GitBook-formatted markdown documentation:

- Extracts contract and test code
- Generates formatted markdown with tabs
- Updates `docs/SUMMARY.md` index
- Organizes by category

```bash
npm run create-docs fhe-counter    # Single example
npm run create-docs-all            # All examples
```

---

## 🛠️ Development Workflow

### Creating a New Example

1. **Write Contract** in `contracts/<category>/YourExample.sol`

   - Include detailed comments explaining FHE concepts
   - Document both correct usage and common pitfalls

2. **Write Tests** in `test/<category>/YourExample.ts`

   - Include success and failure cases
   - Use descriptive test names

3. **Update Configuration** in `scripts/shared/config.ts`

   - Add to `EXAMPLES` object
   - Add to relevant `CATEGORIES` if applicable

4. **Generate Documentation**

   ```bash
   npm run create-docs your-example
   ```

5. **Test Standalone Repository**
   ```bash
   npm run create-example your-example ./test-output
   cd test-output
   npm install && npm run compile && npm run test
   ```

---

## 📚 Script Commands

> 📖 See [scripts/README.md](scripts/README.md) for detailed usage and examples.

| Command                                 | Description                |
| --------------------------------------- | -------------------------- |
| `npm run create`                        | Interactive CLI            |
| `npm run create-example [name] [path]`  | Generate single example    |
| `npm run create-category [name] [path]` | Generate category project  |
| `npm run create-docs [name]`            | Generate documentation     |
| `npm run create-docs-all`               | Generate all documentation |
| `npm run create-help`                   | Show help information      |

---

## 🔗 Resources

| Resource                     | Link                                                                |
| ---------------------------- | ------------------------------------------------------------------- |
| 📖 FHEVM Documentation       | https://docs.zama.org/protocol                                      |
| 📚 Protocol Examples         | https://docs.zama.org/protocol/examples                             |
| 🔧 Hardhat Template          | https://github.com/zama-ai/fhevm-hardhat-template                   |
| 🌐 Live dApps                | https://github.com/zama-ai/dapps                                    |
| 🏛️ OpenZeppelin Confidential | https://github.com/OpenZeppelin/openzeppelin-confidential-contracts |

---

## 🔄 Maintenance

### Updating FHEVM Dependencies

When `@fhevm/solidity` or related packages release new versions:

1. **Update the submodule template:**

   ```bash
   # Fetches the latest changes from fhevm-hardhat-template upstream repo
   git submodule update --remote --merge
   ```

2. **Test example generation:**

   ```bash
   npm run create-example fhe-counter ./test-output
   cd test-output && npm install && npm run test
   ```

   Or use **interactive mode** which includes install & test options:

   ```bash
   npm run create
   ```

3. **Regenerate documentation if APIs changed:**
   ```bash
   npm run create-docs-all
   ```

---

## 🤝 Contributing

Contributions are welcome! When adding examples:

1. ✅ Follow existing patterns and structure
2. ✅ Include comprehensive inline comments
3. ✅ Demonstrate both correct and incorrect usage
4. ✅ Update `scripts/shared/config.ts`
5. ✅ Test generated standalone repository
6. ✅ Verify documentation renders correctly

---
