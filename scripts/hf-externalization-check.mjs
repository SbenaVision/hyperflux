#!/usr/bin/env node
/**
 * hf:externalization-check — HyperFlux externalization enforcement gate
 *
 * Ensures everything above the TypeScript kernel is either:
 *   (A) HyperFlux data — rule / content / config / policy / validation / lifecycle
 *   (B) Approved UI glue — rendering, layout, React state, CSS, event plumbing
 *   (C) Kernel code (packages/core only)
 *
 * Checks:
 *   1. No bare string literals as lifecycle engine.run() addresses
 *   2. No hardcoded <option value="..."> elements outside rule-driven maps
 *   3. No hardcoded internal href="..." in navigation components
 *   4. No user-facing JSX text literals (multi-char text nodes, not expressions)
 *   5. No hardcoded config constants (durations ms, slice limits, key bindings)
 *   6. No mutation API routes (POST/PUT/DELETE) bypassing lifecycle before/after guards
 *   7. No bare string literals in NextResponse.json({ error: "..." }) — use readConfigString
 *   8. No null-coalesce fallback arrays (?? [...]) for values that should come from rules
 *
 * Escape hatch — place on violation line or immediately above it:
 *   // hf:allow-hardcoded reason="<explanation>"
 *   Valid:   protocol constants, CSS/layout glue, framework mechanics, dev-only errors
 *   Invalid: product behavior, UX strings, durations, config values
 *   Every allow is counted and printed in the report.
 *
 * Modes:
 *   --strict  (default) exits non-zero on any unescaped violation
 *   --warn    prints violations but always exits 0
 *
 * Scope:
 *   default   apps/admin/hiflux/src  (HiFlux admin, strict)
 *   --all     also scans packages/react/src, packages/cli/src, packages/lint/src
 *
 * Usage:
 *   node scripts/hf-externalization-check.mjs [--strict|--warn] [--all]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT  = process.cwd();
const MODE  = process.argv.includes("--warn") ? "warn" : "strict";
const ALL   = process.argv.includes("--all");

// ── Scope definition ─────────────────────────────────────────────────────────
const SCAN_DIRS = [
  { dir: join(ROOT, "apps/admin/hiflux/src"), label: "hiflux-admin" },
  ...(ALL ? [
    { dir: join(ROOT, "packages/react/src"),  label: "pkg:react"    },
    { dir: join(ROOT, "packages/cli/src"),    label: "pkg:cli"      },
    { dir: join(ROOT, "packages/lint/src"),   label: "pkg:lint"     },
  ] : []),
];

// ── Escape hatch ─────────────────────────────────────────────────────────────
// Must have reason="..." — bare // hf:allow-hardcoded is NOT valid
const ALLOW_RE = /\/\/\s*hf:allow-hardcoded\s+reason=["'][^"']+["']/;

// ── State ────────────────────────────────────────────────────────────────────
let totalViolations = 0;
let totalAllows     = 0;
const violationList = [];

// ── Helpers ──────────────────────────────────────────────────────────────────
function rel(p) { return relative(ROOT, p); }

function walkFiles(dir, exts) {
  const out = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // skip test directories and build output
        if (["__tests__", "dist", "node_modules", ".next"].includes(entry)) continue;
        out.push(...walkFiles(full, exts));
      } else if (exts.some((e) => full.endsWith(e)) && !full.match(/\.test\.[jt]sx?$/)) {
        out.push(full);
      }
    }
  } catch { /* dir may not exist */ }
  return out;
}

/** True if line i or line i-1 has a valid hf:allow-hardcoded with a reason */
function isAllowed(lines, i) {
  return ALLOW_RE.test(lines[i] ?? "") || ALLOW_RE.test(lines[i - 1] ?? "");
}

function countFileAllows(lines) {
  return lines.filter((l) => ALLOW_RE.test(l)).length;
}

function addViolation(check, file, lineNum, lineContent, fix) {
  violationList.push({
    check,
    file: rel(file),
    line: lineNum,
    content: lineContent.trim().slice(0, 120),
    fix,
  });
  totalViolations++;
}

// ── Check 1: engine.run() with hardcoded string literal address ──────────────
//    engine.run("rules.something", ...) → read address from config rule
function check1(file, lines) {
  const RE = /engine\.run\(\s*["'][^"']+["']/;
  for (let i = 0; i < lines.length; i++) {
    if (!RE.test(lines[i])) continue;
    if (isAllowed(lines, i)) { totalAllows++; continue; }
    addViolation(
      "check-1", file, i + 1, lines[i],
      "Read address via readConfigString('hiflux.config.lifecycle_address_*', fallback)"
    );
  }
}

// ── Check 2: <option value="..."> hardcoded (not a JSX expression) ───────────
//    <option value="draft"> → options should be .map() from a rule array
function check2(file, lines) {
  const RE = /<option\b[^>]*\bvalue=["'][^"']+["']/;
  for (let i = 0; i < lines.length; i++) {
    if (!RE.test(lines[i])) continue;
    if (isAllowed(lines, i)) { totalAllows++; continue; }
    addViolation(
      "check-2", file, i + 1, lines[i],
      "Drive options from useRule('hiflux.config.rule_statuses', {}).map(s => <option value={s}>)"
    );
  }
}

// ── Check 3: hardcoded internal href="/path" in navigation ───────────────────
//    href="/rules" → use href={routeRules ?? '/rules'} from useRule
//    Allows: href="/" (root), href="https://...", href="http://...", href="#..."
function check3(file, lines) {
  // Match href="/letter..." (internal paths, not root /, not external URLs)
  const RE = /\bhref=["']\/[a-zA-Z][^"']*["']/;
  for (let i = 0; i < lines.length; i++) {
    if (!RE.test(lines[i])) continue;
    if (isAllowed(lines, i)) { totalAllows++; continue; }
    addViolation(
      "check-3", file, i + 1, lines[i],
      "Read route from useRule('hiflux.config.route_*', {}) and use href={routeVar ?? '/fallback'}"
    );
  }
}

// ── Check 4: user-facing JSX text literals ────────────────────────────────────
//    >Time</th> → move "Time" to content/ as hiflux.table.col_time_header
//    Only matches text nodes: >TEXT< where TEXT has no { } and ≥ 2 alpha chars
function check4(file, lines) {
  // Text between closing and opening tag: > content </tag
  const RE = />\s*([A-Za-z][^{}<>\n]{1,80})\s*<\//;
  for (let i = 0; i < lines.length; i++) {
    const m = RE.exec(lines[i]);
    if (!m) continue;
    const text = m[1].trim();
    // Skip pure numbers / symbols / whitespace
    if (/^[\d\s.%px!?]+$/.test(text)) continue;
    // Skip lines that are entirely within a JSX expression (contains { before this text)
    const beforeMatch = lines[i].slice(0, m.index);
    if ((beforeMatch.match(/\{/g) ?? []).length > (beforeMatch.match(/\}/g) ?? []).length) continue;
    if (isAllowed(lines, i)) { totalAllows++; continue; }
    const key = text.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30);
    addViolation(
      "check-4", file, i + 1, lines[i],
      `Move "${text}" to content/ — useContent("hiflux.table.col_${key}_header") or appropriate namespace`
    );
  }
}

// ── Check 5: hardcoded config constants ──────────────────────────────────────
//   setTimeout(fn, 2500)     → useRule('hiflux.config.toast_duration_ms', {})
//   str.slice(0, 60)         → useRule('hiflux.config.result_truncate_length', {})
//   keyboard key literals in event handlers when config rules exist
function check5(file, lines) {
  // setTimeout with literal ≥ 100ms (3+ digits) as the direct second argument
  const TIMEOUT_RE = /\bsetTimeout\s*\([^,)]+,\s*(\d{3,})\s*\)/;
  // .slice(0, N) with literal ≥ 10 as direct second argument
  const SLICE_RE   = /\.slice\s*\(\s*0\s*,\s*(\d{2,})\s*\)/;

  for (let i = 0; i < lines.length; i++) {
    if (isAllowed(lines, i)) { totalAllows++; continue; }
    if (TIMEOUT_RE.test(lines[i])) {
      addViolation(
        "check-5", file, i + 1, lines[i],
        "Extract duration to a config rule — useRule('hiflux.config.toast_duration_ms', {})"
      );
    }
    if (SLICE_RE.test(lines[i])) {
      addViolation(
        "check-5", file, i + 1, lines[i],
        "Extract truncation limit — useRule('hiflux.config.result_truncate_length', {})"
      );
    }
  }
}

// ── Check 6: mutation API routes bypassing lifecycle ─────────────────────────
//    export async function POST/PUT/DELETE without engine.run() before + after
//    Per-function: each mutation handler needs ≥ 2 engine.run() calls
function check6(file, lines) {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/export\s+async\s+function\s+(POST|PUT|DELETE)\b/);
    if (!m) continue;

    // File-level allow in first 5 lines covers read-only POST handlers
    const fileHeaderAllowed = lines.slice(0, 5).some((l) => ALLOW_RE.test(l));
    if (fileHeaderAllowed || isAllowed(lines, i)) { totalAllows++; continue; }

    // Scan up to 60 lines of this function body for engine.run() calls
    const fnLines = lines.slice(i, i + 60).join("\n");
    const runCount = (fnLines.match(/\bengine\.run\s*\(/g) ?? []).length;

    if (runCount < 2) {
      addViolation(
        "check-6", file, i + 1, lines[i],
        `${m[1]} handler needs engine.run(addr,"before",...) AND engine.run(addr,"after",...) — found ${runCount}`
      );
    }
  }
}

// ── Check 7: bare string in NextResponse.json({ error: "..." }) ──────────────
//    NextResponse.json({ error: "Not found" }) → read from readConfigString(...)
function check7(file, lines) {
  const RE = /NextResponse\.json\(\s*\{[^}]*\berror:\s*["'][^"']{2,}["']/;
  for (let i = 0; i < lines.length; i++) {
    if (!RE.test(lines[i])) continue;
    if (isAllowed(lines, i)) { totalAllows++; continue; }
    addViolation(
      "check-7", file, i + 1, lines[i],
      "Read error message via readConfigString('hiflux.messages.api_*', fallback)"
    );
  }
}

// ── Check 8: null-coalesce fallback arrays (?? [...]) ────────────────────────
//    ruleStatuses ?? ["draft", "active", "archived"] → rule must be authoritative
function check8(file, lines) {
  const RE = /\?\?\s*\[["'][^"']+["']/;
  for (let i = 0; i < lines.length; i++) {
    if (!RE.test(lines[i])) continue;
    if (isAllowed(lines, i)) { totalAllows++; continue; }
    addViolation(
      "check-8", file, i + 1, lines[i],
      "Remove fallback array literal — the rule is authoritative; use ?? [] if you need an empty default"
    );
  }
}

// ── Main scan ─────────────────────────────────────────────────────────────────
console.log(`\nhf:externalization-check — ${MODE} mode${ALL ? " (--all)" : ""}\n`);
console.log("hf:ext — 1. Lifecycle engine.run() string literal addresses");
console.log("hf:ext — 2. Hardcoded <option value=\"...\"> elements");
console.log("hf:ext — 3. Hardcoded internal href in navigation components");
console.log("hf:ext — 4. User-facing JSX text literals");
console.log("hf:ext — 5. Hardcoded config constants (timeouts, slice limits)");
console.log("hf:ext — 6. Mutation API routes bypassing lifecycle guards");
console.log("hf:ext — 7. Bare string literals in NextResponse.json({ error })");
console.log("hf:ext — 8. Null-coalesce fallback arrays (?? [...]) for rule values\n");

let totalFiles = 0;

for (const { dir, label } of SCAN_DIRS) {
  const tsFiles  = walkFiles(dir, [".ts"]);
  const tsxFiles = walkFiles(dir, [".tsx"]);
  const allFiles = [...tsFiles, ...tsxFiles];
  totalFiles += allFiles.length;

  const apiFiles = tsFiles.filter((f) => f.includes("/api/"));

  for (const file of allFiles) {
    const content = readFileSync(file, "utf8");
    const lines   = content.split("\n");

    totalAllows += countFileAllows(lines);

    const isTsx    = file.endsWith(".tsx");
    const isApiTs  = apiFiles.includes(file);

    // Check 1: any source file (engine.run in API routes, lib)
    check1(file, lines);
    // Check 2–4: only JSX files (option elements, hrefs, text literals)
    if (isTsx) {
      check2(file, lines);
      check3(file, lines);
      check4(file, lines);
    }
    // Check 5: any source file (config constants)
    check5(file, lines);
    // Check 6: API route files only
    if (isApiTs) check6(file, lines);
    // Check 7: API route files — bare error strings in NextResponse.json
    if (isApiTs) check7(file, lines);
    // Check 8: any TSX file — fallback array literals after ??
    if (isTsx) check8(file, lines);
  }

  const scopeViolations = violationList.filter((v) =>
    v.file.startsWith(relative(ROOT, dir))
  );
  if (scopeViolations.length > 0) {
    console.log(`  [${label}] ${scopeViolations.length} violation(s)`);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (violationList.length > 0) {
  console.log(`\nViolations (${violationList.length}):\n`);

  // Group by check
  const byCheck = {};
  for (const v of violationList) {
    if (!byCheck[v.check]) byCheck[v.check] = [];
    byCheck[v.check].push(v);
  }

  const CHECK_NAMES = {
    "check-1": "Lifecycle address string literal",
    "check-2": "Hardcoded <option value>",
    "check-3": "Hardcoded internal href",
    "check-4": "JSX text literal",
    "check-5": "Hardcoded config constant",
    "check-6": "Lifecycle bypass in mutation route",
    "check-7": "Bare error string in NextResponse.json",
    "check-8": "Null-coalesce fallback array for rule value",
  };

  for (const [check, vlist] of Object.entries(byCheck)) {
    console.error(`  ── ${CHECK_NAMES[check] ?? check} (${vlist.length}) ──`);
    for (const v of vlist) {
      console.error(`  [${v.check}] ${v.file}:${v.line}`);
      console.error(`    found: ${v.content}`);
      console.error(`    fix:   ${v.fix}`);
      console.error("");
    }
  }
}

console.log(`Files scanned:      ${totalFiles}`);
console.log(`Violations:         ${totalViolations}`);
console.log(`Allowed exceptions: ${totalAllows}`);
console.log("");

if (totalViolations === 0) {
  console.log(`hf:externalization-check PASSED ✓ [${MODE}]\n`);
  process.exit(0);
} else if (MODE === "warn") {
  console.warn(`hf:externalization-check WARNING — ${totalViolations} violation(s) [warn — not blocking]\n`);
  process.exit(0);
} else {
  console.error(`hf:externalization-check FAILED — ${totalViolations} violation(s) [strict]\n`);
  process.exit(1);
}
