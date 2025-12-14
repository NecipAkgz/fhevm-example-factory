/**
 * Shared command execution utilities
 */

import { spawn } from "child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";

// =============================================================================
// Command Execution
// =============================================================================

/**
 * Runs a shell command and returns the output
 * @throws Error if command fails
 */
export function runCommand(
  cmd: string,
  args: string[],
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(stderr || stdout || `Command failed with code ${code}`)
        );
      }
    });

    child.on("error", reject);
  });
}

/**
 * Run a command and return success/failure with output
 */
export function runCommandWithStatus(
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

// =============================================================================
// Output Parsing
// =============================================================================

/**
 * Extracts test results from npm test output
 */
export function extractTestResults(output: string): string | null {
  const passingMatch = output.match(/(\d+)\s+passing/);
  const failingMatch = output.match(/(\d+)\s+failing/);

  if (passingMatch) {
    const passing = passingMatch[1];
    const failing = failingMatch ? failingMatch[1] : "0";
    if (failing === "0") {
      return `${passing} tests passing ✓`;
    } else {
      return `${passing} passing, ${failing} failing`;
    }
  }
  return null;
}

/**
 * Extract meaningful error message from compile/test output
 */
export function extractErrorMessage(output: string): string {
  const lines = output.split("\n");
  const errorLines: string[] = [];

  for (const line of lines) {
    if (line.includes("Error:") || line.includes("error:")) {
      errorLines.push(line.trim());
    }
    if (line.includes("TypeError") || line.includes("SyntaxError")) {
      errorLines.push(line.trim());
    }
    if (line.includes("AssertionError") || line.includes("expected")) {
      errorLines.push(line.trim());
    }
    if (line.includes("revert") || line.includes("reverted")) {
      errorLines.push(line.trim());
    }
    if (line.includes("HardhatError") || line.includes("ENOENT")) {
      errorLines.push(line.trim());
    }
  }

  if (errorLines.length > 0) {
    return errorLines.slice(0, 5).join("\n");
  }

  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  return nonEmptyLines.slice(-5).join("\n");
}

// =============================================================================
// Install & Test Utilities
// =============================================================================

/**
 * Runs npm install, compile, and test in the project directory
 */
export async function runInstallAndTest(projectPath: string): Promise<void> {
  const steps = [
    {
      name: "Installing dependencies",
      cmd: "npm",
      args: ["install"],
      showOutput: false,
    },
    {
      name: "Compiling contracts",
      cmd: "npm",
      args: ["run", "compile"],
      showOutput: false,
    },
    {
      name: "Running tests",
      cmd: "npm",
      args: ["run", "test"],
      showOutput: true,
    },
  ];

  for (const step of steps) {
    const s = p.spinner();
    s.start(step.name + "...");

    try {
      const output = await runCommand(step.cmd, step.args, projectPath);

      if (step.showOutput) {
        const testResults = extractTestResults(output);
        s.stop(
          testResults
            ? pc.green(`✓ ${step.name} - ${testResults}`)
            : pc.green(`✓ ${step.name} completed`)
        );
      } else {
        s.stop(pc.green(`✓ ${step.name} completed`));
      }
    } catch (error) {
      s.stop(pc.red(`✗ ${step.name} failed`));
      if (error instanceof Error) {
        p.log.error(error.message);
      }
      throw new Error(`${step.name} failed`);
    }
  }

  p.log.success(pc.green("All steps completed successfully!"));
}

/**
 * Shows quick start commands
 */
export function showQuickStart(relativePath: string): void {
  p.note(
    `${pc.dim("$")} cd ${relativePath}\n${pc.dim("$")} npm install\n${pc.dim(
      "$"
    )} npm run compile\n${pc.dim("$")} npm run test`,
    "🚀 Quick Start"
  );
}

/**
 * Asks user if they want to install and test
 */
export async function askInstallAndTest(
  resolvedOutput: string,
  relativePath: string
): Promise<void> {
  const shouldInstall = await p.confirm({
    message: "Install dependencies and run tests?",
    initialValue: false,
  });

  if (p.isCancel(shouldInstall)) {
    showQuickStart(relativePath);
    return;
  }

  if (shouldInstall) {
    p.log.message("");
    await runInstallAndTest(resolvedOutput);
  } else {
    showQuickStart(relativePath);
  }
}
