#!/usr/bin/env node
/**
 * hf:data-validate — HyperFlux rule data integrity gate
 *
 * Treats externalized rule data like code: every file is validated before it can
 * affect production behavior.
 *
 * Checks:
 *   1. Every rule schema has all required fields and valid types
 *   2. Every array output declares an items type
 *   3. Every operator used in a rule exists in the operator registry
 *   4. Every rule path referenced (metadata.requires, kind:rule expressions) exists
 *   5. Every lifecycle manifest entry is structurally valid
 *   6. Every JSON file in content/ rules/ lifecycle/ is imported in init-store.ts
 *
 * Check 7 (boot smoke test) lives in src/lib/__tests__/smoke.test.ts —
 * it runs as part of vitest and evaluates all no-input rules end-to-end.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, relative } from "node:path";

const ROOT            = process.cwd();
const HIFLUX_DIR      = join(ROOT, "apps/admin/hiflux");
const CONTENT_DIR     = join(HIFLUX_DIR, "content");
const RULES_DIR       = join(HIFLUX_DIR, "rules");
const LIFECYCLE_DIR   = join(HIFLUX_DIR, "lifecycle");
const INIT_STORE_PATH = join(HIFLUX_DIR, "src/lib/init-store.ts");
const SRC_DIR         = join(HIFLUX_DIR, "src");

// ── Operator registry (must match server-resolver.ts exactly) ────────────────
const KNOWN_OPERATORS = new Set([
  ">", ">=", "<", "<=", "==", "!=",
  "AND", "OR", "NOT",
  "+", "-",
  "startsWith", "endsWith", "includes", "length", "concat",
]);

// ── Valid schema values ───────────────────────────────────────────────────────
const VALID_OUTPUT_TYPES = new Set([
  "string", "number", "boolean", "null", "object", "array", "any",
]);
const VALID_RULE_KINDS = new Set(["compute"]);

// ── State ────────────────────────────────────────────────────────────────────
let failures = 0;
const allRulePaths = new Set();

function fail(check, location, msg) {
  console.error(`  ✗ [${check}] ${location}: ${msg}`);
  failures++;
}

function pass(label) {
  console.log(`hf:data — ${label}`);
}

// ── File loader ───────────────────────────────────────────────────────────────
function loadJsonDir(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const full = join(dir, f);
        try {
          return { file: basename(f), path: full, data: JSON.parse(readFileSync(full, "utf8")) };
        } catch (e) {
          fail("check-1", basename(f), `JSON parse error: ${e.message}`);
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ── Expression walker ─────────────────────────────────────────────────────────
// Yields { type, ...fields } for every operator reference and rule reference found
function* walkExpr(expr) {
  if (!expr || typeof expr !== "object") return;
  if (Array.isArray(expr)) {
    for (const item of expr) yield* walkExpr(item);
    return;
  }
  const kind = expr.kind;
  if (kind === "op") {
    yield { type: "op", op: expr.op };
    for (const arg of expr.args ?? []) yield* walkExpr(arg);
  } else if (kind === "rule") {
    yield { type: "rule-ref", path: expr.path };
    for (const arg of expr.args ?? []) yield* walkExpr(arg);
  } else if (kind === "construct") {
    for (const v of Object.values(expr.fields ?? {})) yield* walkExpr(v);
  } else if (kind === "merge") {
    yield* walkExpr(expr.base);
    yield* walkExpr(expr.patch);
  } else if (kind === "map") {
    yield* walkExpr(expr.source);
    yield* walkExpr(expr.item);
  } else if (kind === "fn") {
    for (const v of Object.values(expr.args ?? {})) yield* walkExpr(v);
  }
  // literal, input: leaf nodes — no sub-expressions
}

function walkRuleExprs(rule) {
  const results = [];
  for (const c of rule.cases ?? []) {
    if (c.when) results.push(...walkExpr(c.when));
    if (c.then) results.push(...walkExpr(c.then));
  }
  return results;
}

// ── Phase 1: Collect all rule paths (needed before cross-reference checks) ───
console.log("\nhf:data-validate\n");

const allFiles = [
  ...loadJsonDir(CONTENT_DIR).map((f) => ({ ...f, dir: "content" })),
  ...loadJsonDir(RULES_DIR).map((f) => ({ ...f, dir: "rules" })),
  ...loadJsonDir(LIFECYCLE_DIR).filter((f) => f.file !== "manifest.json").map((f) => ({ ...f, dir: "lifecycle" })),
];

for (const { data } of allFiles) {
  for (const rule of data.rules ?? []) {
    if (rule.path) allRulePaths.add(rule.path);
  }
}

// ── Check 1: Rule schema validity ─────────────────────────────────────────────
pass("1. Rule schema validity");

for (const { file, data, dir } of allFiles) {
  const loc = `${dir}/${file}`;

  // Domain file must have domain, version, rules
  if (!data.domain) fail("check-1", loc, "missing domain field");
  if (!data.version) fail("check-1", loc, "missing version field");
  if (!Array.isArray(data.rules)) { fail("check-1", loc, "rules must be an array"); continue; }

  for (const rule of data.rules) {
    const rp = rule.path ?? "(no path)";
    const rl = `${loc}#${rp}`;

    if (typeof rule.path !== "string" || !rule.path) fail("check-1", rl, "path must be a non-empty string");
    if (!VALID_RULE_KINDS.has(rule.kind))            fail("check-1", rl, `kind "${rule.kind}" is not valid — expected: ${[...VALID_RULE_KINDS].join(", ")}`);
    if (!Array.isArray(rule.inputs))                  fail("check-1", rl, "inputs must be an array");
    if (!rule.output || typeof rule.output !== "object") fail("check-1", rl, "output must be an object");
    else if (!VALID_OUTPUT_TYPES.has(rule.output.type)) fail("check-1", rl, `output.type "${rule.output.type}" is not valid — expected: ${[...VALID_OUTPUT_TYPES].join(", ")}`);
    if (!Array.isArray(rule.cases) || rule.cases.length === 0) fail("check-1", rl, "cases must be a non-empty array");
    if (!rule.metadata || typeof rule.metadata !== "object") fail("check-1", rl, "metadata must be an object");
    else {
      if (!Array.isArray(rule.metadata.requires)) fail("check-1", rl, "metadata.requires must be an array");
      if (!rule.metadata.domain)                  fail("check-1", rl, "metadata.domain must be set");
    }

    // Each case must have a then field
    for (let i = 0; i < (rule.cases ?? []).length; i++) {
      const c = rule.cases[i];
      if (!c.then) fail("check-1", rl, `cases[${i}] is missing required "then" field`);
    }

    // Each input must have name and type
    for (let i = 0; i < (rule.inputs ?? []).length; i++) {
      const inp = rule.inputs[i];
      if (!inp.name) fail("check-1", rl, `inputs[${i}] missing "name"`);
      if (!inp.type || !inp.type.type) fail("check-1", rl, `inputs[${i}] missing "type.type"`);
    }
  }
}

// ── Check 2: Array outputs declare items ─────────────────────────────────────
pass("2. Array output items declarations");

for (const { file, data, dir } of allFiles) {
  for (const rule of data.rules ?? []) {
    if (rule.output?.type === "array") {
      if (!rule.output.items || !rule.output.items.type) {
        fail("check-2", `${dir}/${file}#${rule.path}`,
          `output type is "array" but items.type is missing — add "items": {"type": "string"} (or the appropriate item type)`);
      }
    }
  }
}

// ── Check 3: All operators exist in registry ──────────────────────────────────
pass("3. Operator registry references");

for (const { file, data, dir } of allFiles) {
  for (const rule of data.rules ?? []) {
    for (const ref of walkRuleExprs(rule)) {
      if (ref.type === "op" && !KNOWN_OPERATORS.has(ref.op)) {
        fail("check-3", `${dir}/${file}#${rule.path}`,
          `operator "${ref.op}" is not in the registry — known: ${[...KNOWN_OPERATORS].join(", ")}`);
      }
    }
  }
}

// ── Check 4: All referenced rule paths exist ──────────────────────────────────
pass("4. Cross-rule reference integrity");

for (const { file, data, dir } of allFiles) {
  for (const rule of data.rules ?? []) {
    // metadata.requires
    for (const dep of rule.metadata?.requires ?? []) {
      if (!allRulePaths.has(dep)) {
        fail("check-4", `${dir}/${file}#${rule.path}`,
          `metadata.requires references "${dep}" which does not exist in any loaded file`);
      }
    }
    // kind:rule expression references
    for (const ref of walkRuleExprs(rule)) {
      if (ref.type === "rule-ref" && !allRulePaths.has(ref.path)) {
        fail("check-4", `${dir}/${file}#${rule.path}`,
          `expression references rule "${ref.path}" which does not exist in any loaded file`);
      }
    }
  }
}

// ── Check 5: Lifecycle manifest structural validity ───────────────────────────
pass("5. Lifecycle manifest structure");

const manifestPath = join(LIFECYCLE_DIR, "manifest.json");
if (!existsSync(manifestPath)) {
  fail("check-5", "lifecycle/manifest.json", "file not found");
} else {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    fail("check-5", "lifecycle/manifest.json", `JSON parse error: ${e.message}`);
    manifest = null;
  }

  if (manifest) {
    if (!manifest.namespace) fail("check-5", "manifest.json", "missing namespace field");
    if (!manifest.version)   fail("check-5", "manifest.json", "missing version field");
    if (!manifest.addresses || typeof manifest.addresses !== "object") {
      fail("check-5", "manifest.json", "addresses must be an object");
    } else {
      for (const [addr, entry] of Object.entries(manifest.addresses)) {
        const loc = `manifest.json#${addr}`;

        for (const stage of ["before", "during", "after"]) {
          const s = entry[stage];
          if (!s) { fail("check-5", loc, `missing stage "${stage}"`); continue; }
          if (typeof s.externalizable !== "boolean") {
            fail("check-5", loc, `${stage}.externalizable must be a boolean`);
          }
          if (!Array.isArray(s.rules)) {
            fail("check-5", loc, `${stage}.rules must be an array`);
          } else {
            for (const rulePath of s.rules) {
              if (!allRulePaths.has(rulePath)) {
                fail("check-5", loc,
                  `${stage}.rules references "${rulePath}" which does not exist in any lifecycle/*.json file`);
              }
            }
          }
        }
      }
    }
  }
}

// ── Check 6: All data files are imported in init-store.ts ────────────────────
pass("6. All data files imported in init-store.ts");

if (!existsSync(INIT_STORE_PATH)) {
  fail("check-6", "src/lib/init-store.ts", "file not found");
} else {
  const initSrc = readFileSync(INIT_STORE_PATH, "utf8");

  // Extract every ../../(content|rules|lifecycle)/*.json import from init-store.ts
  const importRE = /from\s+["']\.\.\/\.\.\/(content|rules|lifecycle)\/([^"']+\.json)["']/g;
  const loadedFiles = new Map(); // "content/ui.json" -> true
  let m;
  while ((m = importRE.exec(initSrc)) !== null) {
    loadedFiles.set(`${m[1]}/${m[2]}`, true);
  }

  // Check every actual file in the three directories
  for (const [subDir, dir] of [["content", CONTENT_DIR], ["rules", RULES_DIR], ["lifecycle", LIFECYCLE_DIR]]) {
    let files;
    try { files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "manifest.json"); } catch { files = []; }
    for (const f of files) {
      const key = `${subDir}/${f}`;
      if (!loadedFiles.has(key)) {
        fail("check-6", `src/lib/init-store.ts`,
          `${key} exists on disk but is NOT imported — add: import ... from "../../${key}"`);
      }
    }
  }
}

// ── Check 7: Every hook call in source resolves to a loaded rule path ─────────
pass("7. Source hook references resolve to known rule paths");

// Hook patterns that take a rule path as their first string argument
// Regexes must handle optional TypeScript generics: useRule<string>("path")
const HOOK_PATTERNS = [
  { re: /(?:useRule|useContent|useRuleStream)(?:<[^>]+>)?\(\s*["']([^"']+)["']/g, label: "useRule/useContent" },
  { re: /readConfigString\(\s*["']([^"']+)["']/g,                                  label: "readConfigString"  },
  { re: /readConfigArray(?:<[^>]+>)?\(\s*["']([^"']+)["']/g,                       label: "readConfigArray"   },
  { re: /resolver\.evaluate\(\s*["']([^"']+)["']/g,                                label: "resolver.evaluate" },
  { re: /engine\.run\(\s*["']([^"']+)["']/g,                                       label: "engine.run"        },
];

function* walkTsFiles(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && e.name !== "__tests__") {
      yield* walkTsFiles(full);
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      yield full;
    }
  }
}

let srcFilesScanned = 0;
for (const filePath of walkTsFiles(SRC_DIR)) {
  let src;
  try { src = readFileSync(filePath, "utf8"); } catch { continue; }
  srcFilesScanned++;
  const rel = relative(ROOT, filePath);

  for (const { re, label } of HOOK_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const rulePath = m[1];
      if (!allRulePaths.has(rulePath)) {
        fail("check-7", rel,
          `${label}("${rulePath}") — path does not exist in any loaded rule file`);
      }
    }
  }
}

// ── Result ────────────────────────────────────────────────────────────────────
console.log(`\nRules indexed: ${allRulePaths.size}`);
console.log(`Data files scanned: ${allFiles.length + 1}`);  // +1 for manifest
console.log(`Source files scanned: ${srcFilesScanned}`);

if (failures > 0) {
  console.error(`\nhf:data-validate FAILED — ${failures} violation(s)\n`);
  process.exit(1);
} else {
  console.log(`\nhf:data-validate PASSED ✓\n`);
  process.exit(0);
}
