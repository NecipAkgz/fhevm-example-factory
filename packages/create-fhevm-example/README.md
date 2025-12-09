# create-fhevm-example

Create FHEVM example projects with a single command.

## Usage

### Interactive Mode

```bash
npx create-fhevm-example
```

This will launch an interactive CLI that guides you through:

1. Choosing between a single example or category project
2. **For single examples**: First selecting a category, then choosing an example from that category
3. **For category projects**: Selecting the category directly
4. Setting the project name and output directory
5. Optionally installing dependencies and running tests

### Direct Mode

Create a single example:

```bash
npx create-fhevm-example --example fhe-counter
```

Create a category project:

```bash
npx create-fhevm-example --category basic
```

With custom output directory:

```bash
npx create-fhevm-example --example fhe-counter --output ./my-project
```

Auto-install dependencies and run tests:

```bash
npx create-fhevm-example --example fhe-counter --install --test
```

## Available Examples

- `fhe-counter` - Confidential counter demonstration
- `encrypt-single-value` - FHE encryption mechanism
- `encrypt-multiple-values` - Multiple value encryption
- `user-decrypt-single-value` - User decryption mechanism
- `user-decrypt-multiple-values` - Multiple value decryption
- `public-decrypt-single-value` - Public decryption
- `public-decrypt-multiple-values` - Multiple public decryption
- `fhe-add` - Addition operations on encrypted values
- `fhe-if-then-else` - Conditional operations with FHE
- `fhe-arithmetic` - All arithmetic operations
- `fhe-comparison` - All comparison operations
- `fhe-access-control` - Access control patterns
- `fhe-input-proof` - Input proof validation
- `fhe-handles` - FHE handle lifecycle
- `fhe-anti-patterns` - Common mistakes and solutions
- `erc7984` - Confidential token standard
- `erc7984-erc20-wrapper` - ERC20 to ERC7984 wrapper
- `swap-erc7984-to-erc20` - Token swap example
- `swap-erc7984-to-erc7984` - Confidential token swap
- `vesting-wallet` - Token vesting example
- `blind-auction` - Encrypted blind auction
- `hidden-voting` - Encrypted voting system

## Available Categories

- `basic` - Basic FHEVM Examples (9 contracts)
- `concepts` - Critical Concepts (4 contracts)
- `operations` - FHE Operations (4 contracts)
- `openzeppelin` - OpenZeppelin Confidential Contracts (5 contracts)
- `advanced` - Advanced Examples (2 contracts)

## CLI Options

- `--example <name>` - Create a single example project
- `--category <name>` - Create a category project
- `--output <dir>` - Output directory (default: `./<project-name>`)
- `--install` - Auto-install dependencies
- `--test` - Auto-run tests (requires `--install`)
- `--help`, `-h` - Show help message

## What Gets Created

Each generated project includes:

- ✅ Hardhat configuration for FHEVM
- ✅ Smart contracts from the selected example(s)
- ✅ Comprehensive test files
- ✅ Deployment scripts
- ✅ README with getting started instructions
- ✅ All necessary dependencies configured

## Requirements

- Node.js >= 20
- Git (for cloning templates)

## Configuration

### Repository Settings

The CLI is configured to use a specific GitHub repository for templates and examples. You can customize this in [`src/config.ts`](./src/config.ts):

```typescript
export const REPO_URL = "https://github.com/NecipAkgz/fhevm-example-factory";
export const REPO_BRANCH = "main";
export const TEMPLATE_SUBMODULE_PATH = "fhevm-hardhat-template";
```

**Important**: If you fork this repository or want to use a different source:

1. Update `REPO_URL` to your repository URL
2. Ensure the repository has the same structure (contracts, test, fhevm-hardhat-template submodule)
3. Rebuild the package: `npm run build`

## Adding New Examples

To add a new example to the CLI:

### 1. Add Example Configuration

Edit [`src/config.ts`](./src/config.ts) and add your example to the `EXAMPLES` object:

```typescript
export const EXAMPLES: Record<string, ExampleConfig> = {
  // ... existing examples
  "my-new-example": {
    contract: "contracts/path/to/MyContract.sol",
    test: "test/path/to/MyContract.ts",
    description: "Description of what this example demonstrates",
    category: "Basic", // or "Concepts", "Operations", "OpenZeppelin", "Advanced"
    title: "My New Example",
  },
};
```

### 2. Add to Category (Optional)

If you want the example to appear in a category project, add it to the relevant category in `CATEGORIES`:

```typescript
export const CATEGORIES: Record<string, CategoryConfig> = {
  basic: {
    name: "Basic FHEVM Examples",
    description: "...",
    contracts: [
      // ... existing contracts
      {
        sol: "contracts/path/to/MyContract.sol",
        test: "test/path/to/MyContract.ts",
      },
    ],
  },
};
```

### 3. Ensure Files Exist in Repository

Make sure the contract and test files exist in your repository at the specified paths:

- `contracts/path/to/MyContract.sol`
- `test/path/to/MyContract.ts`

### 4. Rebuild and Test

```bash
npm run build
create-fhevm-example --example my-new-example --output /tmp/test-my-example
```

## Development

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/NecipAkgz/fhevm-example-factory.git
cd fhevm-example-factory/packages/create-fhevm-example

# Install dependencies
npm install

# Build the package
npm run build

# Link for local testing
npm link

# Now you can use it globally
create-fhevm-example --help
```

### Making Changes

1. **Edit source files** in `src/`
2. **Rebuild**: `npm run build`
3. **Test locally**: `create-fhevm-example --example fhe-counter --output /tmp/test`

### File Structure

```
src/
├── index.ts      # Main CLI entry point (interactive + direct modes)
├── config.ts     # Examples and categories configuration
└── utils.ts      # Helper functions (GitHub download, file ops, README generation)
```

## Publishing to NPM

### Pre-publish Checklist

- [ ] Update version in `package.json`
- [ ] Test locally with `npm link`
- [ ] Verify all examples work
- [ ] Update README if needed
- [ ] Commit all changes

### Publish Steps

```bash
# Dry run to see what will be published
npm publish --dry-run

# Check package contents
npm pack
tar -xvzf create-fhevm-example-*.tgz
rm -rf package create-fhevm-example-*.tgz

# Publish to NPM
npm publish
```

### Post-publish Verification

```bash
# Test from NPM in a clean directory
cd /tmp
npx create-fhevm-example@latest --example fhe-counter
```

## Troubleshooting

### "Repository not found" Error

**Problem**: Git clone fails with repository not found.

**Solution**: Check `REPO_URL` in `src/config.ts`. Make sure:

- The repository exists and is public
- The URL is correct (without trailing slash)
- You have internet connection

### "Failed to download" Error

**Problem**: File download from GitHub fails.

**Solution**:

- Verify the file paths in `config.ts` match actual files in the repository
- Check that `REPO_BRANCH` is correct (usually "main" or "master")
- Ensure the repository is public or you have access

### Build Errors

**Problem**: TypeScript compilation fails.

**Solution**:

```bash
# Clean and rebuild
rm -rf dist
npm run build
```

### Examples Not Showing Up

**Problem**: New example doesn't appear in the CLI.

**Solution**:

- Make sure you added it to `EXAMPLES` in `config.ts`
- Rebuild: `npm run build`
- If using `npm link`, unlink and relink:
  ```bash
  npm unlink -g create-fhevm-example
  npm link
  ```

## Maintenance

### Updating Template Repository

When the `fhevm-hardhat-template` submodule is updated:

1. No changes needed in this package - it clones fresh each time
2. Users will automatically get the latest template

### Syncing Examples

When new examples are added to the main repository:

1. Update `src/config.ts` with new example definitions
2. Increment version in `package.json`
3. Rebuild and publish: `npm run build && npm publish`

## Learn More

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Example Repository](https://github.com/NecipAkgz/fhevm-example-factory)
- [Zama](https://www.zama.ai/)

## License

BSD-3-Clause-Clear
