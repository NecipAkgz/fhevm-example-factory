<h1 align="center">🔐 FHEVM Examples Generator</h1>

<p align="center">
  <strong>A comprehensive toolkit for creating standalone FHEVM example repositories with automated documentation generation.</strong>
</p>

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=FFCC00&center=true&vCenter=true&width=500&lines=Privacy-Preserving+Smart+Contracts;Fully+Homomorphic+Encryption;Ready-to-Use+Examples" alt="Typing SVG"/>
</p>

<p align="center">
  <a href="https://docs.zama.org/protocol"><img src="https://img.shields.io/badge/docs-fhevm-blue" alt="FHEVM Docs"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-BSD--3--Clause--Clear-green" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node"></a>
  <a href="#"><img src="https://img.shields.io/badge/solidity-0.8.x-blue" alt="Solidity"></a>
</p>

---

<p align="center">
  <a href="#quick-start">🚀 <strong>Quick Start</strong></a> •
  <a href="#-npm-package">📦 <strong>NPM Package</strong></a> •
  <a href="#-available-examples">📚 <strong>Example Gallery</strong></a> •
  <a href="#-automation-tools">🛠️ <strong>Automation Tools</strong></a> •
  <a href="#-maintenance">🔄 <strong>Maintenance</strong></a> •
  <a href="#-cli-reference">💻 <strong>CLI Reference</strong></a> •
  <a href="#️-creating-a-new-example">✨ <strong>Add New Example</strong></a>
</p>

> **📖 Technical Deep Dive:** See [**OVERVIEW.md**](OVERVIEW.md) for architecture decisions, design patterns, and detailed module documentation.

---


## <img src="https://img.shields.io/badge/📖-Overview-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

This project provides tools and examples for building **privacy-preserving smart contracts** using [FHEVM](https://github.com/zama-ai/fhevm) by Zama.

### Key Features

- 🎯 **33 Examples** - encryption, decryption, operations, OpenZeppelin and more
- 🛠️ **Interactive CLI** - Modern command-line interface with beautiful prompts
- 📦 **Standalone Projects** - Generate, runnable Hardhat projects from any example
- 📚 **Auto Documentation** - GitBook-formatted documentation automatically
- 🔗 **Hardhat Template** - Pre-configured template with all FHEVM dependencies

---

## <img src="https://img.shields.io/badge/🚀-Quick_Start-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

> 💡 **Recommended**: Use `npx create-fhevm-example` - no installation needed!
### Option 1: NPX (Recommended)

```bash
# Interactive mode
npx create-fhevm-example

# Quick commands
npx create-fhevm-example --example fhe-counter
npx create-fhevm-example --category basic --output ./my-project

# Add example to existing Hardhat project
npx create-fhevm-example --add
```

### Option 2: Clone Repository

For local development and contributing:

```bash
git clone https://github.com/NecipAkgz/fhevm-example-factory.git
cd fhevm-example-factory
npm install
```

**Interactive Mode:**

```bash
npm run create
```

<p align="left">
  <img src="https://i.ibb.co/ZpLmPN8z/crate.gif" alt="Interactive CLI Demo" width="600px" />
</p>

**Quick Commands:**

```bash
# Generate a single example
npm run create:example fhe-counter ./my-fhe-counter

# Generate a category bundle
npm run create:category basic ./my-basic-examples

# Generate documentation
npm run generate:docs [example]  # No arg = all docs, with name = specific doc

# Show help
npm run help:create
```

---


## <img src="https://img.shields.io/badge/📦-NPM_Package-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

Published as `create-fhevm-example` on NPM, this package allows you to create FHEVM projects **without cloning this repository**.

**Advantages:**
- 🚀 **No Repository Clone** - Install and run directly via `npx`
- ⚡ **Offline Capable** - All files bundled, no network needed during scaffolding
- 🔧 **Works Anywhere** - No local dependencies or setup required
- 🎯 **Production Ready** - Ideal for scaffolding new dApps or integrating into existing projects

### Interactive Mode

```bash
npx create-fhevm-example
```

<p align="left">
  <img src="https://i.ibb.co/PvtZSQyd/create-fhevm.gif" alt="NPX Demo" width="600px" />
</p>

### Quick Commands

```bash
# Create single example
npx create-fhevm-example --example fhe-counter

# Create category project
npx create-fhevm-example --category basic --output ./my-project
```

### Add to Existing Project

Already have a Hardhat project? Inject FHEVM capabilities without starting from scratch:

```bash
# Add FHEVM example to existing Hardhat project
npx create-fhevm-example --add
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

## <img src="https://img.shields.io/badge/📋-Available_Examples-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

**33 examples total** - Click to expand each category:

<details>
<summary><b>🔐 Encryption Examples (3)</b></summary>

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
<summary><b>🧠 Critical Concepts (8)</b></summary>

- `fhe-access-control` - `FHE.allow`, `FHE.allowThis`, `FHE.allowTransient` patterns
- `fhe-input-proof` - Input proof validation, batched inputs
- `fhe-handles` - Handle creation, computation, immutability
- `fhe-edge-cases` - Overflow, underflow, gas benchmarks, permission edge cases

**Anti-Patterns:**
- `control-flow` - Conditional logic and loop anti-patterns with encrypted values
- `permissions` - Permission management mistakes (allowThis, allow, cross-contract)
- `operations-gas-noise` - Performance issues, side-channels, inefficient operations

</details>

<details>
<summary><b>🎮 Gaming (4)</b></summary>

- `rock-paper-scissors` - Encrypted moves with FHE commit-reveal pattern
- `encrypted-lottery` - Private lottery with encrypted ticket numbers
- `encrypted-poker` - Texas Hold'em with hidden hole cards
- `encrypted-blackjack` - Blackjack with encrypted cards and bust detection

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
<summary><b>🎯 Advanced Examples (6)</b></summary>

- `blind-auction` - Encrypted bids, winner computed via FHE.gt/select
- `hidden-voting` - Homomorphic vote tallying, private ballots
- `private-payroll` - Confidential salary payments with encrypted amounts
- `encrypted-escrow` - Secure escrow with hidden amounts until release
- `private-kyc` - Identity verification with predicate proofs (age, credit score)
- `private-order-book` - MEV-resistant trading with encrypted orders

</details>

---

## <img src="https://img.shields.io/badge/🔧-Automation_Tools-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

For local development, the repository provides automation tools:

### 1. Standalone Project Generator

Creates a production-ready Hardhat environment tailored for a single example:

- 🏗️ **Scaffolds** a new clean project using the official `fhevm-hardhat-template`
- 📋 **Copies** contracts and tests from the bundled package
- ⚙️ **Configures** Hardhat and generates deployment scripts automatically
- 🔧 **Handles** contract dependencies and npm packages automatically

```bash
npm run create:example fhe-counter ./my-counter
# Or use the interactive CLI:
npm run create
```

### 2. Category Bundle Generator

Generates a unified workspace containing all examples from a specific category:

- 📦 **Bundles** multiple contracts into a single project
- 🧪 **Consolidates** all test files ensuring they run in harmony
- 🔗 **Manages** shared dependencies across examples automatically

```bash
npm run create:category openzeppelin ./my-oz-examples
# Or use the interactive CLI:
npm run create
```

### 3. Documentation Engine

Automatically builds GitBook-ready markdown files directly from your source code.

- 🔍 **Extracts** code snippets from Contracts and Tests
- 🔐 **Auto-generates** FHE API Reference (functions & types used)
- 🎨 **Formats** content into clean, tabbed markdown views
- 📑 **Updates** the documentation index (`SUMMARY.md`)

```bash
npm run generate:docs fhe-counter    # Single example
npm run generate:docs                # All examples
```

---


## <img src="https://img.shields.io/badge/💻-CLI_Reference-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

**Local Development:**
- `npm run create` - Interactive CLI
- `npm run create:example [name] [path]` - Generate single example
- `npm run create:category [name] [path]` - Generate category project
- `npm run generate:docs [example]` - Generate docs (all or specific)
- `npm run generate:config` - Auto-discover contracts and generate config
- `npm run test` - Test examples (interactive selection)
- `npm run test:all` - Test all examples directly
- `npm run doctor` - Validate environment, submodule status, and config integrity
- `npm run help:create` - Show help information

**NPM Package:**
- `npx create-fhevm-example` - Interactive mode
- `npx create-fhevm-example --example <name>` - Create single example
- `npx create-fhevm-example --category <name>` - Create category project
- `npx create-fhevm-example --add` - Add to existing Hardhat project
- `npx create-fhevm-example --help` - Show help

---

## <img src="https://img.shields.io/badge/🔄-Maintenance_&_Testing-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

### Test Examples

Test selected examples in a unified project for fast, efficient verification:

```bash
# Interactive mode - select with space, confirm with enter
npm run test

# Run all tests directly
npm run test:all

# Quick mode - test specific examples
npm run test fhe-counter,fhe-add
```

<p align="left">
  <img src="https://i.ibb.co/7NCD3bPs/tesy.gif" alt="Test Demo" width="600px" />
</p>

> 💡 Selected examples are bundled into a single project, so dependencies install once and all tests run together.

---

## <img src="https://img.shields.io/badge/📂-Project_Structure-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

<details>
<summary><b>📂 Click to expand</b></summary>

```
├── 📁 fhevm-hardhat-template/    # Base Hardhat template (git submodule)
│   ├── contracts/                # Template contract
│   ├── test/                     # Template tests
│   ├── deploy/                   # Deployment scripts
│   └── hardhat.config.ts         # Hardhat configuration
│
├── 📁 contracts/                 # All example contracts
│   ├── basic/                    # Basic FHE operations
│   ├── concepts/                 # Critical FHEVM concepts
│   └── openzeppelin/             # OpenZeppelin integration
│
├── 📁 test/                      # All test files (mirrors contracts/)
│
├── 📁 docs/                      # Generated GitBook documentation
│
├── 📁 scripts/                   # CLI source code
│   ├── index.ts                  # Main CLI entry point
│   ├── shared/                   # Shared utilities
│   │   ├── config.ts             # Auto-generated example registry
│   │   ├── utils.ts              # Core utilities (logging, naming)
│   │   ├── generators.ts         # Template & code generation
│   │   ├── builders.ts           # Project scaffolding logic
│   │   └── ui.ts                 # Interactive prompts
│   └── commands/                 # CLI commands
│       ├── add-mode.ts           # Add FHEVM to existing projects
│       ├── doctor.ts             # Environment health checker
│       ├── generate-config.ts    # Auto-discover contracts
│       ├── generate-docs.ts      # Documentation generator
│       └── maintenance.ts        # Test all examples runner
│
└── README.md                     # This file
```
</details>

---

## <img src="https://img.shields.io/badge/🛠️-Creating_a_New_Example-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

For contributors adding new examples:

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

4. **Generate Configuration** (Auto-Discovery)

   ```bash
   npm run generate:config  # Scans contracts, extracts @notice tags
   ```

   > 📝 **Note**: If your example requires external dependencies, manually add them to `scripts/shared/config.ts`:
   >
   > ```typescript
   > "your-example": {
   >   npmDependencies: {
   >     "@openzeppelin/contracts": "^5.4.0"  // NPM packages
   >   },
   >   dependencies: [
   >     "contracts/mocks/SomeMock.sol"       // Contract files
   >   ],
   > }
   > ```

5. **Test Standalone Repository**
   ```bash
   npm run create:example your-example ./test-output
   cd test-output
   npm install && npm run compile && npm run test
   ```

---

## <img src="https://img.shields.io/badge/🔄-Updating_FHEVM_Dependencies-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

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
   npm run generate:docs
   ```

---

## <img src="https://img.shields.io/badge/🔗-Resources-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

- 📖 [FHEVM Documentation](https://docs.zama.org/protocol)
- 📚 [Protocol Examples](https://docs.zama.org/protocol/examples)
- 🔧 [Hardhat Template](https://github.com/zama-ai/fhevm-hardhat-template)
- 🌐 [Live dApps](https://github.com/zama-ai/dapps)
- 🏛️ [OpenZeppelin Confidential](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts)

---

## <img src="https://img.shields.io/badge/🤝-Contributing-FFCC00?style=for-the-badge&labelColor=1A1A1A" height="40"/>

Contributions are welcome! When adding examples:

1. ✅ Follow existing patterns and structure
2. ✅ Include comprehensive inline comments
3. ✅ Add `@notice` tag to contract for auto-discovery
4. ✅ Demonstrate both correct and incorrect usage
5. ✅ Run `npm run generate:config` to auto-generate configuration
6. ✅ Test generated standalone repository
7. ✅ Verify documentation renders correctly

---

<p align="center">
  <sub>Built with 💛 by the FHEVM community</sub>
</p>
