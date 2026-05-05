/**
 * @file `hf eval` — evaluate a rule against JSON inputs and print the result.
 * @module @hyperflux/cli/commands/eval
 * @since 0.1.0
 */

import { join } from "node:path";
import { RequestContext, formatTrace } from "@hyperflux/core";
import { makeResolver } from "../lib/loader";
import type { CliContext, CommandRunner } from "../types";

export const run: CommandRunner = async function runEval(
  ctx: CliContext
): Promise<number> {
  const rulePath = ctx.positional[0];
  if (!rulePath) {
    process.stderr.write("  error  usage: hf eval <rulePath> --input '<json>'\n");
    return 1;
  }

  const inputRaw = ctx.options["input"] as string | undefined;
  if (!inputRaw) {
    process.stderr.write("  error  --input '<json>' is required\n");
    return 1;
  }

  let inputs: Record<string, unknown>;
  try {
    inputs = JSON.parse(inputRaw);
    if (typeof inputs !== "object" || inputs === null || Array.isArray(inputs)) {
      throw new Error("must be a JSON object");
    }
  } catch (err) {
    process.stderr.write(`  error  --input must be valid JSON object: ${String(err)}\n`);
    return 1;
  }

  const rulesDir = join(
    ctx.projectRoot,
    (ctx.options["rules-dir"] as string | undefined) ?? "rules"
  );

  let resolver;
  try {
    resolver = await makeResolver(rulesDir);
  } catch (err) {
    process.stderr.write(`  error  failed to load rules: ${String(err)}\n`);
    return 1;
  }

  const withTrace = Boolean(ctx.options["trace"]);
  const ctx2 = new RequestContext({ recordTrace: withTrace });

  let result: unknown;
  try {
    result = resolver.evaluate(rulePath, inputs, ctx2);
  } catch (err) {
    process.stderr.write(`  error  evaluation failed: ${String(err)}\n`);
    return 1;
  }

  if (withTrace) {
    const tree = ctx2.getTrace();
    if (tree) process.stdout.write(formatTrace(tree, { verbose: true }) + "\n");
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return 0;
};
