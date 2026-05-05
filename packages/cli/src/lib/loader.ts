/**
 * Shared helper — builds a validated RuleLoader + Resolver from a rules directory.
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import {
  RuleLoader,
  FunctionRegistry,
  OperatorRegistryImpl,
  Resolver,
} from "@hyperflux/core";
import type { OperatorDefinition } from "@hyperflux/core";

const DEFAULTS_DIR = join(__dirname, "..", "..", "..", "..", "defaults");

export async function makeOperatorRegistry(): Promise<OperatorRegistryImpl> {
  try {
    const raw = JSON.parse(
      await readFile(join(DEFAULTS_DIR, "operators.json"), "utf8")
    );
    return new OperatorRegistryImpl(raw.operators as OperatorDefinition[]);
  } catch {
    return new OperatorRegistryImpl([]);
  }
}

export async function makeResolver(rulesDir: string): Promise<Resolver> {
  const operatorRegistry = await makeOperatorRegistry();
  const functionRegistry = new FunctionRegistry();
  const loader = new RuleLoader({
    rulesDir,
    functionRegistry,
    operatorRegistry,
    env: "production",
  });
  const { ruleStore } = await loader.load();
  return new Resolver({ ruleStore, functionRegistry, operatorRegistry });
}
