import {
  Resolver,
  FunctionRegistry,
  OperatorRegistryImpl,
  RuleStoreImpl,
  DependencyGraphImpl,
} from "@hyperflux/core";
import type { DomainFile, OperatorDefinition } from "@hyperflux/core";
import { ruleStore } from "./ruleStore";

const OPERATORS: OperatorDefinition[] = [
  { op: ">",          arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: ">=",         arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "<",          arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "<=",         arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "==",         arity: 2, input_types: ["any",    "any"],    output_type: "boolean" },
  { op: "!=",         arity: 2, input_types: ["any",    "any"],    output_type: "boolean" },
  { op: "AND",        arity: "n", input_types: ["boolean"],        output_type: "boolean" },
  { op: "OR",         arity: "n", input_types: ["boolean"],        output_type: "boolean" },
  { op: "NOT",        arity: 1, input_types: ["boolean"],          output_type: "boolean" },
  { op: "+",          arity: 2, input_types: ["number", "number"], output_type: "number"  },
  { op: "-",          arity: 2, input_types: ["number", "number"], output_type: "number"  },
  { op: "startsWith", arity: 2, input_types: ["string", "string"], output_type: "boolean" },
  { op: "endsWith",   arity: 2, input_types: ["string", "string"], output_type: "boolean" },
  { op: "includes",   arity: 2, input_types: ["any",    "any"],    output_type: "boolean" },
  { op: "length",     arity: 1, input_types: ["any"],              output_type: "number"  },
  { op: "concat",     arity: 2, input_types: ["string", "string"], output_type: "string"  },
];

/**
 * Reads a literal string rule directly from the store — no resolver needed.
 * Works for any rule path (config.*, messages.*, content.*, etc.).
 * Safe to call after init-store has loaded; falls back to the provided default.
 */
export function readConfigString(path: string, fallback: string): string {
  const rule = ruleStore.get(path);
  if (!rule?.cases[0]) return fallback;
  const t = rule.cases[0].then as { kind?: string; value?: unknown };
  return t.kind === "literal" && typeof t.value === "string" ? t.value : fallback;
}

/**
 * Reads a literal array rule directly from the store — no resolver needed.
 * Safe to call after init-store has loaded; falls back to the provided default.
 */
export function readConfigArray<T>(path: string, fallback: T[]): T[] {
  const rule = ruleStore.get(path);
  if (!rule?.cases[0]) return fallback;
  const t = rule.cases[0].then as { kind?: string; value?: unknown };
  return t.kind === "literal" && Array.isArray(t.value) ? (t.value as T[]) : fallback;
}

/**
 * Builds a Resolver from the current RuntimeRuleStore state.
 * Call this per-request so overrides are always reflected.
 */
export function buildServerResolver(): Resolver {
  const allRules = ruleStore.getAll();
  const deps = new Map(allRules.map((r) => [r.path, r.metadata.requires as string[]]));
  const topo = allRules.map((r) => r.path);
  const graph = new DependencyGraphImpl(deps, topo);

  const domainMap = new Map<string, typeof allRules>();
  for (const rule of allRules) {
    const domain = rule.path.split(".")[0];
    if (!domainMap.has(domain)) domainMap.set(domain, []);
    domainMap.get(domain)!.push(rule);
  }
  const domainFiles: DomainFile[] = Array.from(domainMap.entries()).map(([domain, rules]) => ({
    domain,
    version: "1",
    rules: rules as DomainFile["rules"],
  }));

  const store = new RuleStoreImpl(allRules as DomainFile["rules"], domainFiles, graph);
  return new Resolver({
    ruleStore: store,
    functionRegistry: new FunctionRegistry(),
    operatorRegistry: new OperatorRegistryImpl(OPERATORS),
  });
}
