#!/usr/bin/env node
/**
 * hf:check — HiFlux isolation enforcement
 *
 * Checks:
 *  1. No hiflux.* rule (in rules/) requires legacy namespaces
 *  2. No hiflux src file imports from benchmark/ or rules/admin.json
 *  3. No content-shaped entries (label/title/button/placeholder/message/header)
 *     inside rules/ — those belong in content/
 *  4. All rules in hiflux rules/ and content/ start with "hiflux."
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const HIFLUX_RULES_DIR     = join(ROOT, "apps/admin/hiflux/rules");
const HIFLUX_CONTENT_DIR   = join(ROOT, "apps/admin/hiflux/content");
const HIFLUX_LIFECYCLE_DIR = join(ROOT, "apps/admin/hiflux/lifecycle");
const HIFLUX_SRC_DIR       = join(ROOT, "apps/admin/hiflux/src");

const LEGACY_NAMESPACES    = ["config.", "copy.", "pricing.", "users.", "admin."];
const FORBIDDEN_IMPORTS    = ["benchmark/", "rules/admin.json"];
const CONTENT_PATH_SIGNALS = ["label", "title", "button", "placeholder", "message", "header", "note", "copy", "caption"];

let failures = 0;

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failures++;
}

function loadJsonFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ file: f, data: JSON.parse(readFileSync(join(dir, f), "utf8")) }));
  } catch {
    return [];
  }
}

function walkFiles(dir, exts) {
  const out = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walkFiles(full, exts));
      else if (exts.some((e) => entry.endsWith(e))) out.push(full);
    }
  } catch { /* dir may not exist yet */ }
  return out;
}

// ── Check 1: no hiflux rules/ entry requires a legacy namespace ─────────────
console.log("\nhf:check — 1. No legacy deps in rules/");
for (const { file, data } of loadJsonFiles(HIFLUX_RULES_DIR)) {
  for (const rule of data.rules ?? []) {
    for (const dep of rule.metadata?.requires ?? []) {
      if (LEGACY_NAMESPACES.some((ns) => dep.startsWith(ns))) {
        fail(`hiflux-no-legacy-refs: ${rule.path} requires legacy "${dep}" (${file})`);
      }
    }
  }
}

// ── Check 2: no hiflux src imports from benchmark or rules/admin.json ────────
console.log("hf:check — 2. No forbidden imports in src/");
for (const srcFile of walkFiles(HIFLUX_SRC_DIR, [".ts", ".tsx"])) {
  const content = readFileSync(srcFile, "utf8");
  for (const forbidden of FORBIDDEN_IMPORTS) {
    if (content.includes(forbidden)) {
      const rel = srcFile.replace(ROOT + "/", "");
      fail(`hiflux-no-admin-import: ${rel} references forbidden path "${forbidden}"`);
    }
  }
}

// ── Check 3: no content-shaped entries inside rules/ ─────────────────────────
console.log("hf:check — 3. No content-shaped entries in rules/");
for (const { file, data } of loadJsonFiles(HIFLUX_RULES_DIR)) {
  for (const rule of data.rules ?? []) {
    const segments = rule.path.split(".");
    const hasContentSignal = segments.some((seg) =>
      CONTENT_PATH_SIGNALS.some((signal) => seg.toLowerCase().includes(signal))
    );
    if (hasContentSignal) {
      fail(
        `hiflux-content-in-rules: "${rule.path}" in rules/${file} looks like content. ` +
        `Move path segments like label/title/message to content/.`
      );
    }
  }
}

// ── Check 4: all hiflux rules and content must start with "hiflux." ──────────
console.log("hf:check — 4. Domain prefix integrity");
for (const { file, data } of [
  ...loadJsonFiles(HIFLUX_RULES_DIR).map((x) => ({ ...x, dir: "rules" })),
  ...loadJsonFiles(HIFLUX_CONTENT_DIR).map((x) => ({ ...x, dir: "content" })),
]) {
  for (const rule of data.rules ?? []) {
    if (!rule.path.startsWith("hiflux.")) {
      fail(`hiflux-domain-match: "${rule.path}" in ${data.dir ?? ""}/${file} must start with "hiflux."`);
    }
  }
}

// ── Check 5: runtime boundary — no browser-facing code imports full core barrel
// packages/react must use @hyperflux/core/client (never the full barrel)
// HiFlux "use client" files must use @hyperflux/core/client (never the full barrel)
console.log("hf:check — 5. Runtime boundary (@hyperflux/core/client only in browser code)");

const REACT_SRC_DIR = join(ROOT, "packages/react/src");
for (const srcFile of walkFiles(REACT_SRC_DIR, [".ts", ".tsx"])) {
  const content = readFileSync(srcFile, "utf8");
  const rel = srcFile.replace(ROOT + "/", "");
  // Any import of "@hyperflux/core" that is NOT "@hyperflux/core/client" or "@hyperflux/core/loader"
  const hasFullBarrel = /from\s+["']@hyperflux\/core["']/.test(content);
  if (hasFullBarrel) {
    fail(`runtime-boundary: ${rel} imports full @hyperflux/core barrel — use @hyperflux/core/client`);
  }
}

for (const srcFile of walkFiles(HIFLUX_SRC_DIR, [".ts", ".tsx"])) {
  const content = readFileSync(srcFile, "utf8");
  if (!content.includes('"use client"') && !content.includes("'use client'")) continue;
  const rel = srcFile.replace(ROOT + "/", "");
  const hasFullBarrel = /from\s+["']@hyperflux\/core["']/.test(content);
  if (hasFullBarrel) {
    fail(`runtime-boundary: ${rel} is a client component and imports full @hyperflux/core barrel — use @hyperflux/core/client`);
  }
}

// ── Check 6: All rule paths referenced in manifest.json must exist in lifecycle/ ─
console.log("hf:check — 6. Lifecycle manifest references valid rule paths");
{
  const manifestPath = join(HIFLUX_LIFECYCLE_DIR, "manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    fail("lifecycle-manifest-missing: apps/admin/hiflux/lifecycle/manifest.json not found");
    manifest = null;
  }

  if (manifest) {
    // Collect all rule paths defined in lifecycle/ JSON files (excluding manifest.json)
    const defined = new Set();
    for (const { data } of loadJsonFiles(HIFLUX_LIFECYCLE_DIR)) {
      for (const rule of data.rules ?? []) {
        defined.add(rule.path);
      }
    }

    for (const [address, config] of Object.entries(manifest.addresses ?? {})) {
      for (const stage of ["before", "after"]) {
        for (const rulePath of config[stage]?.rules ?? []) {
          if (!defined.has(rulePath)) {
            fail(
              `lifecycle-missing-rule: manifest address "${address}" ${stage} references` +
              ` "${rulePath}" which is not defined in lifecycle/*.json`
            );
          }
        }
      }
    }
  }
}

// ── Check 7: All manifest addresses must have during.externalizable === false ─
console.log("hf:check — 7. Protected during stage integrity");
{
  const manifestPath = join(HIFLUX_LIFECYCLE_DIR, "manifest.json");
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const [address, config] of Object.entries(manifest.addresses ?? {})) {
      if (config.during?.externalizable !== false) {
        fail(
          `lifecycle-during-unprotected: address "${address}" has during.externalizable !== false` +
          ` — the during stage must always be protected`
        );
      }
    }
  } catch { /* manifest missing already reported by check 6 */ }
}

// ── Check 8: Lifecycle rules must live in lifecycle/, not rules/ or content/ ──
console.log("hf:check — 8. Lifecycle rules must be in lifecycle/ folder");
for (const { file, data } of [
  ...loadJsonFiles(HIFLUX_RULES_DIR).map((x) => ({ ...x, dir: "rules" })),
  ...loadJsonFiles(HIFLUX_CONTENT_DIR).map((x) => ({ ...x, dir: "content" })),
]) {
  for (const rule of data.rules ?? []) {
    if (rule.path.includes(".lifecycle.")) {
      fail(
        `lifecycle-in-wrong-dir: "${rule.path}" in ${data.dir ?? ""}/${file}` +
        ` must be in lifecycle/ — move it there`
      );
    }
  }
}

// ── Result ────────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\nhf:check FAILED — ${failures} violation(s)\n`);
  process.exit(1);
} else {
  console.log("\nhf:check PASSED — no isolation violations ✓\n");
  process.exit(0);
}
