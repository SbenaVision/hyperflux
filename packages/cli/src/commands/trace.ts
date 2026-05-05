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
  const { formatTrace, traceFromJSON, RequestContext } = await import("@hyperflux/core");
  const { join } = await import("node:path");

  const cliOpts: TraceCliOptions = {
    verbose: Boolean(ctx.options["verbose"]),
    slow: ctx.options["slow"] ? Number(ctx.options["slow"]) : undefined,
    depth: ctx.options["depth"] ? Number(ctx.options["depth"]) : undefined,
  };

  // --input mode: evaluate a rule and show its trace
  const inputRaw = ctx.options["input"] as string | undefined;
  if (inputRaw) {
    const rulePath = ctx.positional[0];
    if (!rulePath) {
      process.stderr.write("  error  usage: hf trace <rulePath> --input '<json>'\n");
      return 1;
    }

    let inputs: Record<string, unknown>;
    try {
      inputs = JSON.parse(inputRaw);
    } catch (err) {
      process.stderr.write(`  error  --input must be valid JSON: ${String(err)}\n`);
      return 1;
    }

    const rulesDir = join(
      ctx.projectRoot,
      (ctx.options["rules-dir"] as string | undefined) ?? "rules"
    );

    const { makeResolver } = await import("../lib/loader");
    let resolver;
    try {
      resolver = await makeResolver(rulesDir);
    } catch (err) {
      process.stderr.write(`  error  failed to load rules: ${String(err)}\n`);
      return 1;
    }

    const reqCtx = new RequestContext({ recordTrace: true });
    try {
      resolver.evaluate(rulePath, inputs, reqCtx);
    } catch (err) {
      process.stderr.write(`  error  evaluation failed: ${String(err)}\n`);
      return 1;
    }

    const tree = reqCtx.getTrace();
    if (tree) process.stdout.write(formatTrace(tree, buildFormatOptions(cliOpts)));
    return 0;
  }

  // file mode: render a saved trace JSON file
  const file = ctx.positional[0];
  if (!file) {
    process.stderr.write("  error  usage: hf trace <file.json>  or  hf trace <rulePath> --input '<json>'\n");
    return 1;
  }

  let json: string;
  try {
    const { readFile } = await import("node:fs/promises");
    json = await readFile(file, "utf8");
  } catch {
    process.stderr.write(`  error  could not read file: ${file}\n`);
    return 1;
  }

  try {
    const tree = traceFromJSON(json);
    process.stdout.write(formatTrace(tree, buildFormatOptions(cliOpts)));
    return 0;
  } catch (err) {
    process.stderr.write(`  error  invalid trace file: ${String(err)}\n`);
    return 1;
  }
};

export function buildFormatOptions(options: TraceCliOptions): TraceFormatOptions {
  const fmt: TraceFormatOptions = {};
  if (options.verbose) fmt.verbose = true;
  if (options.slow && options.slow > 0) fmt.slowThresholdMs = options.slow;
  if (options.depth && options.depth > 0) fmt.depth = options.depth;
  if (options.grep) fmt.grep = options.grep;
  return fmt;
}
