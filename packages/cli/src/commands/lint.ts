/**
 * @file `hf lint` — runs HyperFlux discipline enforcement analysis.
 * @module @hyperflux/cli/commands/lint
 * @since 0.1.0
 */

import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { CliContext, CommandRunner } from "../types";
import type { LintResult } from "@hyperflux/lint";

export interface LintCliOptions {
  fix: boolean;
  dryRun: boolean;
  format: "text" | "json";
}

export interface LintCliResult {
  exitCode: 0 | 1;
  lintResult: LintResult;
  fixedFileCount: number;
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatText(result: LintResult, fixedCount: number, elapsedMs: number): string {
  const lines: string[] = [];

  for (const d of result.diagnostics) {
    if (d.severity === "off") continue;
    const icon = d.severity === "error" ? "  error" : "   warn";
    const fix = d.fixable ? " [fixable]" : "";
    lines.push(`${icon}  ${d.file}:${d.line}:${d.column}  ${d.ruleId}${fix}`);
    lines.push(`         ${d.message}`);
    if (d.suggestion) lines.push(`         hint: ${d.suggestion}`);
  }

  if (lines.length > 0) lines.push("");

  const summary: string[] = [];
  if (result.errorCount > 0) summary.push(`${result.errorCount} error${result.errorCount !== 1 ? "s" : ""}`);
  if (result.warnCount > 0) summary.push(`${result.warnCount} warning${result.warnCount !== 1 ? "s" : ""}`);
  if (result.fixableCount > 0) summary.push(`${result.fixableCount} fixable (run hf lint --fix)`);

  if (summary.length === 0) {
    lines.push(`  ✓  no issues found  (${elapsedMs}ms)`);
  } else {
    lines.push(`  ${summary.join(", ")}  (${elapsedMs}ms)`);
    if (fixedCount > 0) lines.push(`  ${fixedCount} file${fixedCount !== 1 ? "s" : ""} fixed`);
  }

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Glob helper — walks directory tree matching patterns
// ---------------------------------------------------------------------------

async function globFiles(patterns: string[], ignorePatterns: string[], cwd: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      const rel = abs.slice(cwd.length + 1).replace(/\\/g, "/");
      const isIgnored = ignorePatterns.some((p) => rel.includes(p) || abs.includes(p));
      if (isIgnored) continue;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".git") {
          await walk(abs);
        }
      } else if (entry.isFile()) {
        const matches = patterns.some((pattern) => {
          if (pattern.includes("*.ts") && !pattern.includes("*.tsx")) return abs.endsWith(".ts") && !abs.endsWith(".d.ts");
          if (pattern.includes("*.tsx")) return abs.endsWith(".tsx");
          if (pattern.includes("*.json")) return abs.endsWith(".json");
          return false;
        });
        if (matches) results.push(abs);
      }
    }
  }

  const baseDirs = new Set<string>();
  for (const pattern of patterns) {
    const slashIdx = pattern.indexOf("/**");
    const base = slashIdx >= 0 ? pattern.slice(0, slashIdx) : ".";
    baseDirs.add(join(cwd, base));
  }
  for (const baseDir of baseDirs) {
    await walk(baseDir);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

export const run: CommandRunner = async function runLint(
  ctx: CliContext
): Promise<number> {
  const t0 = Date.now();

  const fix = Boolean(ctx.options["fix"]);
  const dryRun = Boolean(ctx.options["dry-run"]);
  const formatOpt = (ctx.options["format"] as string | undefined) ?? "text";
  const format: "text" | "json" = formatOpt === "json" ? "json" : "text";

  const rulesDir = join(
    ctx.projectRoot,
    (ctx.options["rules-dir"] as string | undefined) ?? "rules"
  );

  // Load lint rule definitions from defaults
  const { readFileSync } = await import("node:fs");
  const defaultsDir = join(__dirname, "..", "..", "..", "..", "defaults");
  let lintRuleDefs: unknown[];
  let defaultLintCfg: { src_globs: string[]; rule_globs: string[]; ignore: string[] };
  try {
    const raw = JSON.parse(readFileSync(join(defaultsDir, "lint-rules.json"), "utf8"));
    lintRuleDefs = raw.rules;
    defaultLintCfg = raw.defaults;
  } catch (err) {
    process.stderr.write(`  error  could not load lint-rules.json: ${String(err)}\n`);
    return 1;
  }

  // Merge project overrides from .hyperfluxrc.json
  let projectOverrides: Record<string, string> = {};
  if (ctx.configPath) {
    try {
      const rc = JSON.parse(readFileSync(ctx.configPath, "utf8"));
      if (rc.lint?.overrides) projectOverrides = rc.lint.overrides;
    } catch { /* ignore */ }
  }

  const { Analyzer, FixEngine } = await import("@hyperflux/lint");
  const { makeLoaderResult } = await import("../lib/loader");

  // Build rule store (used for rules-scope checks)
  let ruleStore: import("@hyperflux/core").RuleStore;
  let domainFiles: ReadonlyArray<import("@hyperflux/core").DomainFile> = [];
  try {
    const loaded = await makeLoaderResult(rulesDir);
    ruleStore = loaded.ruleStore;
    domainFiles = loaded.domainFiles;
  } catch {
    const { RuleStoreImpl, DependencyGraphImpl } = await import("@hyperflux/core");
    ruleStore = new RuleStoreImpl([], [], new DependencyGraphImpl(new Map(), []));
  }

  const lintConfig = {
    src_globs: defaultLintCfg.src_globs,
    rule_globs: defaultLintCfg.rule_globs,
    ignore: defaultLintCfg.ignore,
    overrides: projectOverrides as Record<string, import("@hyperflux/lint").LintSeverity | "off">,
  };

  const analyzer = new Analyzer({
    lintRuleDefinitions: lintRuleDefs as import("@hyperflux/lint").LintRuleDefinition[],
    config: lintConfig,
    ruleStore,
  });

  // Collect and read source files
  const srcFiles = await globFiles(lintConfig.src_globs, lintConfig.ignore, ctx.projectRoot);
  const sources: Record<string, string> = {};
  for (const file of srcFiles) {
    try { sources[file] = await readFile(file, "utf8"); } catch { /* skip */ }
  }

  // Run analysis
  const result = await analyzer.analyze(sources, domainFiles);

  // Apply fixes
  let fixedFileCount = 0;
  if ((fix || dryRun) && result.fixableCount > 0) {
    const engine = new FixEngine({ ruleStore });
    if (dryRun) {
      const plans = engine.planFixes(result, sources);
      process.stdout.write(`  ${plans.length} fix${plans.length !== 1 ? "es" : ""} available:\n`);
      for (const plan of plans) {
        process.stdout.write(`    ${plan.diagnostic.file}:${plan.diagnostic.line}  ${plan.summary}\n`);
      }
    } else {
      const fixes = engine.computeFixes(result, sources);
      const updated = engine.applyFixes(fixes, sources);
      for (const [file, newSrc] of Object.entries(updated)) {
        await writeFile(file, newSrc, "utf8");
        fixedFileCount++;
      }
    }
  }

  const elapsedMs = Date.now() - t0;

  if (format === "json") {
    process.stdout.write(JSON.stringify(result.diagnostics, null, 2) + "\n");
  } else {
    process.stdout.write(formatText(result, fixedFileCount, elapsedMs));
  }

  return result.errorCount > 0 ? 1 : 0;
};
