import type { RuntimeRule } from "../ruleStore";

export interface RuleOverrideStore {
  get(path: string): Promise<RuntimeRule | undefined>;
  set(rule: RuntimeRule): Promise<void>;
  delete(path: string): Promise<void>;
  getAll(): Promise<RuntimeRule[]>;
}
