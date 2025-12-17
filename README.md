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

- 🎯 **28+ Examples** - Comprehensive collection covering encryption, decryption, operations, and OpenZeppelin integration
- 🛠️ **Interactive CLI** - Modern command-line interface with beautiful prompts
- 📦 **Standalone Projects** - Generate complete, runnable Hardhat projects from any example
- 📚 **Auto Documentation** - Generate GitBook-formatted documentation automatically
- 🔗 **Hardhat Template** - Pre-configured template with all FHEVM dependencies

### 🔑 Key Dependencies

- `@fhevm/solidity` (^0.9.1) - Core FHEVM Solidity library
- `@fhevm/hardhat-plugin` (^0.3.0-1) - Hardhat testing integration
- `@zama-fhe/relayer-sdk` (^0.3.0-5) - Decryption relayer SDK
- `hardhat-deploy` (^0.11.45) - Deployment management
- `encrypted-types` (^0.0.4) - TypeScript encrypted types

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20
- **npm** >= 7.0.0
- **Git** (for submodule support)

---

## 🚀 Quick Start

### 1. Installation

```bash
git clone https://github.com/NecipAkgz/fhevm-example-factory.git
cd fhevm-example-factory
npm install
```

### 2. Interactive Mode (Recommended)

Run the wizard to browse examples by category:

```bash
npm run create
```

The interactive CLI now features **category-first browsing**:
- Select a category to see related examples grouped together
- View example counts per category
- Browse only the examples you're interested in

<p align="left">
  <img src="https://i.ibb.co/p6PGxGWS/main.gif" alt="Interactive CLI Demo" width="600px" />
</p>

### 3. Quick Commands

For advanced users who prefer CLI arguments:

```bash
# 🟢 Generate a Single Example
npm run create:example [name] [path]
npm run create:example fhe-counter ./my-fhe-counter

# 📦 Generate a Category Bundle
npm run create:category [name] [path]
npm run create:category basic ./my-basic-examples

# 📚 Generate Documentation
npm run create:docs [example]  # No arg = all docs, with name = specific doc

# ❓ Show Help
npm run create:help
```


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
│   ├── generate-config.ts        # Auto-discover contracts, generate config
│   ├── maintenance.ts            # Test all examples runner
│   └── shared/                   # Shared utilities
│       ├── config.ts             # Example & category configurations
│       └── utils.ts              # Helper functions
│
└── README.md                     # This file
```

---

## 📋 Available Examples

**28 examples total** - Click to expand each category:

<details>
<summary><b>🟢 Basic & Encryption Examples (3)</b></summary>

- `fhe-counter` - Simple encrypted counter demonstrating FHE basics
- `encrypt-single-value` - FHE encryption mechanism and common pitfalls
- `encrypt-multiple-values` - Handling multiple encrypted values in one transaction

</details>

<details>
<summary><b>🔓 Decryption Examples (4)</b></summary>

- `user-decrypt-single-value` - User decryption with permission requirements
- `user-decrypt-multiple-values` - Decrypting multiple values for a user
- `public-decrypt-single-value` - On-chain public decryption of a single value
- `public-decrypt-multiple-values` - On-chain public decryption of multiple values

</details>

<details>
<summary><b>➕ FHE Operations (4)</b></summary>

- `fhe-add` - Addition operations on encrypted values
- `fhe-arithmetic` - All arithmetic: add, sub, mul, div, rem, min, max
- `fhe-comparison` - All comparisons: eq, ne, gt, lt, ge, le, select
- `fhe-if-then-else` - Conditional operations on encrypted values

</details>

<details>
<summary><b>🧠 Critical Concepts (4)</b></summary>

- `fhe-access-control` - `FHE.allow`, `FHE.allowThis`, `FHE.allowTransient` patterns
- `fhe-input-proof` - Input proof validation, batched inputs
- `fhe-handles` - Handle creation, computation, immutability
- `fhe-anti-patterns` - Common mistakes and correct alternatives

</details>

<details>
<summary><b>🎮 Gaming (3)</b></summary>

- `rock-paper-scissors` - Encrypted moves with FHE commit-reveal pattern
- `encrypted-lottery` - Private lottery with encrypted ticket numbers
- `encrypted-poker` - Texas Hold'em with hidden hole cards

</details>

<details>
<summary><b>🏛️ OpenZeppelin Integration (5)</b></summary>

- `erc7984` - Confidential token standard (ERC7984)
- `erc7984-erc20-wrapper` - Wrap ERC20 into confidential ERC7984
- `swap-erc7984-to-erc20` - Swap confidential to public tokens
- `swap-erc7984-to-erc7984` - Fully confidential atomic swaps
- `vesting-wallet` - Linear vesting with encrypted amounts

</details>

<details>
<summary><b>🚀 Advanced Examples (5)</b></summary>

- `blind-auction` - Encrypted bids, winner computed via FHE.gt/select
- `hidden-voting` - Homomorphic vote tallying, private ballots
- `private-payroll` - Confidential salary payments with encrypted amounts
- `encrypted-escrow` - Secure escrow with hidden amounts until release
- `private-kyc` - Identity verification with predicate proofs (age, credit score)

</details>

---

## 📦 Categories

Generate entire category projects with multiple related examples:

- **`basic`** (9 examples) - Encryption, decryption, FHE operations
- **`concepts`** (4 examples) - Access control, proofs, handles, anti-patterns
- **`operations`** (4 examples) - Arithmetic, comparison, conditionals
- **`gaming`** (3 examples) - Rock-paper-scissors, lottery, poker
- **`openzeppelin`** (5 examples) - ERC7984, wrappers, swaps, vesting
- **`advanced`** (5 examples) - Blind auction, voting, payroll, escrow, KYC

```bash
npm run create:category basic ./my-basic-project
npm run create:category gaming ./my-gaming-project
```

---

## 🔧 Automation Tools

Empower your development with tools designed to automate the repetitive parts of FHEVM project setup.

> 📖 For technical details, see [scripts/README.md](scripts/README.md)

### 1. Standalone Project Generator (`create-example`)

**Best for:** Focusing on a specific concept or starting a new dApp.

Creates a production-ready Hardhat environment tailored for a single example. It handles the heavy lifting:

- 🏗️ **Scaffolds** a new clean project using the official `fhevm-hardhat-template`
- 📋 **Injects** the specific contract and its corresponding test suite
- ⚙️ **Configures** Hardhat and generates deployment scripts automatically
- 📝 **Customizes** the README with project-specific details

```bash
npm run create:example fhe-counter ./my-counter
```

### 2. Category Bundle Generator (`create-category`)

**Best for:** Learning related concepts or testing multiple features at once.

Generates a unified workspace containing all examples from a specific category (e.g., all decryption methods).

- 📦 **Bundles** multiple contracts into a single contract directory
- 🧪 **Consolidates** all test files ensuring they run in harmony
- 🚀 **Orchestrates** deployment for multiple artifacts

```bash
npm run create:category openzeppelin ./my-oz-examples
```

### 3. Documentation Engine (`create-docs`)

**Best for:** Keeping documentation in sync with code.

Automatically builds GitBook-ready markdown files directly from your source code.

- 🔍 **Extracts** code snippets from Contracts and Tests
- 🎨 **Formats** content into clean, tabbed markdown views
- 📑 **Updates** the documentation index (`SUMMARY.md`)

```bash
npm run create:docs fhe-counter    # Single example
npm run create:docs                # All examples
```

---

## 🛠️  Creating a New Example Flow

1. **Create Folder** (if new category)

   ```bash
   mkdir -p contracts/your-category
   mkdir -p test/your-category
   ```

   > 💡 **Convention-Based Categories**: Folder name becomes category name
   > - `contracts/gaming/` → "Gaming" category
   > - `contracts/defi-lending/` → "Defi Lending" category

2. **Write Contract** in `contracts/<category>/YourExample.sol`

   ```solidity
   /**
    * @notice Your contract description here - this becomes the example description!
    *
    * @dev Technical details...
    */
   contract YourExample {
     // Implementation
   }
   ```

   > ⚠️ **Required**: `@notice` tag is mandatory for auto-discovery

3. **Write Tests** in `test/<category>/YourExample.ts`

   - Include success and failure cases
   - Use descriptive test names

4. **Generate Configuration** (Auto-Discovery)

   ```bash
   npm run generate:config  # Scans contracts, extracts @notice tags
   ```

   > 📝 **Note**: If your example requires external dependencies (e.g., OpenZeppelin contracts or mock files), manually add them to `scripts/shared/config.ts`:
   >
   > ```typescript
   > "your-example": {
   >   contract: "contracts/your-category/YourExample.sol",
   >   test: "test/your-category/YourExample.ts",
   >   npmDependencies: {
   >     "@openzeppelin/contracts": "^5.4.0"  // NPM packages
   >   },
   >   dependencies: [
   >     "contracts/mocks/SomeMock.sol"       // Contract files
   >   ],
   >   // ... other fields
   > }
   > ```
   >
   > These dependencies will be:
   > - ✅ Preserved when running `npm run generate:config`
   > - ✅ Automatically copied/installed when creating standalone projects

5. **Test Standalone Repository**
   ```bash
   npm run create:example your-example ./test-output
   cd test-output
   npm install && npm run compile && npm run test
   ```

---

## 📚 Script Commands

> 📖 See [scripts/README.md](scripts/README.md) for detailed usage and examples.

- `npm run create` - Interactive CLI
- `npm run create:example [name] [path]` - Generate single example
- `npm run create:category [name] [path]` - Generate category project
- `npm run create:docs [example]` - Generate docs (all or specific)
- `npm run generate:config` - Auto-discover contracts and generate config
- `npm run test:all` - Test selected examples (interactive selection)
- `npm run test:all fhe-counter,fhe-add`  Direct: (comma-separated)
- `npm run create:help` - Show help information

## NPM Package Commands

> **ℹ️ Note:** The `create-fhevm-example` package (`packages/create-fhevm-example/`) is completely independent from the main project. It can be safely removed without affecting the main project's functionality. The package is published to NPM and can be used standalone without cloning this repository.

Published as `create-fhevm-example` on NPM, this package allows you to create FHEVM projects **without cloning this repository**. Perfect for quick starts and CI/CD pipelines.

**Advantages:**
- 🚀 **No Repository Clone** - Install and run directly via `npx`
- 📦 **Always Up-to-Date** - Automatically downloads latest examples from GitHub
- 🔧 **Works Anywhere** - No local dependencies or setup required
- 🎯 **Production Ready** - Ideal for scaffolding new dApps or integrating into existing projects

The `create-fhevm-example` package can be used via `npx`:

```bash
# Interactive mode (guided prompts)
npx create-fhevm-example

# Direct mode - create specific example
npx create-fhevm-example --example fhe-counter
npx create-fhevm-example --category basic --output ./my-project
```

### Add FHEVM to Existing Project

Already have a Hardhat project? Inject FHEVM capabilities without starting from scratch:

```bash
# Add FHEVM to existing Hardhat project
npx create-fhevm-example --add

# Or specify target directory
npx create-fhevm-example --add --target ./my-existing-project
```

This will:
- ✅ Detect your Hardhat project
- ✅ Add FHEVM dependencies to `package.json`
- ✅ Update `hardhat.config.ts` with FHEVM plugin
- ✅ Add an example contract and test of your choice
- ✅ Handle file conflicts intelligently (skip/overwrite/rename)

> **Note:** The `--add` feature is available through `npx create-fhevm-example` only.

---

## 🔄 Maintenance

### 🧪 Test Examples

Test selected examples in a unified project for fast, efficient verification:

```bash
# Interactive mode - select with space, confirm with enter
npm run test:all

# Direct mode - test specific examples
npm run test:all fhe-counter,fhe-add
```

> 💡 Selected examples are bundled into a single project, so dependencies install once and all tests run together.

### Updating FHEVM Dependencies

When `@fhevm/solidity` or related packages release new versions:

1. **Update the submodule template:**

   ```bash
   git submodule update --remote --merge
   ```

2. **Test all examples for compatibility:**

   ```bash
   npm run test:all
   ```

3. **Regenerate documentation if APIs changed:**
   ```bash
   npm run create:docs
   ```

---

## 🔗 Resources

- 📖 [FHEVM Documentation](https://docs.zama.org/protocol)
- 📚 [Protocol Examples](https://docs.zama.org/protocol/examples)
- 🔧 [Hardhat Template](https://github.com/zama-ai/fhevm-hardhat-template)
- 🌐 [Live dApps](https://github.com/zama-ai/dapps)
- 🏛️ [OpenZeppelin Confidential](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts)

---

## 🤝 Contributing

Contributions are welcome! When adding examples:

1. ✅ Follow existing patterns and structure
2. ✅ Include comprehensive inline comments
3. ✅ Add `@notice` tag to contract for auto-discovery
4. ✅ Demonstrate both correct and incorrect usage
5. ✅ Run `npm run generate:config` to auto-generate configuration
6. ✅ Test generated standalone repository
7. ✅ Verify documentation renders correctly

---
