/**
 * Command Execution & Install/Test
 *
 * Runs npm install, compile, and test commands.
 * Similar to main project's shared/commands.ts
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import { runCommand, extractTestResults } from "./utils.js";
// =============================================================================
// Install & Test
// =============================================================================
/**
 * Runs npm install, compile, and test in the project directory
 */
export async function runInstallAndTest(projectPath) {
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
                s.stop(testResults
                    ? pc.green(`✓ ${step.name} - ${testResults}`)
                    : pc.green(`✓ ${step.name} completed`));
            }
            else {
                s.stop(pc.green(`✓ ${step.name} completed`));
            }
        }
        catch (error) {
            s.stop(pc.red(`✗ ${step.name} failed`));
            if (error instanceof Error) {
                p.log.error(error.message);
            }
            throw new Error(`${step.name} failed`);
        }
    }
    p.log.success(pc.green("All steps completed successfully!"));
}
// =============================================================================
// Quick Start Display
// =============================================================================
/**
 * Shows quick start commands for the created project
 */
export function showQuickStart(relativePath) {
    p.note(`${pc.dim("$")} cd ${relativePath}\n${pc.dim("$")} npm install\n${pc.dim("$")} npm run compile\n${pc.dim("$")} npm run test`, "🚀 Quick Start");
}
/**
 * Asks user if they want to install and test, then runs or shows quick start
 */
export async function askInstallAndTest(resolvedOutput, relativePath) {
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
    }
    else {
        showQuickStart(relativePath);
    }
}
//# sourceMappingURL=commands.js.map