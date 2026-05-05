/**
 * @file Fix engine — computes and applies automated lint fixes.
 *
 * The `FixEngine` takes the output of `Analyzer.analyze()` and produces
 * `LintFix` objects for every `fixable` diagnostic. Only unambiguous fixes
 * are produced; ambiguous cases surface a hint via the diagnostic's
 * `suggestion` field instead.
 *
 * Current fixable rules in v0.1:
 * - `no-hardcoded-copy` — extracts string literals to `copy.<domain>.<key>` rules.
 * - `no-magic-numbers` — extracts numeric literals to `config.<domain>.<key>` rules.
 *
 * @module @hyperflux/lint/fix-engine
 * @since 0.1.0
 */

import type { LintDiagnostic, LintFix, LintResult } from "./types";
import type { RuleStore } from "@hyperflux/core";

// ---------------------------------------------------------------------------
// FixEngineOptions
// ---------------------------------------------------------------------------

/**
 * Configuration for constructing a {@link FixEngine}.
 *
 * @since 0.1.0
 * @public
 */
export interface FixEngineOptions {
  /**
   * The rule store used to check for path collisions when generating
   * new rule paths for extracted constants. The engine will not produce
   * a fix that would create a duplicate rule path.
   */
  ruleStore: RuleStore;
}

// ---------------------------------------------------------------------------
// FixPlan
// ---------------------------------------------------------------------------

/**
 * A structured description of what a fix will do, separate from the `apply`
 * function. Useful for displaying a preview of fixes before applying them.
 *
 * @since 0.1.0
 * @public
 */
export interface FixPlan {
  /** The diagnostic being fixed. */
  diagnostic: LintDiagnostic;

  /** Human-readable summary of the change that will be made. */
  summary: string;

  /**
   * For `no-hardcoded-copy` and `no-magic-numbers` fixes: the new rule path
   * that will be created in the domain file.
   */
  newRulePath?: string;

  /**
   * For `no-hardcoded-copy` and `no-magic-numbers` fixes: the domain file
   * (relative path) that the new rule will be added to.
   */
  targetDomainFile?: string;
}

// ---------------------------------------------------------------------------
// FixEngine
// ---------------------------------------------------------------------------

/**
 * Computes automated fixes for fixable `LintDiagnostic` entries and applies
 * them to source text.
 *
 * The engine applies fixes atomically per file: all fixes for a single file
 * are applied together in a single pass, avoiding conflicting edit positions.
 * Fixes for different files are independent.
 *
 * When a fix requires creating a new rule (e.g., extracting a string literal),
 * the engine also returns a modified domain file source alongside the modified
 * TypeScript source.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const engine = new FixEngine({ ruleStore });
 * const fixes = engine.computeFixes(lintResult, sources);
 * const updated = engine.applyFixes(fixes, sources);
 * for (const [file, newSource] of Object.entries(updated)) {
 *   fs.writeFileSync(file, newSource);
 * }
 * ```
 *
 * @see {@link FixEngineOptions}
 * @see {@link LintFix}
 */
export class FixEngine {
  /**
   * Constructs a new `FixEngine`.
   *
   * @param options - Engine configuration including the rule store.
   * @since 0.1.0
   */
  constructor(options: FixEngineOptions) {
    throw new Error("Not implemented");
  }

  /**
   * Computes `LintFix` objects for every `fixable` diagnostic in `result`.
   *
   * Diagnostics where `fixable === false` are skipped — the caller should
   * surface their `suggestion` text to the user instead.
   *
   * @param result - The lint result from `Analyzer.analyze()`.
   * @param sources - Record mapping file paths to their current source text.
   * @returns An ordered array of fixes. The order matches the diagnostic order
   *   in `result.diagnostics`.
   * @since 0.1.0
   * @public
   *
   * @example
   * ```ts
   * const fixes = engine.computeFixes(lintResult, sources);
   * console.log(`${fixes.length} of ${lintResult.fixableCount} fixes available`);
   * ```
   */
  computeFixes(
    result: LintResult,
    sources: Record<string, string>
  ): ReadonlyArray<LintFix> {
    throw new Error("Not implemented");
  }

  /**
   * Applies a set of fixes to the source map and returns the updated source map.
   *
   * Fixes for the same file are applied in document order (highest line number
   * last) to preserve character offsets during sequential edits. The original
   * `sources` map is not mutated; a new record is returned.
   *
   * @param fixes - The fixes to apply, as returned by `computeFixes`.
   * @param sources - Record mapping file paths to their current source text.
   * @returns A new record with the updated source text for all affected files.
   *   Unaffected files are not included.
   * @since 0.1.0
   * @public
   *
   * @example
   * ```ts
   * const updated = engine.applyFixes(fixes, sources);
   * for (const [path, newSrc] of Object.entries(updated)) {
   *   await fs.writeFile(path, newSrc, "utf8");
   * }
   * ```
   */
  applyFixes(
    fixes: ReadonlyArray<LintFix>,
    sources: Record<string, string>
  ): Record<string, string> {
    throw new Error("Not implemented");
  }

  /**
   * Returns structured `FixPlan` descriptions for each fixable diagnostic
   * without actually producing `apply` functions. Useful for `--dry-run`
   * and preview display.
   *
   * @param result - The lint result to plan fixes for.
   * @param sources - Record mapping file paths to their current source text.
   * @returns Ordered array of fix plans corresponding to fixable diagnostics.
   * @since 0.1.0
   * @public
   *
   * @example
   * ```ts
   * const plans = engine.planFixes(result, sources);
   * for (const plan of plans) {
   *   console.log(plan.summary);
   *   if (plan.newRulePath) console.log("  → creates rule:", plan.newRulePath);
   * }
   * ```
   */
  planFixes(
    result: LintResult,
    sources: Record<string, string>
  ): ReadonlyArray<FixPlan> {
    throw new Error("Not implemented");
  }
}
