"use client";
import {
  Resolver,
  FunctionRegistry,
  OperatorRegistryImpl,
  RuleStoreImpl,
  DependencyGraphImpl,
} from "@hyperflux/core";
import type { DomainFile, OperatorDefinition } from "@hyperflux/core";

import copyRules from "../../rules/copy.json";
import configRules from "../../rules/config.json";
import pricingRules from "../../rules/pricing.json";

const OPERATORS: OperatorDefinition[] = [
  { op: ">", arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: ">=", arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "<", arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "<=", arity: 2, input_types: ["number", "number"], output_type: "boolean" },
];

export function createResolver(): Resolver {
  const domainFiles = [copyRules, configRules, pricingRules] as unknown as DomainFile[];
  const allRules = domainFiles.flatMap((df) => df.rules);
  const deps = new Map(allRules.map((r) => [r.path, r.metadata.requires as string[]]));
  const topo = allRules.map((r) => r.path);
  const graph = new DependencyGraphImpl(deps, topo);
  const store = new RuleStoreImpl(allRules, domainFiles, graph);
  return new Resolver({
    ruleStore: store,
    functionRegistry: new FunctionRegistry(),
    operatorRegistry: new OperatorRegistryImpl(OPERATORS),
  });
}
