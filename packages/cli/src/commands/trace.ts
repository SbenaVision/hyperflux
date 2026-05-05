/**
 * @file `hf trace` (`hf-trace`) — renders a saved rule evaluation trace.
 *
 * Reads a trace JSON file previously produced by `traceToJSON()`, applies
 * optional filters (grep, slow threshold, depth), and prints a human-readable
 * tree to stdout.
 *
 * Usage: `hf trace [file] [--grep <pattern>] [--slow <ms>] [--depth <n>] [--verbose]`
 *
 * @module @hyperflux/cli/commands/trace
 * @since 0.1.0
 */

import type { CliContext, CommandRunner } from "../types";
import type { TraceFormatOptions } from "@hyperflux/core";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options parsed from the `hf trace` CLI invocation.
 *
 * @since 0.1.0
 * @public
 */
export interface TraceCliOptions {
  /**
   * Path to the trace JSON file to read.
   * If omitted, reads from stdin (allows `| hf trace`).
   */
  file?: string;

  /**
   * Only show nodes whose `path` matches this pattern.
   * Forwarded to `TraceFormatOptions.grep`.
   */
  grep?: string;

  /**
   * Highlight nodes slower than this many milliseconds.
   * Forwarded to `TraceFormatOptions.slowThresholdMs`.
   */
  slow?: number;

  /**
   * Maximum tree depth to render.
   * Forwarded to `TraceFormatOptions.depth`.
   */
  depth?: number;

  /**
   * When `true`, include full input and output values for each node.
   * Forwarded to `TraceFormatOptions.verbose`.
   * @defaultValue `false`
   */
  verbose: boolean;
}

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

/**
 * Implements the `hf trace` command.
 *
 * Reads the trace file (or stdin), deserializes it with `traceFromJSON()`,
 * applies the filter options, and prints the result of `formatTrace()` to
 * stdout. The default option values (depth, slow threshold, etc.) are loaded
 * from `defaults/cli-commands.json`, not hardcoded here.
 *
 * @param ctx - The CLI context for this invocation.
 * @returns A promise resolving to the exit code: `0` on success, `1` on failure.
 * @throws {SyntaxError} If the trace file is not valid JSON.
 * @throws {Error} If the trace JSON does not conform to the expected trace schema.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```bash
 * # Save a trace from your app, then inspect it:
 * hf trace ./traces/request-1.json --verbose --slow 2
 * hf trace ./traces/request-1.json --grep "pricing" --depth 3
 * # Or pipe:
 * cat ./traces/request-1.json | hf trace --slow 1
 * ```
 *
 * @see {@link TraceCliOptions}
 * @see {@link TraceFormatOptions}
 */
export const run: CommandRunner = async function runTrace(
  ctx: CliContext
): Promise<number> {
  throw new Error("Not implemented");
};

/**
 * Builds a `TraceFormatOptions` object from the parsed `TraceCliOptions`.
 *
 * Exists as a separate function to allow unit testing of option mapping
 * without running the full CLI invocation.
 *
 * @param options - Parsed CLI options from `hf trace`.
 * @returns A `TraceFormatOptions` object suitable for `formatTrace()`.
 * @since 0.1.0
 * @public
 *
 * @see {@link TraceFormatOptions}
 */
export function buildFormatOptions(options: TraceCliOptions): TraceFormatOptions {
  throw new Error("Not implemented");
}
