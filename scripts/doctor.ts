#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { log, getRootDir } from "./utils";
import { ExampleConfig, EXAMPLES } from "./config";

// =============================================================================
// Helper Types & Utils
// =============================================================================

type CheckResult = {
  name: string;
  status: "success" | "fail" | "warn";
  message?: string;
  details?: string[];
};

const ROOT_DIR = getRootDir();

// =============================================================================
// Checks
// =============================================================================

async function checkNodeVersion(): Promise<CheckResult> {
  const version = process.version;
  const major = parseInt(version.slice(1).split(".")[0]);

  if (major >= 20) {
    return {
      name: "Node.js Version",
      status: "success",
      message: `${version} (>= 20.0.0)`,
    };
  } else {
    return {
      name: "Node.js Version",
      status: "fail",
      message: `${version} (Required: >= 20.0.0)`,
      details: ["Please upgrade Node.js to version 20 or later."],
    };
  }
}

async function checkGit(): Promise<CheckResult> {
  try {
    execSync("git --version", { stdio: "ignore" });
    return {
      name: "Git Installation",
      status: "success",
      message: "Installed",
    };
  } catch (e) {
    return {
      name: "Git Installation",
      status: "fail",
      message: "Not found",
      details: [
        "Git is required to clone templates and manage the repository.",
      ],
    };
  }
}

async function checkConfigIntegrity(): Promise<CheckResult> {
  const issues: string[] = [];

  // 1. Check if configured files exist
  for (const [name, config] of Object.entries(EXAMPLES)) {
    const c = config as ExampleConfig;
    // Config paths already include "contracts/" and "test/" prefixes
    // So we join them directly with ROOT_DIR
    const contractPath = path.join(ROOT_DIR, c.contract);
    const testPath = path.join(ROOT_DIR, c.test);

    if (!fs.existsSync(contractPath)) {
      issues.push(
        `Checking ${pc.bold(name)}: Contract not found at ${c.contract}`
      );
    }
    if (!fs.existsSync(testPath)) {
      issues.push(
        `Checking ${pc.bold(name)}: Test file not found at ${c.test}`
      );
    }
  }

  if (issues.length === 0) {
    return {
      name: "Config Integrity",
      status: "success",
      message: "All paths valid",
    };
  } else {
    return {
      name: "Config Integrity",
      status: "fail",
      message: `${issues.length} issues found`,
      details: issues,
    };
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  p.intro(pc.cyan("🩺 FHEVM Doctor"));

  const checks = [checkNodeVersion(), checkGit(), checkConfigIntegrity()];

  const results = await Promise.all(checks);
  let hasFailure = false;

  for (const result of results) {
    if (result.status === "success") {
      p.log.message(
        `${pc.green("✓")} ${pc.bold(result.name)}: ${pc.dim(
          result.message || "OK"
        )}`
      );
    } else if (result.status === "warn") {
      p.log.message(
        `${pc.yellow("!")} ${pc.bold(result.name)}: ${result.message}`
      );
      if (result.details) {
        result.details.forEach((line) =>
          p.log.message(pc.yellow(`   ${line}`))
        );
      }
    } else {
      hasFailure = true;
      p.log.message(
        `${pc.red("✗")} ${pc.bold(result.name)}: ${result.message}`
      );
      if (result.details) {
        result.details.forEach((line) => p.log.message(pc.red(`   ${line}`)));
      }
    }
  }

  p.log.message("");

  if (hasFailure) {
    p.outro(pc.red("❌ Some checks failed. Please review the issues above."));
    process.exit(1);
  } else {
    p.outro(pc.green("✅ All checks passed! You are ready to develop. 🚀"));
  }
}

main().catch(console.error);
