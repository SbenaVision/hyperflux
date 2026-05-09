import { getOverrideStore } from "./adapters";
import type { RuntimeRule } from "./ruleStore";

export async function loadPersistedOverrides(): Promise<RuntimeRule[]> {
  return getOverrideStore().getAll();
}

export async function persistRule(rule: RuntimeRule): Promise<void> {
  return getOverrideStore().set(rule);
}

export async function deletePersistedRule(path: string): Promise<void> {
  return getOverrideStore().delete(path);
}

// Legacy sync batch-write removed — writes are now per-rule via persistRule().
// Called at startup only via loadPersistedOverrides().
