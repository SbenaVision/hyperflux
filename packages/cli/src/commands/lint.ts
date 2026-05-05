/**
 * @file `hf lint` — runs HyperFlux discipline enforcement analysis.
 *
 * Loads lint rule definitions from `defaults/lint-rules.json`, merges
 * project overrides from `.hyperfluxrc.json`, and runs the `Analyzer` against
 * all matched source and rule files. Exits non-zero if any errors are found.
 * With `--fix`, applies all unambiguous fixes via `FixEngine` before reporting.
 *
 * @module @hyperflux/cli/commands/lint
 * @since 0.1.0
 */

import type { CliContext, CommandRunner } from "../types";
import type { LintResult } from "@hyperflux/lint";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options parsed from the `hf lint` CLI invocation.
 *
 * @since 0.1.0
 * @public
 */
export interface LintCliOptions {
  /**
   * When `true`, applies unambiguous fixes automatically before reporting.
   * Corresponds to the `--fix` flag.
   * @defaultValue `false`
   */
  fix: boolean;

  /**
   * When `true`, lists what fixes would be applied without writing any files.
   * Corresponds to `--dry-run`.
   * @defaultValue `false`
   */
  dryRun: boolean;

  /**
   * Output format for diagnostic messages.
   * `"text"` — default human-readable format (as shown in spec §9.3).
   * `"json"` — machine-readable JSON array of `LintDiagnostic` objects.
   * @defaultValue `"text"`
   */
  format: "text" | "json";
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Structured result returned by `runLint`.
 *
 * @since 0.1.0
 * @public
 */
export interface LintCliResult {
  /** `0` if no errors; `1` if any error-severity diagnostics were found. */
  exitCode: 0 | 1;

  /** The raw lint result from the analyzer. */
  lintResult: LintResult;

  /** Number of files that were automatically fixed (when `fix: true`). */
  fixedFileCount: number;

  /** Wall-clock milliseconds for the full lint run. */
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

/**
 * Implements the `hf lint` command.
 *
 * 1. Loads lint rule definitions from `defaults/lint-rules.json`.
 * 2. Merges project overrides from `.hyperfluxrc.json`.
 * 3. Loads the rule store (for rules-scope checks).
 * 4. Reads all source files matching `config.src_globs`.
 * 5. Runs `Analyzer.analyze()`.
 * 6. If `--fix`: runs `FixEngine.computeFixes()` and `FixEngine.applyFixes()`.
 * 7. Formats and prints output per `--format`.
 * 8. Returns exit code `0` if no errors, `1` otherwise.
 *
 * @param ctx - The CLI context for this invocation.
 * @returns A promise resolving to the exit code: `0` if clean, `1` if errors found.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```bash
 * hf lint             # check only
 * hf lint --fix       # check and fix
 * hf lint --format json | jq '.[] | select(.severity == "error")'
 * ```
 *
 * @see {@link LintCliOptions}
 * @see {@link LintCliResult}
 */
export const run: CommandRunner = async function runLint(
  _ctx: CliContext
): Promise<number> {
  process.stderr.write("\n  hf lint — not yet implemented (coming in next session)\n\n");
  return 1;
};
