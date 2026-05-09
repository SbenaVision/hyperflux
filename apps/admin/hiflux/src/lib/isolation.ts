import { ruleStore } from "./ruleStore";

export type RuleSource = "hiflux" | "hyperflux-core" | "legacy-admin";

function readLiteral<T>(path: string, fallback: T): T {
  const rule = ruleStore.get(path);
  if (!rule?.cases[0]) return fallback;
  const t = rule.cases[0].then as { kind?: string; value?: unknown };
  return t.kind === "literal" ? (t.value as T) ?? fallback : fallback;
}

export function classifySource(path: string): RuleSource {
  const hifluxPrefix = readLiteral("hiflux.config.source_prefix_hiflux", "hiflux.");
  const corePrefix   = readLiteral("hiflux.config.source_prefix_core", "hyperflux-core.");
  if (path.startsWith(hifluxPrefix)) return "hiflux";
  if (path.startsWith(corePrefix))   return "hyperflux-core";
  return "legacy-admin";
}

export function findLegacyDeps(requires: string[]): string[] {
  const legacyNs = readLiteral<string[]>("hiflux.config.legacy_namespaces", ["config.", "copy.", "pricing.", "users.", "admin."]);
  return requires.filter((dep) => legacyNs.some((ns) => dep.startsWith(ns)));
}
