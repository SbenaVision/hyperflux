/**
 * @file `hf validate` — validates all rule files and exits 0 on success.
 *
 * Loads and fully validates the rule store (schema, domain match, path match,
 * cycle detection, shallow type check). Prints all errors to stderr and exits
 * non-zero if any are found. Exits 0 with a summary line if all rules are valid.
 *
 * @module @hyperflux/cli/commands/validate
 * @since 0.1.0
 */

import type { CliContext, CommandRunner } from "../types";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Structured result returned by `runValidate`.
 *
 * Callers can inspect this rather than relying on side-effects; `hf validate`
 * itself uses `exitCode` to set `process.exitCode`.
 *
 * @since 0.1.0
 * @public
 */
export interface ValidateResult {
  /** `0` if all rules are valid; `1` if any errors were found. */
  exitCode: 0 | 1;

  /** Number of rule files scanned. */
  filesScanned: number;

  /** Total number of rules validated. */
  rulesValidated: number;

  /** All errors found during validation, if any. */
  errors: ReadonlyArray<import("@hyperflux/core").HyperFluxError>;

  /** Non-fatal warnings, e.g. empty domain files. */
  warnings: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

/**
 * Implements the `hf validate` command.
 *
 * Discovers the rules directory from `ctx.projectRoot`, constructs a
 * `RuleLoader`, runs `loader.load()`, and reports results to stdout/stderr.
 * All error messages are read from `defaults/errors.json` via the loader;
 * none are hardcoded here.
 *
 * @param ctx - The CLI context for this invocation.
 * @returns A promise resolving to the exit code: `0` for success, `1` for failure.
 * @throws {Error} If the project root or rules directory cannot be determined.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * // In the CLI dispatcher:
 * const exitCode = await run(ctx);
 * process.exit(exitCode);
 * ```
 *
 * @see {@link ValidateResult}
 */
export const run: CommandRunner = async function runValidate(
  ctx: CliContext
): Promise<number> {
  throw new Error("Not implemented");
};
