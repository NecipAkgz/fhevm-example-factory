#!/usr/bin/env node

/**
 * FHEVM Example Factory - Maintenance Tools
 *
 * Test multiple examples efficiently in a single project.
 *
 * Usage:
 *   npm run test:all                    # Interactive selection
 *   npm run test:all fhe-counter,fhe-add # Direct CLI
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";

import { EXAMPLES, getExampleNames } from "./shared/config";
import {
  getRootDir,
  getContractName,
  copyDirectoryRecursive,
  getTemplateDir,
  cleanupTemplate,
  TEST_TYPES_CONTENT,
} from "./shared/utils";
import {
  runCommandWithStatus,
  extractErrorMessage,
  extractTestResults,
} from "./shared/commands";

// =============================================================================
// Types
// =============================================================================

interface TestSummary {
  totalExamples: number;
  passed: number;
  failed: number;
  compileSuccess: boolean;
  failedTests: string[];
}

// =============================================================================
// Project Builder
// =============================================================================

/**
 * Creates a test project with selected examples
 */
async function createTestProject(
  exampleNames: string[],
  outputDir: string
): Promise<void> {
  const rootDir = getRootDir();
  const templateDir = getTemplateDir();

  copyDirectoryRecursive(templateDir, outputDir);
  cleanupTemplate(outputDir);

  const allNpmDeps: Record<string, string> = {};
  const allContractDeps = new Set<string>();

  for (const exampleName of exampleNames) {
    const example = EXAMPLES[exampleName];
    if (!example) continue;

    const contractPath = path.join(rootDir, example.contract);
    const testPath = path.join(rootDir, example.test);

    if (fs.existsSync(contractPath)) {
      const contractName = getContractName(example.contract);
      if (contractName) {
        fs.copyFileSync(
          contractPath,
          path.join(outputDir, "contracts", `${contractName}.sol`)
        );
      }
    }

    if (fs.existsSync(testPath)) {
      fs.copyFileSync(
        testPath,
        path.join(outputDir, "test", path.basename(example.test))
      );
    }

    if (example.dependencies) {
      example.dependencies.forEach((dep) => allContractDeps.add(dep));
    }
    if (example.npmDependencies) {
      Object.assign(allNpmDeps, example.npmDependencies);
    }
  }

  for (const depPath of allContractDeps) {
    const depFullPath = path.join(rootDir, depPath);
    if (fs.existsSync(depFullPath)) {
      const relativePath = depPath.replace(/^contracts\//, "");
      const depDestPath = path.join(outputDir, "contracts", relativePath);
      const depDestDir = path.dirname(depDestPath);

      if (!fs.existsSync(depDestDir)) {
        fs.mkdirSync(depDestDir, { recursive: true });
      }
      fs.copyFileSync(depFullPath, depDestPath);
    }
  }

  const packageJsonPath = path.join(outputDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.name = "fhevm-test-project";
  packageJson.description = `Testing ${exampleNames.length} examples`;

  if (Object.keys(allNpmDeps).length > 0) {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...allNpmDeps,
    };
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  const typesPath = path.join(outputDir, "test", "types.ts");
  if (!fs.existsSync(typesPath)) {
    fs.writeFileSync(typesPath, TEST_TYPES_CONTENT);
  }
}

// =============================================================================
// Example Selection
// =============================================================================

/**
 * Get examples to test from CLI args or interactive prompt
 */
async function getExamplesToTest(cliExamples?: string[]): Promise<string[]> {
  const allExamples = getExampleNames();

  if (cliExamples && cliExamples.length > 0) {
    const invalid = cliExamples.filter((e) => !allExamples.includes(e));
    if (invalid.length > 0) {
      p.log.error(`Unknown examples: ${invalid.join(", ")}`);
      p.log.message(pc.dim(`Available: ${allExamples.join(", ")}`));
      process.exit(1);
    }
    p.log.message(`Testing ${pc.bold(String(cliExamples.length))} examples...`);
    return cliExamples;
  }

  const selected = await p.multiselect({
    message: "Select examples to test (space to toggle, enter to confirm):",
    options: allExamples.map((ex) => ({
      value: ex,
      label: ex,
      hint: EXAMPLES[ex]?.category || "",
    })),
    required: true,
  });

  if (p.isCancel(selected)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return selected as string[];
}

// =============================================================================
// Test Runner
// =============================================================================

/**
 * Run install, compile, and test steps with real-time per-file output
 */
async function runTestPipeline(
  tempDir: string,
  exampleCount: number
): Promise<TestSummary> {
  const summary: TestSummary = {
    totalExamples: exampleCount,
    passed: 0,
    failed: 0,
    compileSuccess: false,
    failedTests: [],
  };

  // Step 1: Install dependencies
  const s1 = p.spinner();
  s1.start("Installing dependencies...");
  const installResult = await runCommandWithStatus("npm", ["install"], tempDir);
  if (!installResult.success) {
    s1.stop(pc.red("✗ npm install failed"));
    p.log.error(extractErrorMessage(installResult.output));
    return summary;
  }
  s1.stop(pc.green("✓ Dependencies installed"));

  // Step 2: Compile contracts
  const s2 = p.spinner();
  s2.start("Compiling contracts...");
  const compileResult = await runCommandWithStatus(
    "npm",
    ["run", "compile"],
    tempDir
  );
  if (!compileResult.success) {
    s2.stop(pc.red("✗ Compilation failed"));
    p.log.error(extractErrorMessage(compileResult.output));
    return summary;
  }
  s2.stop(pc.green("✓ Contracts compiled"));
  summary.compileSuccess = true;

  // Step 3: Get test files and run each one
  const testDir = path.join(tempDir, "test");
  const testFiles = fs
    .readdirSync(testDir)
    .filter((f) => f.endsWith(".test.ts") || f.endsWith(".ts"))
    .filter((f) => f !== "types.ts");

  if (testFiles.length === 0) {
    p.log.warning("No test files found");
    return summary;
  }

  p.log.message("");
  p.log.message(pc.bold(`🧪 Running ${testFiles.length} test files:`));
  p.log.message("");

  let passedTests = 0;
  let failedTests = 0;
  const startTime = Date.now();

  for (let i = 0; i < testFiles.length; i++) {
    const testFile = testFiles[i];
    const progress = `[${i + 1}/${testFiles.length}]`;

    // Show current test being run
    process.stdout.write(`  ${pc.dim(progress)} ${testFile} `);

    const testStart = Date.now();
    const result = await runCommandWithStatus(
      "npx",
      ["hardhat", "test", `test/${testFile}`],
      tempDir
    );
    const duration = ((Date.now() - testStart) / 1000).toFixed(1);

    if (result.success) {
      const testResults = extractTestResults(result.output);
      const resultInfo = testResults
        ? pc.dim(`(${testResults.replace(" ✓", "")})`)
        : "";
      console.log(pc.green(`✓`) + ` ${pc.dim(duration + "s")} ${resultInfo}`);
      passedTests++;
    } else {
      console.log(pc.red(`✗`) + ` ${pc.dim(duration + "s")}`);
      failedTests++;
      summary.failedTests.push(testFile);

      // Show brief error
      const errorMsg = extractErrorMessage(result.output);
      if (errorMsg) {
        const shortError = errorMsg.split("\n")[0].slice(0, 80);
        console.log(`    ${pc.red(pc.dim(shortError))}`);
      }
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  p.log.message("");
  p.log.message(pc.dim(`Completed in ${totalDuration}s`));

  summary.passed = passedTests;
  summary.failed = failedTests;

  return summary;
}

/**
 * Display test summary
 */
function showSummary(summary: TestSummary): void {
  p.log.message("");
  p.log.message(pc.bold("📊 Test Summary"));
  p.log.message(pc.dim("─".repeat(50)));

  p.log.message(`${pc.blue("📦 Examples:")} ${summary.totalExamples}`);
  p.log.message(
    `${pc.blue("📁 Compile:")} ${
      summary.compileSuccess ? pc.green("✓ Success") : pc.red("✗ Failed")
    }`
  );

  if (summary.compileSuccess) {
    if (summary.failed === 0) {
      p.log.message(`${pc.green("✓ Tests:")} All passed`);
    } else {
      p.log.message(`${pc.green("✓ Passed:")} ${summary.passed}`);
      p.log.message(`${pc.red("✗ Failed:")} ${summary.failed}`);

      if (summary.failedTests.length > 0) {
        p.log.message("");
        p.log.message(pc.red(pc.bold("Failed tests:")));
        for (const test of summary.failedTests.slice(0, 10)) {
          p.log.message(pc.red(`  ✗ ${test}`));
        }
        if (summary.failedTests.length > 10) {
          p.log.message(
            pc.dim(`  ... and ${summary.failedTests.length - 10} more`)
          );
        }
      }
    }
  }

  p.log.message(pc.dim("─".repeat(50)));

  if (summary.compileSuccess && summary.failed === 0) {
    p.outro(pc.green("✨ All tests passed!"));
  } else {
    p.outro(pc.yellow("Some issues need attention"));
  }
}

// =============================================================================
// Main Command
// =============================================================================

/**
 * Test selected examples
 */
async function testAllExamples(cliExamples?: string[]): Promise<void> {
  p.intro(pc.cyan("🧪 FHEVM Example Tester"));

  const examplesToTest = await getExamplesToTest(cliExamples);
  if (examplesToTest.length === 0) {
    p.log.warning("No examples selected");
    p.outro(pc.dim("Nothing to test"));
    return;
  }

  p.log.message("");
  p.log.message(
    `📦 Testing ${pc.bold(String(examplesToTest.length))} examples...`
  );

  const tempDir = path.join(getRootDir(), ".test-temp");

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }

  let summary: TestSummary;

  try {
    const s = p.spinner();
    s.start("Setting up test project...");
    await createTestProject(examplesToTest, tempDir);
    s.stop(pc.green("✓ Project ready"));

    summary = await runTestPipeline(tempDir, examplesToTest.length);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  }

  showSummary(summary);
}

// =============================================================================
// CLI Entry Point
// =============================================================================

function showHelp(): void {
  p.intro(pc.cyan("🔧 FHEVM Maintenance Tools"));
  p.log.message("");
  p.log.message(pc.bold("Available commands:"));
  p.log.message("");
  p.log.message(`  ${pc.cyan("test-all")}  Test examples`);
  p.log.message("");
  p.log.message(pc.bold("Usage:"));
  p.log.message(pc.dim("  npm run test:all"));
  p.log.message(pc.dim("  npm run test:all fhe-counter,fhe-add"));
  p.outro("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "test-all": {
      const exampleArg = args[1];
      const examples = exampleArg ? exampleArg.split(",") : undefined;
      await testAllExamples(examples);
      break;
    }
    default:
      showHelp();
  }
}

main().catch(console.error);
