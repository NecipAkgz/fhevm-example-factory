#!/usr/bin/env node

/**
 * FHEVM Example Factory - Interactive CLI
 *
 * A modern, interactive CLI for generating FHEVM example projects
 * Built with @clack/prompts for a beautiful developer experience
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// =============================================================================
// Configuration
// =============================================================================

interface ExampleConfig {
  contract: string;
  test: string;
  testFixture?: string;
  description: string;
  category: string;
}

interface CategoryConfig {
  name: string;
  description: string;
  contracts: Array<{ sol: string; test?: string }>;
}

// Example configurations
const EXAMPLES: Record<string, ExampleConfig> = {
  "fhe-counter": {
    contract: "contracts/basic/FHECounter.sol",
    test: "test/basic/FHECounter.ts",
    description:
      "This example demonstrates how to build a confidential counter using FHEVM, in comparison to a simple counter.",
    category: "Basic",
  },
  "encrypt-single-value": {
    contract: "contracts/basic/encrypt/EncryptSingleValue.sol",
    test: "test/basic/encrypt/EncryptSingleValue.ts",
    description:
      "This example demonstrates the FHE encryption mechanism and highlights a common pitfall developers may encounter.",
    category: "Basic - Encryption",
  },
  "encrypt-multiple-values": {
    contract: "contracts/basic/encrypt/EncryptMultipleValues.sol",
    test: "test/basic/encrypt/EncryptMultipleValues.ts",
    description:
      "This example shows how to encrypt and handle multiple values in a single transaction.",
    category: "Basic - Encryption",
  },
  "user-decrypt-single-value": {
    contract: "contracts/basic/decrypt/UserDecryptSingleValue.sol",
    test: "test/basic/decrypt/UserDecryptSingleValue.ts",
    description:
      "This example demonstrates the FHE user decryption mechanism and highlights common pitfalls developers may encounter.",
    category: "Basic - Decryption",
  },
  "user-decrypt-multiple-values": {
    contract: "contracts/basic/decrypt/UserDecryptMultipleValues.sol",
    test: "test/basic/decrypt/UserDecryptMultipleValues.ts",
    description:
      "This example shows how to decrypt multiple encrypted values for a user.",
    category: "Basic - Decryption",
  },
  "public-decrypt-single-value": {
    contract: "contracts/basic/decrypt/PublicDecryptSingleValue.sol",
    test: "test/basic/decrypt/PublicDecryptSingleValue.ts",
    description:
      "This example demonstrates how to publicly decrypt a single encrypted value on-chain.",
    category: "Basic - Decryption",
  },
  "public-decrypt-multiple-values": {
    contract: "contracts/basic/decrypt/PublicDecryptMultipleValues.sol",
    test: "test/basic/decrypt/PublicDecryptMultipleValues.ts",
    description:
      "This example shows how to publicly decrypt multiple encrypted values in a single transaction.",
    category: "Basic - Decryption",
  },
  "fhe-add": {
    contract: "contracts/basic/fhe-operations/FHEAdd.sol",
    test: "test/basic/fhe-operations/FHEAdd.ts",
    description:
      "This example demonstrates how to perform addition operations on encrypted values.",
    category: "FHE Operations",
  },
  "fhe-if-then-else": {
    contract: "contracts/basic/fhe-operations/FHEIfThenElse.sol",
    test: "test/basic/fhe-operations/FHEIfThenElse.ts",
    description:
      "This example shows conditional operations on encrypted values using FHE.",
    category: "FHE Operations",
  },
  "fhe-arithmetic": {
    contract: "contracts/basic/fhe-operations/FHEArithmetic.sol",
    test: "test/basic/fhe-operations/FHEArithmetic.ts",
    description:
      "Comprehensive example demonstrating all FHE arithmetic operations: add, sub, mul, div, rem, min, max.",
    category: "FHE Operations",
  },
  "fhe-comparison": {
    contract: "contracts/basic/fhe-operations/FHEComparison.sol",
    test: "test/basic/fhe-operations/FHEComparison.ts",
    description:
      "Demonstrates all FHE comparison operations: eq, ne, gt, lt, ge, le, and the select function for encrypted conditionals.",
    category: "FHE Operations",
  },
  "fhe-access-control": {
    contract: "contracts/concepts/FHEAccessControl.sol",
    test: "test/concepts/FHEAccessControl.ts",
    description:
      "Critical access control patterns in FHEVM: FHE.allow, FHE.allowThis, FHE.allowTransient. Includes common mistakes and correct implementations.",
    category: "Concepts",
  },
  "fhe-input-proof": {
    contract: "contracts/concepts/FHEInputProof.sol",
    test: "test/concepts/FHEInputProof.ts",
    description:
      "Explains input proof validation in FHEVM: what proofs are, why they are needed, and how to use them correctly with single and batched inputs.",
    category: "Concepts",
  },
  "fhe-handles": {
    contract: "contracts/concepts/FHEHandles.sol",
    test: "test/concepts/FHEHandles.ts",
    description:
      "Understanding FHE handles: creation, computation, immutability, and symbolic execution in mock mode.",
    category: "Concepts",
  },
  "fhe-anti-patterns": {
    contract: "contracts/concepts/FHEAntiPatterns.sol",
    test: "test/concepts/FHEAntiPatterns.ts",
    description:
      "Common FHE mistakes and their correct alternatives. Covers: branching, permissions, require/revert, re-encryption, loops, noise, and deprecated APIs.",
    category: "Concepts",
  },
};

// Category configurations
const CATEGORIES: Record<string, CategoryConfig> = {
  basic: {
    name: "Basic FHEVM Examples",
    description: "Encryption, decryption, and basic FHE operations",
    contracts: [
      { sol: "contracts/basic/FHECounter.sol" },
      {
        sol: "contracts/basic/encrypt/EncryptSingleValue.sol",
        test: "test/basic/encrypt/EncryptSingleValue.ts",
      },
      {
        sol: "contracts/basic/encrypt/EncryptMultipleValues.sol",
        test: "test/basic/encrypt/EncryptMultipleValues.ts",
      },
      {
        sol: "contracts/basic/decrypt/UserDecryptSingleValue.sol",
        test: "test/basic/decrypt/UserDecryptSingleValue.ts",
      },
      {
        sol: "contracts/basic/decrypt/UserDecryptMultipleValues.sol",
        test: "test/basic/decrypt/UserDecryptMultipleValues.ts",
      },
      {
        sol: "contracts/basic/decrypt/PublicDecryptSingleValue.sol",
        test: "test/basic/decrypt/PublicDecryptSingleValue.ts",
      },
      {
        sol: "contracts/basic/decrypt/PublicDecryptMultipleValues.sol",
        test: "test/basic/decrypt/PublicDecryptMultipleValues.ts",
      },
      {
        sol: "contracts/basic/fhe-operations/FHEAdd.sol",
        test: "test/basic/fhe-operations/FHEAdd.ts",
      },
      {
        sol: "contracts/basic/fhe-operations/FHEIfThenElse.sol",
        test: "test/basic/fhe-operations/FHEIfThenElse.ts",
      },
    ],
  },
  concepts: {
    name: "Critical Concepts",
    description: "Access control, input proofs, handles, anti-patterns",
    contracts: [
      {
        sol: "contracts/concepts/FHEAccessControl.sol",
        test: "test/concepts/FHEAccessControl.ts",
      },
      {
        sol: "contracts/concepts/FHEInputProof.sol",
        test: "test/concepts/FHEInputProof.ts",
      },
      {
        sol: "contracts/concepts/FHEHandles.sol",
        test: "test/concepts/FHEHandles.ts",
      },
      {
        sol: "contracts/concepts/FHEAntiPatterns.sol",
        test: "test/concepts/FHEAntiPatterns.ts",
      },
    ],
  },
  operations: {
    name: "FHE Operations",
    description: "Arithmetic, comparison, and conditional operations",
    contracts: [
      {
        sol: "contracts/basic/fhe-operations/FHEAdd.sol",
        test: "test/basic/fhe-operations/FHEAdd.ts",
      },
      {
        sol: "contracts/basic/fhe-operations/FHEArithmetic.sol",
        test: "test/basic/fhe-operations/FHEArithmetic.ts",
      },
      {
        sol: "contracts/basic/fhe-operations/FHEComparison.sol",
        test: "test/basic/fhe-operations/FHEComparison.ts",
      },
      {
        sol: "contracts/basic/fhe-operations/FHEIfThenElse.sol",
        test: "test/basic/fhe-operations/FHEIfThenElse.ts",
      },
    ],
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

function getRootDir(): string {
  return path.resolve(__dirname, "..");
}

function getContractName(contractPath: string): string | null {
  const fullPath = path.join(getRootDir(), contractPath);
  if (!fs.existsSync(fullPath)) return null;
  const content = fs.readFileSync(fullPath, "utf-8");
  const match = content.match(/^\s*contract\s+(\w+)(?:\s+is\s+|\s*\{)/m);
  return match ? match[1] : null;
}

function copyDirectoryRecursive(source: string, destination: string): void {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  const items = fs.readdirSync(source);
  items.forEach((item) => {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      if (
        [
          "node_modules",
          "artifacts",
          "cache",
          "coverage",
          "types",
          "dist",
        ].includes(item)
      ) {
        return;
      }
      copyDirectoryRecursive(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  });
}

// =============================================================================
// Create Single Example
// =============================================================================

async function createSingleExample(
  exampleName: string,
  outputDir: string
): Promise<void> {
  const rootDir = getRootDir();
  const templateDir = path.join(rootDir, "fhevm-hardhat-template");
  const example = EXAMPLES[exampleName];

  if (!example) {
    throw new Error(`Unknown example: ${exampleName}`);
  }

  const contractPath = path.join(rootDir, example.contract);
  const testPath = path.join(rootDir, example.test);

  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract not found: ${example.contract}`);
  }
  if (!fs.existsSync(testPath)) {
    throw new Error(`Test not found: ${example.test}`);
  }

  // Copy template
  copyDirectoryRecursive(templateDir, outputDir);

  // Get contract name
  const contractName = getContractName(example.contract);
  if (!contractName) {
    throw new Error("Could not extract contract name");
  }

  // Remove template contract
  const templateContract = path.join(outputDir, "contracts", "FHECounter.sol");
  if (fs.existsSync(templateContract)) {
    fs.unlinkSync(templateContract);
  }

  // Copy contract and test
  const destContractPath = path.join(
    outputDir,
    "contracts",
    `${contractName}.sol`
  );
  fs.copyFileSync(contractPath, destContractPath);

  const testDir = path.join(outputDir, "test");
  fs.readdirSync(testDir).forEach((file) => {
    if (file.endsWith(".ts")) {
      fs.unlinkSync(path.join(testDir, file));
    }
  });
  const destTestPath = path.join(
    outputDir,
    "test",
    path.basename(example.test)
  );
  fs.copyFileSync(testPath, destTestPath);

  // Update deploy script
  const deployScript = `import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployed${contractName} = await deploy("${contractName}", {
    from: deployer,
    log: true,
  });

  console.log(\`${contractName} contract: \`, deployed${contractName}.address);
};
export default func;
func.id = "deploy_${contractName.toLowerCase()}";
func.tags = ["${contractName}"];
`;
  fs.writeFileSync(path.join(outputDir, "deploy", "deploy.ts"), deployScript);

  // Update package.json
  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.name = `fhevm-example-${exampleName}`;
  packageJson.description = example.description;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Update hardhat.config.ts
  const configPath = path.join(outputDir, "hardhat.config.ts");
  let configContent = fs.readFileSync(configPath, "utf-8");
  configContent = configContent.replace(
    /import "\.\/tasks\/FHECounter";/g,
    `import "./tasks/${contractName}";`
  );
  fs.writeFileSync(configPath, configContent);

  // Update tasks
  const oldTaskFile = path.join(outputDir, "tasks", "FHECounter.ts");
  if (fs.existsSync(oldTaskFile)) {
    let taskContent = fs.readFileSync(oldTaskFile, "utf-8");
    taskContent = taskContent.replace(/FHECounter/g, contractName);
    taskContent = taskContent.replace(
      /fheCounter/g,
      contractName.charAt(0).toLowerCase() + contractName.slice(1)
    );
    fs.writeFileSync(
      path.join(outputDir, "tasks", `${contractName}.ts`),
      taskContent
    );
    fs.unlinkSync(oldTaskFile);
  }

  // Generate README
  const readme = `# FHEVM Example: ${exampleName}

${example.description}

## Quick Start

\`\`\`bash
npm install
npm run compile
npm run test
\`\`\`

## Contract

The main contract is \`${contractName}\` located in \`contracts/${contractName}.sol\`.

## Resources

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [FHEVM Examples](https://docs.zama.org/protocol/examples)

## License

BSD-3-Clause-Clear License

---

**Built with ❤️ using [FHEVM](https://github.com/zama-ai/fhevm) by Zama**
`;
  fs.writeFileSync(path.join(outputDir, "README.md"), readme);
}

// =============================================================================
// Create Category Project
// =============================================================================

async function createCategoryProject(
  categoryName: string,
  outputDir: string
): Promise<void> {
  const rootDir = getRootDir();
  const templateDir = path.join(rootDir, "fhevm-hardhat-template");
  const category = CATEGORIES[categoryName];

  if (!category) {
    throw new Error(`Unknown category: ${categoryName}`);
  }

  // Copy template
  copyDirectoryRecursive(templateDir, outputDir);

  // Clear template files
  const templateContract = path.join(outputDir, "contracts", "FHECounter.sol");
  if (fs.existsSync(templateContract)) fs.unlinkSync(templateContract);

  const testDir = path.join(outputDir, "test");
  fs.readdirSync(testDir).forEach((file) => {
    if (file.endsWith(".ts")) {
      fs.unlinkSync(path.join(testDir, file));
    }
  });

  // Copy contracts and tests
  const contractNames: string[] = [];
  for (const item of category.contracts) {
    const solPath = path.join(rootDir, item.sol);
    if (fs.existsSync(solPath)) {
      const contractName = getContractName(item.sol);
      if (contractName) {
        contractNames.push(contractName);
        fs.copyFileSync(
          solPath,
          path.join(outputDir, "contracts", `${contractName}.sol`)
        );
      }
    }
    if (item.test) {
      const testPath = path.join(rootDir, item.test);
      if (fs.existsSync(testPath)) {
        fs.copyFileSync(
          testPath,
          path.join(outputDir, "test", path.basename(item.test))
        );
      }
    }
  }

  // Update package.json
  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.name = `fhevm-examples-${categoryName}`;
  packageJson.description = category.description;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Generate README
  const readme = `# FHEVM ${category.name}

${category.description}

## Contracts

${contractNames.map((n) => `- \`${n}.sol\``).join("\n")}

## Quick Start

\`\`\`bash
npm install
npm run compile
npm run test
\`\`\`

## Resources

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [FHEVM Examples](https://docs.zama.org/protocol/examples)

## License

BSD-3-Clause-Clear License

---

**Built with ❤️ using [FHEVM](https://github.com/zama-ai/fhevm) by Zama**
`;
  fs.writeFileSync(path.join(outputDir, "README.md"), readme);
}

// =============================================================================
// Generate Documentation
// =============================================================================

async function generateDocumentation(
  exampleName: string | "all"
): Promise<number> {
  const rootDir = getRootDir();
  let count = 0;

  const examples =
    exampleName === "all" ? Object.keys(EXAMPLES) : [exampleName];

  for (const name of examples) {
    const example = EXAMPLES[name];
    if (!example) continue;

    const contractPath = path.join(rootDir, example.contract);
    const testPath = path.join(rootDir, example.test);

    if (!fs.existsSync(contractPath) || !fs.existsSync(testPath)) continue;

    const contractContent = fs.readFileSync(contractPath, "utf-8");
    const testContent = fs.readFileSync(testPath, "utf-8");
    const contractName = getContractName(example.contract) || "Contract";
    const testFileName = path.basename(example.test);

    // Generate GitBook markdown (matching generate-docs.ts format)
    let markdown = `${example.description}\n\n`;

    // Add hint block
    markdown += `{% hint style="info" %}\n`;
    markdown += `To run this example correctly, make sure the files are placed in the following directories:\n\n`;
    markdown += `- \`.sol\` file → \`<your-project-root-dir>/contracts/\`\n`;
    markdown += `- \`.ts\` file → \`<your-project-root-dir>/test/\`\n\n`;
    markdown += `This ensures Hardhat can compile and test your contracts as expected.\n`;
    markdown += `{% endhint %}\n\n`;

    // Add tabs for contract and test
    markdown += `{% tabs %}\n\n`;

    // Contract tab
    markdown += `{% tab title="${contractName}.sol" %}\n\n`;
    markdown += `\`\`\`solidity\n`;
    markdown += contractContent;
    markdown += `\n\`\`\`\n\n`;
    markdown += `{% endtab %}\n\n`;

    // Test tab
    markdown += `{% tab title="${testFileName}" %}\n\n`;
    markdown += `\`\`\`typescript\n`;
    markdown += testContent;
    markdown += `\n\`\`\`\n\n`;
    markdown += `{% endtab %}\n\n`;

    markdown += `{% endtabs %}\n`;

    // Generate consistent filename with fhe- prefix
    const docFileName = name.startsWith("fhe-") ? name : `fhe-${name}`;
    const outputPath = path.join(rootDir, "docs", `${docFileName}.md`);
    fs.writeFileSync(outputPath, markdown);
    count++;
  }

  return count;
}

// =============================================================================
// Main CLI
// =============================================================================

async function main(): Promise<void> {
  console.clear();

  p.intro(pc.bgCyan(pc.black(" 🔐 FHEVM Example Factory ")));

  // Mode selection
  const mode = await p.select({
    message: "What would you like to do?",
    options: [
      {
        value: "single",
        label: "Create a single example",
        hint: "Generate one example project",
      },
      {
        value: "category",
        label: "Create a category project",
        hint: "Generate multiple examples by category",
      },
      {
        value: "docs",
        label: "Generate documentation",
        hint: "Create GitBook-compatible docs",
      },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  // Handle each mode
  if (mode === "single") {
    await handleSingleExample();
  } else if (mode === "category") {
    await handleCategory();
  } else if (mode === "docs") {
    await handleDocs();
  }

  p.outro(pc.green("🎉 Happy coding with FHEVM!"));
}

async function handleSingleExample(): Promise<void> {
  // Group examples by category
  const grouped: Record<
    string,
    Array<{ value: string; label: string; hint: string }>
  > = {};
  for (const [key, config] of Object.entries(EXAMPLES)) {
    if (!grouped[config.category]) {
      grouped[config.category] = [];
    }
    grouped[config.category].push({
      value: key,
      label: key,
      hint:
        config.description.slice(0, 50) +
        (config.description.length > 50 ? "..." : ""),
    });
  }

  // Flatten to options with category labels
  const options: Array<{ value: string; label: string; hint?: string }> = [];
  for (const [category, items] of Object.entries(grouped)) {
    options.push({
      value: `__category_${category}`,
      label: pc.dim(`── ${category} ──`),
    });
    options.push(...items);
  }

  const example = await p.select({
    message: "Select an example:",
    options: options.filter((o) => !o.value.startsWith("__category_")),
  });

  if (p.isCancel(example)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const projectName = await p.text({
    message: "Project name:",
    placeholder: `my-${example}-project`,
    defaultValue: `my-${example}-project`,
  });

  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const outputDir = await p.text({
    message: "Output directory:",
    placeholder: `./output/${projectName}`,
    defaultValue: `./output/${projectName}`,
  });

  if (p.isCancel(outputDir)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const resolvedOutput = path.resolve(process.cwd(), outputDir as string);

  if (fs.existsSync(resolvedOutput)) {
    p.log.error(`Directory already exists: ${resolvedOutput}`);
    process.exit(1);
  }

  const s = p.spinner();
  s.start("Creating example project...");

  try {
    await createSingleExample(example as string, resolvedOutput);
    s.stop("Project created successfully!");

    p.note(
      `cd ${path.relative(
        process.cwd(),
        resolvedOutput
      )}\nnpm install\nnpm run compile\nnpm run test`,
      "Next steps"
    );
  } catch (error) {
    s.stop("Failed to create project");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function handleCategory(): Promise<void> {
  const category = await p.select({
    message: "Select a category:",
    options: Object.entries(CATEGORIES).map(([key, config]) => ({
      value: key,
      label: config.name,
      hint: `${config.contracts.length} contracts`,
    })),
  });

  if (p.isCancel(category)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const projectName = await p.text({
    message: "Project name:",
    placeholder: `my-${category}-project`,
    defaultValue: `my-${category}-project`,
  });

  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const outputDir = await p.text({
    message: "Output directory:",
    placeholder: `./output/${projectName}`,
    defaultValue: `./output/${projectName}`,
  });

  if (p.isCancel(outputDir)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const resolvedOutput = path.resolve(process.cwd(), outputDir as string);

  if (fs.existsSync(resolvedOutput)) {
    p.log.error(`Directory already exists: ${resolvedOutput}`);
    process.exit(1);
  }

  const s = p.spinner();
  s.start("Creating category project...");

  try {
    await createCategoryProject(category as string, resolvedOutput);
    s.stop("Project created successfully!");

    p.note(
      `cd ${path.relative(
        process.cwd(),
        resolvedOutput
      )}\nnpm install\nnpm run compile\nnpm run test`,
      "Next steps"
    );
  } catch (error) {
    s.stop("Failed to create project");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function handleDocs(): Promise<void> {
  const scope = await p.select({
    message: "Generate documentation for:",
    options: [
      {
        value: "all",
        label: "All examples",
        hint: `${Object.keys(EXAMPLES).length} files`,
      },
      { value: "single", label: "Single example" },
    ],
  });

  if (p.isCancel(scope)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  let target = "all";

  if (scope === "single") {
    const example = await p.select({
      message: "Select an example:",
      options: Object.entries(EXAMPLES).map(([key, config]) => ({
        value: key,
        label: key,
        hint: config.category,
      })),
    });

    if (p.isCancel(example)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    target = example as string;
  }

  const s = p.spinner();
  s.start("Generating documentation...");

  try {
    const count = await generateDocumentation(target as string | "all");
    s.stop(`Generated ${count} documentation file(s)`);

    p.note(`Documentation saved to: docs/`, "Output");
  } catch (error) {
    s.stop("Failed to generate documentation");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run CLI
main().catch(console.error);
