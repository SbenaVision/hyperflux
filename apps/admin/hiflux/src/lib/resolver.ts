"use client";
import {
  Resolver,
  FunctionRegistry,
  OperatorRegistryImpl,
  RuleStoreImpl,
  DependencyGraphImpl,
} from "@hyperflux/core/client";
import type { DomainFile, OperatorDefinition } from "@hyperflux/core/client";

// content/ — user-facing text
import uiContent       from "../../content/ui.json";
import actionsContent  from "../../content/actions.json";
import tableContent    from "../../content/table.json";
import statusContent   from "../../content/status.json";
import captionsContent from "../../content/captions.json";
import messagesContent from "../../content/messages.json";

// rules/ — business policy, config, dependency logic
import policyRules     from "../../rules/policy.json";
import configRules     from "../../rules/config.json";
import dependencyRules from "../../rules/dependencies.json";
import permissionRules from "../../rules/permissions.json";
import displayRules    from "../../rules/display.json";
import validationRules from "../../rules/validation.json";

const OPERATORS: OperatorDefinition[] = [
  { op: ">",          arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: ">=",         arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "<",          arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "<=",         arity: 2, input_types: ["number", "number"], output_type: "boolean" },
  { op: "length",     arity: 1, input_types: ["string"],           output_type: "number"  },
  { op: "startsWith", arity: 2, input_types: ["string", "string"], output_type: "boolean" },
];

export function createResolver(): Resolver {
  const domainFiles = [
    uiContent,
    actionsContent,
    tableContent,
    statusContent,
    captionsContent,
    messagesContent,
    policyRules,
    configRules,
    dependencyRules,
    permissionRules,
    displayRules,
    validationRules,
  ] as unknown as DomainFile[];
  const allRules = domainFiles.flatMap((df) => df.rules);
  const deps = new Map(
    allRules.map((r) => [r.path, r.metadata.requires as string[]])
  );
  const topo = allRules.map((r) => r.path);
  const graph = new DependencyGraphImpl(deps, topo);
  const store = new RuleStoreImpl(allRules, domainFiles, graph);
  return new Resolver({
    ruleStore: store,
    functionRegistry: new FunctionRegistry(),
    operatorRegistry: new OperatorRegistryImpl(OPERATORS),
  });
}
