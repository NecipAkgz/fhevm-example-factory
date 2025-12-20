#!/usr/bin/env node

/**
 * Maintenance Tools - Utilities for project maintenance and testing.
 *
 * Includes the test-all runner which allows for efficient testing
 * of multiple examples in a temporary workspace.
 *
 * Usage:
 *   npm run test:all                      # Interactive selection
 *   npm run test:all fhe-counter,fhe-add  # Direct CLI
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";

import { EXAMPLES, getExampleNames } from "../shared/config";
import { getRootDir, log } from "../shared/utils";
import {
  runCommandWithStatus,
  extractErrorMessage,
  extractTestResults,
} from "../shared/generators";
import { createLocalTestProject } from "../shared/builders";

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
// Example Selection
// =============================================================================

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

  const s1 = p.spinner();
  s1.start("Installing dependencies...");
  const installResult = await runCommandWithStatus("npm", ["install"], tempDir);
  if (!installResult.success) {
    s1.stop(pc.red("✗ npm install failed"));
    p.log.error(extractErrorMessage(installResult.output));
    return summary;
  }
  s1.stop(pc.green("✓ Dependencies installed"));

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
      p.log.message(pc.green(`✓`) + ` ${pc.dim(duration + "s")} ${resultInfo}`);
      passedTests++;
    } else {
      p.log.message(pc.red(`✗`) + ` ${pc.dim(duration + "s")}`);
      failedTests++;
      summary.failedTests.push(testFile);

      const errorMsg = extractErrorMessage(result.output);
      if (errorMsg) {
        const shortError = errorMsg.split("\n")[0].slice(0, 80);
        p.log.message(`    ${pc.red(pc.dim(shortError))}`);
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

export async function testAllExamples(cliExamples?: string[]): Promise<void> {
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
    await createLocalTestProject(examplesToTest, tempDir);
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
  log.info("🔧 FHEVM Maintenance Tools");
  log.message("");
  log.message("Available commands:");
  log.message("");
  log.message("  test-all  Test examples");
  log.message("");
  log.message("Usage:");
  log.dim("  npm run test:all");
  log.dim("  npm run test:all fhe-counter,fhe-add");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check for help flag first
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  const command = args[0];

  switch (command) {
    case "test-all": {
      const exampleArg = args[1];
      // Filter out help flags from example list
      const examples =
        exampleArg && !exampleArg.startsWith("-")
          ? exampleArg.split(",")
          : undefined;
      await testAllExamples(examples);
      break;
    }
    default:
      showHelp();
  }
}

// Only run if this is the main module
const isMainModule = process.argv[1]?.includes("maintenance");
if (isMainModule) {
  main().catch(console.error);
}
