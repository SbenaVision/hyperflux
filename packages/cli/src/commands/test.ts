/**
 * @file `hf test` — runs snapshot tests for HyperFlux rules.
 *
 * Discovers and runs Vitest snapshot tests in `tests/rules/`. A snapshot test
 * exercises a rule with a set of inputs and compares the output to a stored
 * snapshot. On failure, the test runner prints a diff and exits non-zero.
 * On the first run (or after `--update`), the snapshot is written to disk.
 *
 * @module @hyperflux/cli/commands/test
 * @since 0.1.0
 */

import type { CliContext, CommandRunner } from "../types";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Structured result returned by `runTest`.
 *
 * @since 0.1.0
 * @public
 */
export interface TestResult {
  /** `0` if all tests passed; `1` if any failed. */
  exitCode: 0 | 1;

  /** Total number of snapshot test files discovered. */
  filesFound: number;

  /** Number of test cases that passed. */
  passed: number;

  /** Number of test cases that failed. */
  failed: number;

  /** Number of snapshot files written or updated. */
  snapshotsWritten: number;
}

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

/**
 * Implements the `hf test` command.
 *
 * Delegates to Vitest to run all snapshot tests under `tests/rules/`. The
 * `--update` flag is forwarded to Vitest as `--update-snapshots`.
 *
 * @param ctx - The CLI context for this invocation.
 * @returns A promise resolving to the exit code: `0` for all tests passing, `1` for failures.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const exitCode = await run(ctx); // runs: vitest run tests/rules/
 * process.exit(exitCode);
 * ```
 *
 * @see {@link TestResult}
 */
export const run: CommandRunner = async function runTest(
  ctx: CliContext
): Promise<number> {
  const { spawn } = await import("node:child_process");
  const watch = Boolean(ctx.options["watch"]);
  const args = ["vitest", watch ? "watch" : "run", "tests/rules/"];
  return new Promise((resolve) => {
    const child = spawn("npx", args, {
      cwd: ctx.projectRoot,
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => resolve((code ?? 1) === 0 ? 0 : 1));
  });
};
