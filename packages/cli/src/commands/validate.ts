/**
 * @file `hf validate` — validates all rule files and exits 0 on success.
 * @module @hyperflux/cli/commands/validate
 * @since 0.1.0
 */

import { join } from "node:path";
import {
  RuleLoader,
  FunctionRegistry,
  OperatorRegistryImpl,
  LoadError,
} from "@hyperflux/core";
import type { OperatorDefinition } from "@hyperflux/core";
import { readFile } from "node:fs/promises";
import type { CliContext, CommandRunner } from "../types";

export interface ValidateResult {
  exitCode: 0 | 1;
  filesScanned: number;
  rulesValidated: number;
  errors: ReadonlyArray<import("@hyperflux/core").HyperFluxError>;
  warnings: ReadonlyArray<string>;
}

async function loadOperatorRegistry() {
  const defaultsDir = join(__dirname, "..", "..", "..", "..", "defaults");
  const raw = JSON.parse(await readFile(join(defaultsDir, "operators.json"), "utf8"));
  return new OperatorRegistryImpl(raw.operators as OperatorDefinition[]);
}

export const run: CommandRunner = async function runValidate(
  ctx: CliContext
): Promise<number> {
  const rulesDir = join(
    ctx.projectRoot,
    (ctx.options["rules-dir"] as string | undefined) ?? "rules"
  );

  let operatorRegistry;
  try {
    operatorRegistry = await loadOperatorRegistry();
  } catch {
    operatorRegistry = new OperatorRegistryImpl([]);
  }

  const loader = new RuleLoader({
    rulesDir,
    functionRegistry: new FunctionRegistry(),
    operatorRegistry,
    env: "production",
  });

  try {
    const { ruleStore, warnings } = await loader.load();

    for (const warning of warnings) {
      process.stdout.write(`  warn  ${warning}\n`);
    }

    const count = ruleStore.size;
    const domains = ruleStore.getDomains();
    process.stdout.write(
      `\n  ✓  ${count} rule${count !== 1 ? "s" : ""} across ${domains.length} domain${domains.length !== 1 ? "s" : ""} — all valid\n\n`
    );
    return 0;
  } catch (err) {
    if (err instanceof LoadError) {
      process.stderr.write(`\n  HyperFlux validation failed:\n\n`);
      for (const e of err.context.errors) {
        process.stderr.write(`  [${e.code}] ${e.message}\n`);
      }
      process.stderr.write(`\n  ${err.context.errors.length} error${err.context.errors.length !== 1 ? "s" : ""} found\n\n`);
      return 1;
    }
    process.stderr.write(`  unexpected error: ${String(err)}\n`);
    return 1;
  }
};
