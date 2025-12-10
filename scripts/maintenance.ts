#!/usr/bin/env node

/**
 * FHEVM Example Factory - Maintenance Tools
 *
 * CLI tools for maintaining FHEVM examples:
 * - test-all: Interactive example selection & testing
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { EXAMPLES, getExampleNames } from "./shared/config";
import {
  getRootDir,
  getTemplateDir,
  copyDirectoryRecursive,
  getContractName,
} from "./shared/utils";

// =============================================================================
// Types
// =============================================================================

interface TestResult {
  example: string;
  compile: "pass" | "fail" | "skip";
  test: "pass" | "fail" | "skip";
  error?: string;
}

// =============================================================================
// Test Examples
// =============================================================================

/**
 * Run a command and return success/failure
 */
function runCommand(
  cmd: string,
  args: string[],
  cwd: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    let output = "";

    const proc = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ success: code === 0, output });
    });

    proc.on("error", (err) => {
      output += err.message;
      resolve({ success: false, output });
    });
  });
}

/**
 * Extract meaningful error message from compile/test output
 */
function extractErrorMessage(output: string): string {
  const lines = output.split("\n");
  const errorLines: string[] = [];

  for (const line of lines) {
    // Look for Solidity errors
    if (line.includes("Error:") || line.includes("error:")) {
      errorLines.push(line.trim());
    }
    // Look for TypeScript/compilation errors
    if (line.includes("TypeError") || line.includes("SyntaxError")) {
      errorLines.push(line.trim());
    }
    // Look for assertion failures in tests
    if (line.includes("AssertionError") || line.includes("expected")) {
      errorLines.push(line.trim());
    }
    // Look for revert messages
    if (line.includes("revert") || line.includes("reverted")) {
      errorLines.push(line.trim());
    }
    // Look for Hardhat errors
    if (line.includes("HardhatError") || line.includes("ENOENT")) {
      errorLines.push(line.trim());
    }
  }

  if (errorLines.length > 0) {
    return errorLines.slice(0, 5).join("\n"); // Return max 5 error lines
  }

  // If no specific errors found, return last 5 non-empty lines
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  return nonEmptyLines.slice(-5).join("\n");
}

/**
 * Create a standalone example in temp directory
 */
async function createTempExample(
  exampleName: string,
  tempDir: string
): Promise<boolean> {
  try {
    const rootDir = getRootDir();
    const templateDir = getTemplateDir();
    const example = EXAMPLES[exampleName];

    if (!example) return false;

    // Copy template
    copyDirectoryRecursive(templateDir, tempDir);

    // Copy contract
    const contractSource = path.join(rootDir, example.contract);
    const contractName = getContractName(contractSource) || exampleName;
    const contractDest = path.join(tempDir, "contracts", `${contractName}.sol`);

    // Remove template contract if exists
    const templateContract = path.join(tempDir, "contracts", "FHECounter.sol");
    if (fs.existsSync(templateContract)) {
      fs.unlinkSync(templateContract);
    }

    // Remove .gitkeep files
    const contractsGitkeep = path.join(tempDir, "contracts", ".gitkeep");
    const testGitkeep = path.join(tempDir, "test", ".gitkeep");
    if (fs.existsSync(contractsGitkeep)) fs.unlinkSync(contractsGitkeep);
    if (fs.existsSync(testGitkeep)) fs.unlinkSync(testGitkeep);

    fs.copyFileSync(contractSource, contractDest);

    // Copy dependency contracts if specified
    if (example.dependencies && example.dependencies.length > 0) {
      for (const depPath of example.dependencies) {
        const depSource = path.join(rootDir, depPath);
        if (fs.existsSync(depSource)) {
          // Extract contract name from file content
          const contractName = getContractName(depSource);
          if (contractName) {
            const depDest = path.join(
              tempDir,
              "contracts",
              `${contractName}.sol`
            );
            fs.copyFileSync(depSource, depDest);
          }
        }
      }
    }

    // Copy test
    const testSource = path.join(rootDir, example.test);
    const testDest = path.join(tempDir, "test", path.basename(example.test));

    // Remove template tests
    const templateTest = path.join(tempDir, "test", "FHECounter.ts");
    const templateTestSepolia = path.join(
      tempDir,
      "test",
      "FHECounterSepolia.ts"
    );
    if (fs.existsSync(templateTest)) fs.unlinkSync(templateTest);
    if (fs.existsSync(templateTestSepolia)) fs.unlinkSync(templateTestSepolia);

    fs.copyFileSync(testSource, testDest);

    // Remove FHECounter task import from hardhat.config.ts
    const hardhatConfig = path.join(tempDir, "hardhat.config.ts");
    if (fs.existsSync(hardhatConfig)) {
      let configContent = fs.readFileSync(hardhatConfig, "utf-8");
      configContent = configContent.replace(
        /import\s+["']\.\/tasks\/FHECounter["'];?\s*\n?/g,
        ""
      );
      fs.writeFileSync(hardhatConfig, configContent);
    }

    // Remove tasks/FHECounter.ts
    const taskFile = path.join(tempDir, "tasks", "FHECounter.ts");
    if (fs.existsSync(taskFile)) {
      fs.unlinkSync(taskFile);
    }

    // Add npm dependencies if specified
    if (
      example.npmDependencies &&
      Object.keys(example.npmDependencies).length > 0
    ) {
      const packageJsonPath = path.join(tempDir, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8")
        );
        packageJson.dependencies = {
          ...packageJson.dependencies,
          ...example.npmDependencies,
        };
        fs.writeFileSync(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2) + "\n"
        );
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Test selected examples with interactive selection or CLI args
 */
async function testAllExamples(cliExamples?: string[]): Promise<void> {
  p.intro(pc.cyan("🧪 FHEVM Example Tester"));

  const allExamples = getExampleNames();
  let examplesToTest: string[];

  if (cliExamples && cliExamples.length > 0) {
    // Validate CLI examples
    const invalid = cliExamples.filter((e) => !allExamples.includes(e));
    if (invalid.length > 0) {
      p.log.error(`Unknown examples: ${invalid.join(", ")}`);
      p.log.message(pc.dim(`Available: ${allExamples.join(", ")}`));
      process.exit(1);
    }
    examplesToTest = cliExamples;
    p.log.message(
      `Testing ${pc.bold(String(examplesToTest.length))} examples from CLI...`
    );
  } else {
    // Interactive multiselect
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

    examplesToTest = selected as string[];
  }

  if (examplesToTest.length === 0) {
    p.log.warning("No examples selected");
    p.outro(pc.dim("Nothing to test"));
    return;
  }

  p.log.message(
    `\nTesting ${pc.bold(String(examplesToTest.length))} examples...`
  );

  const tempBaseDir = path.join(getRootDir(), ".test-temp");
  const results: TestResult[] = [];

  // Create temp directory
  if (!fs.existsSync(tempBaseDir)) {
    fs.mkdirSync(tempBaseDir, { recursive: true });
  }

  for (let i = 0; i < examplesToTest.length; i++) {
    const exampleName = examplesToTest[i];
    const progress = `[${i + 1}/${examplesToTest.length}]`;

    const s = p.spinner();
    s.start(`${progress} Testing ${exampleName}...`);

    const tempDir = path.join(tempBaseDir, exampleName);
    const result: TestResult = {
      example: exampleName,
      compile: "skip",
      test: "skip",
    };

    try {
      // Clean temp dir if exists
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }

      // Create example
      const created = await createTempExample(exampleName, tempDir);
      if (!created) {
        result.error = "Failed to create example";
        results.push(result);
        s.stop(pc.red(`${progress} ✗ ${exampleName} - setup failed`));
        continue;
      }

      // Install dependencies
      const installResult = await runCommand("npm", ["install"], tempDir);
      if (!installResult.success) {
        result.error = "npm install failed";
        results.push(result);
        s.stop(pc.red(`${progress} ✗ ${exampleName} - install failed`));
        continue;
      }

      // Compile
      const compileResult = await runCommand(
        "npm",
        ["run", "compile"],
        tempDir
      );
      result.compile = compileResult.success ? "pass" : "fail";
      if (!compileResult.success) {
        // Extract the actual error from output
        result.error = extractErrorMessage(compileResult.output);
        results.push(result);
        s.stop(pc.red(`${progress} ✗ ${exampleName} - compile failed`));
        continue;
      }

      // Test
      const testResult = await runCommand("npm", ["run", "test"], tempDir);
      result.test = testResult.success ? "pass" : "fail";
      if (!testResult.success) {
        result.error = extractErrorMessage(testResult.output);
      }

      results.push(result);

      if (result.test === "pass") {
        s.stop(pc.green(`${progress} ✓ ${exampleName}`));
      } else {
        s.stop(pc.red(`${progress} ✗ ${exampleName} - tests failed`));
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      results.push(result);
      s.stop(pc.red(`${progress} ✗ ${exampleName} - unexpected error`));
    }
  }

  // Cleanup temp directory
  if (fs.existsSync(tempBaseDir)) {
    fs.rmSync(tempBaseDir, { recursive: true });
  }

  // Summary
  p.log.message("");
  p.log.message(pc.bold("📊 Test Summary"));
  p.log.message(pc.dim("─".repeat(50)));

  const passed = results.filter((r) => r.test === "pass").length;
  const failed = results.filter((r) => r.test === "fail").length;
  const compileErrors = results.filter((r) => r.compile === "fail").length;
  const skipped = results.filter((r) => r.test === "skip").length;

  p.log.message(`${pc.green("✓ Passed:")} ${passed}`);
  p.log.message(`${pc.red("✗ Failed:")} ${failed}`);
  if (compileErrors > 0) {
    p.log.message(`${pc.yellow("⚠ Compile Errors:")} ${compileErrors}`);
  }
  if (skipped > 0) {
    p.log.message(`${pc.dim("○ Skipped:")} ${skipped}`);
  }

  // Show failed examples with error details
  const failedExamples = results.filter(
    (r) => r.compile === "fail" || r.test === "fail"
  );
  if (failedExamples.length > 0) {
    p.log.message("");
    p.log.message(pc.red(pc.bold("Failed examples:")));
    for (const f of failedExamples) {
      const status = f.compile === "fail" ? "compile" : "test";
      p.log.message("");
      p.log.message(pc.red(`  ✗ ${f.example} (${status} failed)`));
      if (f.error) {
        // Show error details indented
        const errorLines = f.error.split("\n").slice(0, 10); // Max 10 lines
        for (const line of errorLines) {
          p.log.message(pc.dim(`    ${line}`));
        }
        if (f.error.split("\n").length > 10) {
          p.log.message(pc.dim("    ... (truncated)"));
        }
      }
    }
  }

  p.log.message(pc.dim("─".repeat(50)));

  if (failed === 0 && compileErrors === 0) {
    p.outro(pc.green("✨ All selected examples passed!"));
  } else {
    p.outro(pc.yellow("Some examples need attention"));
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "test-all": {
      // Check for CLI examples: npm run test-all fhe-counter,fhe-add
      const exampleArg = args[1];
      const examples = exampleArg ? exampleArg.split(",") : undefined;
      await testAllExamples(examples);
      break;
    }

    default:
      p.intro(pc.cyan("🔧 FHEVM Maintenance Tools"));
      p.log.message("");
      p.log.message(pc.bold("Available commands:"));
      p.log.message("");
      p.log.message(
        `  ${pc.cyan("test-all")}  Interactive example selection & testing`
      );
      p.log.message("");
      p.log.message(pc.bold("Usage:"));
      p.log.message(pc.dim("  npm run test-all"));
      p.log.message(pc.dim("  npm run test-all fhe-counter,fhe-add"));
      p.outro("");
  }
}

main().catch(console.error);
