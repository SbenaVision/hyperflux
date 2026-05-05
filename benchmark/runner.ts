#!/usr/bin/env node
/**
 * @file benchmark/runner.ts
 *
 * Benchmark runner for the HyperFlux vs Vanilla comparison.
 *
 * Usage:
 *   npx ts-node benchmark/runner.ts --version vanilla|hyperflux --change <1-20>
 *   npx ts-node benchmark/runner.ts --summarize   # summarize all completed runs
 *
 * The runner writes one JSON result file per change per version to
 * benchmark/results/<version>-change-<N>.json.
 *
 * The actual code changes are applied manually (or via Claude Code); this
 * runner measures the metadata: wall-clock time, LOC touched, and provides
 * the before/after diff for token counting.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const RESULTS_DIR = join(__dirname, "results");

if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Change {
  id: number;
  prompt: string;
  category: string;
  hyperflux_target: string;
  vanilla_target: string;
  notes: string;
}

interface RunResult {
  version: "vanilla" | "hyperflux";
  change: number;
  prompt: string;
  category: string;
  startedAt: string;
  completedAt?: string;
  wallClockMs?: number;
  filesChanged: string[];
  locAdded: number;
  locRemoved: number;
  regressions: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--summarize")) {
  summarize();
  process.exit(0);
}

const versionIdx = args.indexOf("--version");
const changeIdx = args.indexOf("--change");

if (versionIdx === -1 || changeIdx === -1) {
  console.log(`
Usage:
  npx ts-node benchmark/runner.ts --version vanilla|hyperflux --change <1-20>
  npx ts-node benchmark/runner.ts --summarize

Examples:
  npx ts-node benchmark/runner.ts --version vanilla --change 1
  npx ts-node benchmark/runner.ts --version hyperflux --change 1
  npx ts-node benchmark/runner.ts --summarize
`);
  process.exit(1);
}

const version = args[versionIdx + 1] as "vanilla" | "hyperflux";
const changeNum = parseInt(args[changeIdx + 1], 10);

if (!["vanilla", "hyperflux"].includes(version)) {
  console.error("--version must be 'vanilla' or 'hyperflux'");
  process.exit(1);
}

if (isNaN(changeNum) || changeNum < 1 || changeNum > 20) {
  console.error("--change must be a number 1-20");
  process.exit(1);
}

runChange(version, changeNum);

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function runChange(version: "vanilla" | "hyperflux", changeNum: number): void {
  const changesFile = join(__dirname, "changes", "changes.json");
  const { changes }: { changes: Change[] } = JSON.parse(readFileSync(changesFile, "utf8"));
  const change = changes.find((c) => c.id === changeNum);

  if (!change) {
    console.error(`Change #${changeNum} not found`);
    process.exit(1);
  }

  const appDir = join(__dirname, version);
  const resultFile = join(RESULTS_DIR, `${version}-change-${changeNum}.json`);

  // Capture git state before
  let gitStateBefore = "";
  try {
    gitStateBefore = execSync("git diff --stat HEAD", { cwd: ROOT }).toString();
  } catch { /* not a git repo or no changes */ }

  const startedAt = new Date().toISOString();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`HyperFlux Benchmark — Change #${changeNum} — ${version.toUpperCase()}`);
  console.log(`${"─".repeat(60)}`);
  console.log(`\nPrompt: "${change.prompt}"`);
  console.log(`\nTarget: ${version === "vanilla" ? change.vanilla_target : change.hyperflux_target}`);
  console.log(`\n📝 Apply the change now. Press Enter when done...`);

  // Wait for user to apply the change
  const readline = require("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question("", () => {
    rl.close();

    const completedAt = new Date().toISOString();
    const wallClockMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Measure LOC touched via git diff
    let locAdded = 0;
    let locRemoved = 0;
    let filesChanged: string[] = [];

    try {
      const diffStat = execSync(`git diff --numstat -- ${appDir}`, { cwd: ROOT }).toString();
      for (const line of diffStat.trim().split("\n")) {
        if (!line.trim()) continue;
        const parts = line.split("\t");
        if (parts.length >= 3) {
          locAdded += parseInt(parts[0], 10) || 0;
          locRemoved += parseInt(parts[1], 10) || 0;
          filesChanged.push(parts[2]);
        }
      }
    } catch { /* ignore */ }

    console.log(`\nRegressions check: Did any other features break? (Enter a number, default 0)`);

    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl2.question("Regression count: ", (regressionStr: string) => {
      rl2.close();

      const regressions = parseInt(regressionStr, 10) || 0;

      const result: RunResult = {
        version,
        change: changeNum,
        prompt: change.prompt,
        category: change.category,
        startedAt,
        completedAt,
        wallClockMs,
        filesChanged,
        locAdded,
        locRemoved,
        regressions,
        notes: change.notes,
      };

      writeFileSync(resultFile, JSON.stringify(result, null, 2));

      console.log(`\n✓ Result saved to: benchmark/results/${version}-change-${changeNum}.json`);
      console.log(`  Wall clock: ${(wallClockMs / 1000).toFixed(1)}s`);
      console.log(`  Files changed: ${filesChanged.length}`);
      console.log(`  LOC: +${locAdded} -${locRemoved}`);
      console.log(`  Regressions: ${regressions}`);
    });
  });
}

// ---------------------------------------------------------------------------
// Summarize
// ---------------------------------------------------------------------------

function summarize(): void {
  const results: RunResult[] = [];

  for (let i = 1; i <= 20; i++) {
    for (const version of ["vanilla", "hyperflux"] as const) {
      const file = join(RESULTS_DIR, `${version}-change-${i}.json`);
      if (existsSync(file)) {
        results.push(JSON.parse(readFileSync(file, "utf8")));
      }
    }
  }

  if (results.length === 0) {
    console.log("No results yet. Run some changes first.");
    return;
  }

  const vanilla = results.filter((r) => r.version === "vanilla");
  const hyperflux = results.filter((r) => r.version === "hyperflux");

  const avg = (nums: number[]) =>
    nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "n/a";

  console.log(`\n${"═".repeat(60)}`);
  console.log(`HyperFlux Benchmark — Summary (${results.length} runs)`);
  console.log(`${"═".repeat(60)}`);

  console.log(`\n${"─".repeat(40)}`);
  console.log(`VANILLA (${vanilla.length} changes completed)`);
  console.log(`${"─".repeat(40)}`);
  console.log(`  Avg wall clock:    ${avg(vanilla.map((r) => r.wallClockMs ?? 0))} ms`);
  console.log(`  Avg LOC added:     ${avg(vanilla.map((r) => r.locAdded))}`);
  console.log(`  Avg LOC removed:   ${avg(vanilla.map((r) => r.locRemoved))}`);
  console.log(`  Total regressions: ${vanilla.reduce((a, r) => a + r.regressions, 0)}`);
  console.log(`  Avg files changed: ${avg(vanilla.map((r) => r.filesChanged.length))}`);

  console.log(`\n${"─".repeat(40)}`);
  console.log(`HYPERFLUX (${hyperflux.length} changes completed)`);
  console.log(`${"─".repeat(40)}`);
  console.log(`  Avg wall clock:    ${avg(hyperflux.map((r) => r.wallClockMs ?? 0))} ms`);
  console.log(`  Avg LOC added:     ${avg(hyperflux.map((r) => r.locAdded))}`);
  console.log(`  Avg LOC removed:   ${avg(hyperflux.map((r) => r.locRemoved))}`);
  console.log(`  Total regressions: ${hyperflux.reduce((a, r) => a + r.regressions, 0)}`);
  console.log(`  Avg files changed: ${avg(hyperflux.map((r) => r.filesChanged.length))}`);

  if (vanilla.length > 0 && hyperflux.length > 0) {
    const avgVanillaLoc = vanilla.reduce((a, r) => a + r.locAdded + r.locRemoved, 0) / vanilla.length;
    const avgHfLoc = hyperflux.reduce((a, r) => a + r.locAdded + r.locRemoved, 0) / hyperflux.length;
    const reduction = avgVanillaLoc > 0 ? (((avgVanillaLoc - avgHfLoc) / avgVanillaLoc) * 100).toFixed(0) : "n/a";

    console.log(`\n${"─".repeat(40)}`);
    console.log(`COMPARISON`);
    console.log(`${"─".repeat(40)}`);
    console.log(`  LOC reduction with HyperFlux: ${reduction}%`);
    console.log(`  Vanilla regressions:   ${vanilla.reduce((a, r) => a + r.regressions, 0)}`);
    console.log(`  HyperFlux regressions: ${hyperflux.reduce((a, r) => a + r.regressions, 0)}`);
  }

  // Write CSV
  const csvFile = join(RESULTS_DIR, "summary.csv");
  const headers = "version,change,category,prompt,wallClockMs,locAdded,locRemoved,filesChanged,regressions";
  const rows = results.map((r) =>
    [
      r.version,
      r.change,
      r.category,
      `"${r.prompt.replace(/"/g, '""')}"`,
      r.wallClockMs ?? "",
      r.locAdded,
      r.locRemoved,
      r.filesChanged.length,
      r.regressions,
    ].join(",")
  );
  writeFileSync(csvFile, [headers, ...rows].join("\n") + "\n");
  console.log(`\n✓ CSV written to: benchmark/results/summary.csv\n`);
}
