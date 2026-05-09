import type { RuntimeRule, RuleStatus } from "./ruleStore";
import type { RuleSource } from "./isolation";

const CONTENT_NAMESPACES_DEFAULT = ["ui", "actions", "table", "status", "captions", "messages"] as const;
const LOGIC_NAMESPACES_DEFAULT   = ["policy", "config", "dependencies", "permissions", "display", "validation", "lifecycle"] as const;
export type RuleKind = "content" | "logic" | "other";

export interface RulesTableRow {
  path: string;
  status: RuleStatus;
  lastUpdated: string;
  dependencyCount: number;
  source: RuleSource;
  isOverride: boolean;
  namespace: string;
  ruleKind: RuleKind;
  resolvedValue: string | null;
}

export interface RuleDetail {
  path: string;
  kind: string;
  output: unknown;
  inputs: unknown[];
  cases: unknown[];
  requires: string[];
  usedBy: string[];
  source: RuleSource;
  status: RuleStatus;
  lastUpdated: string;
  isOverride: boolean;
}

function extractResolvedValue(rule: RuntimeRule): string | null {
  if (rule.cases.length !== 1) return null;
  const c = rule.cases[0] as { when?: unknown; then: { kind: string; value?: unknown } };
  if (c.when) return null;
  if (c.then.kind !== "literal") return null;
  const v = c.then.value;
  return v === null || v === undefined ? null : String(v);
}

export function toTableRow(
  rule: RuntimeRule,
  _dependents: string[],
  contentNamespaces?: readonly string[],
  logicNamespaces?: readonly string[]
): RulesTableRow {
  const cn = contentNamespaces ?? CONTENT_NAMESPACES_DEFAULT;
  const ln = logicNamespaces   ?? LOGIC_NAMESPACES_DEFAULT;
  const namespace = rule.path.split(".")[1] ?? "";
  const ruleKind: RuleKind =
    (cn as readonly string[]).includes(namespace) ? "content" :
    (ln as readonly string[]).includes(namespace) ? "logic" : "other";
  return {
    path: rule.path,
    status: rule.status,
    lastUpdated: rule.lastUpdated,
    dependencyCount: rule.metadata.requires.length,
    source: rule.source,
    isOverride: rule.isOverride,
    namespace,
    ruleKind,
    resolvedValue: extractResolvedValue(rule),
  };
}

export function toDetail(
  rule: RuntimeRule,
  dependents: string[]
): RuleDetail {
  return {
    path: rule.path,
    kind: rule.kind,
    output: rule.output,
    inputs: rule.inputs,
    cases: rule.cases,
    requires: rule.metadata.requires,
    usedBy: dependents,
    source: rule.source,
    status: rule.status,
    lastUpdated: rule.lastUpdated,
    isOverride: rule.isOverride,
  };
}
