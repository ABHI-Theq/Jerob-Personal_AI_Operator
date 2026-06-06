#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * npm entry point for jerob.
 * Requires Bun to be installed: https://bun.sh
 * Shells out to Bun so the TypeScript source runs natively.
 */

// Check Bun is available
try {
  execFileSync("bun", ["--version"], { stdio: "ignore" });
} catch {
  console.error(
    "\n[jerob] Bun is required but not installed.\n" +
    "Install it from https://bun.sh and try again.\n" +
    "  Windows: powershell -c \"irm bun.sh/install.ps1 | iex\"\n" +
    "  macOS/Linux: curl -fsSL https://bun.sh/install | bash\n"
  );
  process.exit(1);
}

const entry = path.join(__dirname, "..", "index.ts");

execFileSync("bun", [entry, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
});
