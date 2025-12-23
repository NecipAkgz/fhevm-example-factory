#!/usr/bin/env node

/**
 * FHEVM Doctor - Environment and project integrity validator
 *
 * Checks:
 *   - Node.js version compatibility
 *   - Git installation
 *   - Config.ts path integrity (validates all example paths)
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { getRootDir } from "../shared/utils";
import { ExampleConfig, EXAMPLES } from "../shared/config";

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

async function checkSubmoduleStatus(): Promise<CheckResult> {
  const SUBMODULE_PATH = "fhevm-hardhat-template";
  const SUBMODULE_URL = "https://github.com/zama-ai/fhevm-hardhat-template";

  try {
    // 1. Get local commit hash
    const localStatus = execSync(`git submodule status ${SUBMODULE_PATH}`, {
      stdio: "pipe",
      encoding: "utf-8",
    }).trim();

    // git submodule status output: " 3e01a81bfca5f0857cba55a099e98863efc79bcb fhevm-hardhat-template (v0.2.0-2-g3e01a81)"
    const localHash = localStatus.split(" ").filter((s) => s.length > 0)[0];

    if (!localHash || localHash.length < 40) {
      return {
        name: "Submodule status",
        status: "fail",
        message: "Not initialized",
        details: [
          `Run ${pc.bold("git submodule update --init")} to initialize.`,
        ],
      };
    }

    // 2. Get remote commit hash
    // We use a timeout to not hang doctor script if internet is slow/down
    const remoteInfo = execSync(`git ls-remote ${SUBMODULE_URL} HEAD`, {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 5000, // 5 seconds timeout
    }).trim();

    const remoteHash = remoteInfo.split("\t")[0];

    if (!remoteHash || remoteHash.length < 40) {
      return {
        name: "Submodule status",
        status: "warn",
        message: "Connection error",
        details: ["Could not fetch remote status from GitHub."],
      };
    }

    if (localHash === remoteHash) {
      return {
        name: "Submodule status",
        status: "success",
        message: "Up to date",
      };
    } else {
      return {
        name: "Submodule status",
        status: "warn",
        message: "Update available",
        details: [
          `Local:  ${pc.dim(localHash.slice(0, 7))}`,
          `Remote: ${pc.dim(remoteHash.slice(0, 7))}`,
          `Run ${pc.bold("git submodule update --remote --merge")} to update.`,
        ],
      };
    }
  } catch (e) {
    return {
      name: "Submodule status",
      status: "warn",
      message: "Check skipped",
      details: ["Git error or no internet connection."],
    };
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  p.intro(pc.cyan("🩺 FHEVM Doctor"));

  const checks = [
    checkNodeVersion(),
    checkGit(),
    checkConfigIntegrity(),
    checkSubmoduleStatus(),
  ];

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
