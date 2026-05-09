import type { Rule, DomainFile } from "@hyperflux/core";
import { classifySource } from "./isolation";
import type { RuleSource } from "./isolation";

export type RuleStatus = "draft" | "active" | "archived";

export interface RuntimeRule {
  path: string;
  kind: Rule["kind"];
  inputs: Rule["inputs"];
  output: Rule["output"];
  cases: Rule["cases"];
  metadata: Rule["metadata"];
  source: RuleSource;
  status: RuleStatus;
  lastUpdated: string;
  isOverride: boolean;
}

export class RuntimeRuleStore {
  private sourceRules = new Map<string, RuntimeRule>();
  private overrides = new Map<string, RuntimeRule>();

  load(domainFiles: DomainFile[], source: RuleSource): void {
    for (const df of domainFiles) {
      for (const rule of df.rules) {
        this.sourceRules.set(rule.path, {
          path: rule.path,
          kind: rule.kind,
          inputs: rule.inputs,
          output: rule.output,
          cases: rule.cases,
          metadata: rule.metadata,
          source,
          status: "active",
          lastUpdated: new Date().toISOString(),
          isOverride: false,
        });
      }
    }
  }

  get(path: string): RuntimeRule | undefined {
    return this.overrides.get(path) ?? this.sourceRules.get(path);
  }

  getAll(): RuntimeRule[] {
    const merged = new Map(this.sourceRules);
    for (const [path, rule] of this.overrides) {
      merged.set(path, rule);
    }
    return Array.from(merged.values()).sort((a, b) =>
      a.path.localeCompare(b.path)
    );
  }

  write(rule: Omit<RuntimeRule, "isOverride" | "lastUpdated"> & Partial<Pick<RuntimeRule, "isOverride" | "lastUpdated">>): void {
    this.overrides.set(rule.path, {
      ...rule,
      isOverride: true,
      lastUpdated: new Date().toISOString(),
    });
  }

  remove(path: string): void {
    this.overrides.delete(path);
    this.sourceRules.delete(path);
  }

  promote(path: string): RuntimeRule | undefined {
    const override = this.overrides.get(path);
    if (!override) return undefined;
    const promoted: RuntimeRule = { ...override, isOverride: false };
    this.sourceRules.set(path, promoted);
    this.overrides.delete(path);
    return promoted;
  }

  getDependents(path: string): string[] {
    return this.getAll()
      .filter((r) => r.metadata.requires.includes(path))
      .map((r) => r.path);
  }

  getAllOverrides(): RuntimeRule[] {
    return Array.from(this.overrides.values());
  }
}

// Persistent singleton across Next.js hot-reloads
const g = globalThis as typeof globalThis & { _hifluxStore?: RuntimeRuleStore };
if (!g._hifluxStore) {
  g._hifluxStore = new RuntimeRuleStore();
}
export const ruleStore: RuntimeRuleStore = g._hifluxStore;
