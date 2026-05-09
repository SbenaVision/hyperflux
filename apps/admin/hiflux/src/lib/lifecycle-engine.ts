import { LifecycleEngine } from "@hyperflux/core";
import type { AuditEntry, LifecycleManifest } from "@hyperflux/core";
import { buildServerResolver } from "./server-resolver";
import manifestJson from "../../lifecycle/manifest.json";

const manifest = manifestJson as unknown as LifecycleManifest;

// Audit log persists across Next.js hot-reloads via globalThis
const g = globalThis as typeof globalThis & { _hifluxAuditLog?: AuditEntry[] };
if (!g._hifluxAuditLog) g._hifluxAuditLog = [];
const auditLog: AuditEntry[] = g._hifluxAuditLog;

export function getAuditLog(): readonly AuditEntry[] {
  return auditLog;
}

/**
 * Creates a LifecycleEngine backed by the current RuntimeRuleStore state.
 * Call per-request so overrides are always reflected.
 */
export function createLifecycleEngine(): LifecycleEngine {
  const resolver = buildServerResolver();
  return new LifecycleEngine(manifest, resolver, (entry) => {
    auditLog.push(entry);
  });
}
