---
description: The fastest way to bootstrap privacy-preserving dApps on FHEVM
---

# 🔐 Create FHEVM Example


{% hint style="success" %}
**🚀 One Command. Full Privacy. Zero Config.**

Scaffold production-ready FHEVM projects in seconds. Pre-configured Hardhat, encrypted types, and comprehensive tests included.
{% endhint %}

***

## ⚡ Quick Start

Get started in under 30 seconds with our interactive wizard:

{% tabs %}
{% tab title="npm" %}
```bash
npx create-fhevm-example
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn create fhevm-example
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm create fhevm-example
```
{% endtab %}

{% tab title="bun" %}
```bash
bunx create-fhevm-example
```
{% endtab %}
{% endtabs %}

![🎬 Watch the CLI in action — scaffold a project in seconds!](https://i.ibb.co/d4YWwh7V/package.gif)

***

## 🎯 What You Get

<table data-view="cards">
<thead>
<tr>
<th></th>
<th></th>
<th data-hidden data-card-cover data-type="files"></th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>⚡ Zero Configuration</strong></td>
<td>Pre-configured <code>hardhat.config.ts</code>, FHE keys, network settings, and environment variables. Just run and build.</td>
<td></td>
</tr>
<tr>
<td><strong>📚 30+ Ready Examples</strong></td>
<td>From "Hello World" counters to advanced blind auctions and confidential tokens. Each with full test coverage.</td>
<td></td>
</tr>
<tr>
<td><strong>🛡️ Security First</strong></td>
<td>Built with OpenZeppelin patterns, proper access control, and battle-tested best practices for FHE development.</td>
<td></td>
</tr>
<tr>
<td><strong>🔌 Plug & Play</strong></td>
<td>Create new projects OR inject FHE capabilities into your existing Hardhat projects with <code>--add</code> mode.</td>
<td></td>
</tr>
</tbody>
</table>

***

## 🎮 Three Powerful Modes

Choose the workflow that fits your needs:

### 1️⃣ Single Example Mode

{% hint style="info" %}
**Perfect for:** Learning a specific FHE concept step-by-step.
{% endhint %}

```bash
# Interactive selection
npx create-fhevm-example

# Or directly specify the example
npx create-fhevm-example blind-auction
```

<details>

<summary>📋 What gets created?</summary>

A minimal, focused project with just one example:

```
my-blind-auction/
├── 📄 contracts/BlindAuction.sol    # The FHE smart contract
├── 🧪 test/BlindAuction.ts          # Full test suite
├── ⚙️ hardhat.config.ts             # Pre-configured for Zama
├── 📦 package.json                  # All dependencies included
└── 🔐 .env.example                  # Environment template
```

</details>

***

### 2️⃣ Category Bundle Mode

{% hint style="info" %}
**Perfect for:** Exploring a domain like Gaming, OpenZeppelin, or Advanced patterns.
{% endhint %}

```bash
# Download all 5 Advanced examples at once
npx create-fhevm-example --category advanced
```

**Available Categories:**

| Category | Examples | Description |
| :--- | :---: | :--- |
| 🎓 **Basic** | 11 | Fundamentals: counters, encryption, decryption |
| 💡 **Concepts** | 4 | Access control, handles, input proofs, anti-patterns |
| 🎮 **Gaming** | 3 | Poker, lottery, rock-paper-scissors |
| 🏛️ **OpenZeppelin** | 6 | ERC7984, wrappers, swaps, vesting |
| 🚀 **Advanced** | 5 | Blind auction, escrow, voting, KYC, payroll |

***

### 3️⃣ Smart Injection Mode (`--add`)

{% hint style="warning" %}
**Requirement:** Run this inside an existing Hardhat project directory.
{% endhint %}

Already have a project? Upgrade it to FHE in one command:

```bash
cd my-existing-project
npx create-fhevm-example --add
```

**What happens:**

1. ✅ Detects your Hardhat configuration
2. ✅ Adds `@fhevm/solidity` and `@fhevm/hardhat-plugin`
3. ✅ Updates `hardhat.config.ts` with FHE imports
4. ✅ Injects a sample contract and test of your choice


![🔧 Adding FHE to an existing Hardhat project](https://i.ibb.co/LXjWHvH0/add.gif)

***

## ⌨️ CLI Options

| Option | Description |
| :--- | :--- |
| `--example <name>` | Create a single example project |
| `--category <name>` | Create a category project |
| `--add` | Add FHEVM to existing Hardhat project |
| `--target <dir>` | Target directory for --add mode |
| `--output <dir>` | Output directory |
| `--help` | Show help message |

***

## 🏗️ Project Structure

Every scaffolded project follows this clean, minimal structure:

```
my-fhevm-project/
│
├── 📂 contracts/           # Solidity contracts
│   └── MyContract.sol      # Your FHE-enabled contract
│
├── 📂 test/                # TypeScript tests
│   ├── types.ts            # Shared type definitions
│   └── MyContract.ts       # Mocha/Chai test suite
│
├── ⚙️ hardhat.config.ts    # Hardhat + FHEVM configuration
├── 📦 package.json         # Dependencies and scripts
├── 📄 .env.example         # Environment variable template
└── 📖 README.md            # Project-specific documentation
```

***

## 🎬 Next Steps

After scaffolding, get your project running:

{% stepper %}
{% step %}
### Install Dependencies

```bash
npm install
```
{% endstep %}

{% step %}
### Compile Contracts

```bash
npm run compile
```
{% endstep %}

{% step %}
### Run Tests

```bash
npm run test
```
{% endstep %}

{% step %}
### Start Building! 🚀

Open `contracts/` and start writing your privacy-preserving logic!
{% endstep %}
{% endstepper %}

***

## ❓ Frequently Asked Questions

<details>
<summary><strong>Does this work with existing Hardhat projects?</strong></summary>

Yes! Use the `--add` flag inside your project directory. The CLI will detect your Hardhat setup and inject FHE dependencies automatically.

```bash
cd my-existing-project
npx create-fhevm-example --add
```
</details>

<details>
<summary><strong>Do I need to install anything globally?</strong></summary>

No! Just use `npx` (comes with Node.js). The CLI runs directly without any global installation.
</details>

<details>
<summary><strong>What Node.js version is required?</strong></summary>

Node.js **v18.0.0** or higher is required. We recommend using the latest LTS version.
</details>

<details>
<summary><strong>Can I use this offline?</strong></summary>

The CLI downloads templates from GitHub, so an internet connection is required for the initial scaffold. After that, your project works fully offline.
</details>

<details>
<summary><strong>How do I run tests after scaffolding?</strong></summary>

Simply run these commands in your new project:

```bash
npm install
npm run compile
npm run test
```
</details>

<details>
<summary><strong>What networks are supported?</strong></summary>

Projects are pre-configured for:
- **Local** (Hardhat Network with FHEVM mock)
- **Zama Devnet** (Sepolia-based testnet)

You can add more networks in `hardhat.config.ts`.
</details>

***

## 📚 Learn More

<table data-card-size="large" data-view="cards">
<thead>
<tr>
<th></th>
<th></th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>📖 FHEVM Documentation</strong></td>
<td>Deep dive into Fully Homomorphic Encryption on the blockchain.<br><a href="https://docs.zama.org/protocol/">docs.zama.org/protocol/</a></td>
</tr>
<tr>
<td><strong>💻 GitHub Repository</strong></td>
<td>Star us, report issues, or contribute!<br><a href="https://github.com/NecipAkgz/fhevm-example-factory">github.com/NecipAkgz/fhevm-example-factory</a></td>
</tr>
</tbody>
</table>

{% hint style="info" %}
**Need Help?** Join the [Zama Discord](https://discord.gg/zama) community for support and discussions!
{% endhint %}
