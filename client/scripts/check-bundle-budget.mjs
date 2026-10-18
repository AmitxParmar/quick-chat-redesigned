#!/usr/bin/env node
/**
 * Bundle budget gate (PERFORMANCE_ENGINEERING 2.4).
 *
 * Runs `next build`, parses the "First Load JS" column from the route
 * table, and fails (exit 1) when any route exceeds the budget.
 *
 * Usage:
 *   node scripts/check-bundle-budget.mjs                  # build + check
 *   node scripts/check-bundle-budget.mjs --log build.txt  # check a saved log
 *   BUNDLE_BUDGET_KB=350 node scripts/check-bundle-budget.mjs
 *
 * In CI, point the log mode at the build step's captured output.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB || 400);

function getBuildOutput() {
  const logFlagIndex = process.argv.indexOf("--log");
  if (logFlagIndex !== -1) {
    const file = process.argv[logFlagIndex + 1];
    if (!file) {
      console.error("--log requires a file path");
      process.exit(2);
    }
    return readFileSync(file, "utf8");
  }

  console.log(`[bundle-budget] Running next build (budget: ${BUDGET_KB} kB First Load JS)...`);
  const result = spawnSync("npx", ["next", "build"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: process.env,
  });
  if (result.status !== 0) {
    console.error("[bundle-budget] next build failed");
    process.exit(result.status || 1);
  }
  return result.stdout;
}

/** Last numeric "(kB|B)" value on a line = First Load JS column. */
function parseFirstLoadJs(output) {
  const routes = [];
  const shared = [];
  for (const line of output.split("\n")) {
    const matches = [...line.matchAll(/([\d.]+)\s*(kB|B)\b/g)];
    if (matches.length === 0) continue;
    const last = matches[matches.length - 1];
    const valueKb = last[2] === "kB" ? Number(last[1]) : Number(last[1]) / 1024;
    const label = line.replace(/[│┌├└─┐┘]/g, " ").trim().split(/\s{2,}/)[0] || line.trim();
    if (/First Load JS shared by all/i.test(line)) {
      shared.push(valueKb);
    } else if (/(kB|B)\s*$/.test(line.trim())) {
      routes.push({ label, firstLoadKb: valueKb });
    }
  }
  return { routes, sharedKb: shared[0] ?? 0 };
}

const output = getBuildOutput();
const { routes, sharedKb } = parseFirstLoadJs(output);

if (routes.length === 0) {
  console.error("[bundle-budget] Could not parse any routes from the build output.");
  process.exit(2);
}

const worst = routes.reduce((a, b) => (b.firstLoadKb > a.firstLoadKb ? b : a));
const overBudget = worst.firstLoadKb > BUDGET_KB;

console.log(`[bundle-budget] Shared First Load JS: ${sharedKb.toFixed(1)} kB`);
console.log(`[bundle-budget] Largest route: ${worst.label} = ${worst.firstLoadKb.toFixed(1)} kB (budget ${BUDGET_KB} kB)`);

if (overBudget) {
  console.error(
    `[bundle-budget] FAIL: ${worst.label} is ${(worst.firstLoadKb - BUDGET_KB).toFixed(1)} kB over budget.`
  );
  console.error("[bundle-budget] Inspect with: ANALYZE=true pnpm build");
  process.exit(1);
}

console.log("[bundle-budget] PASS");
