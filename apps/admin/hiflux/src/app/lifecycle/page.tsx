"use client";
import { useState, useEffect, useCallback } from "react";
import { useContent, useRule } from "@hyperflux/react";
import type { AuditEntry, LifecycleManifest } from "@hyperflux/core/client";
import manifestJson from "../../../lifecycle/manifest.json";

const manifest = manifestJson as unknown as LifecycleManifest;

function RetryBadge({ policy }: { policy: string }) {
  const prefix = useContent("hiflux.messages.retry_prefix");
  return <span className="hf-stage-retry">{prefix} {policy}</span>;
}

function StageBadge({ stage }: { stage: "before" | "during" | "after" }) {
  return <span className={`hf-stage-badge hf-stage-${stage}`}>{stage}</span>;
}

function ExtBadge({ externalizable }: { externalizable: boolean }) {
  const extLabel       = useContent("hiflux.captions.externalizable");
  const protectedLabel = useContent("hiflux.captions.protected_stage");
  return externalizable
    ? <span className="hf-ext-badge hf-ext-open">{extLabel}</span>
    : <span className="hf-ext-badge hf-ext-protected">{protectedLabel}</span>;
}

function ManifestBrowser() {
  const title = useContent("hiflux.ui.lifecycle_addresses_label");
  const lifecycleStages = useRule<string[]>("hiflux.config.lifecycle_stages", {});
  const entries = Object.entries(manifest.addresses);

  return (
    <div className="hf-lifecycle-panel">
      <div className="hf-lifecycle-panel-header">
        <span className="hf-lifecycle-panel-title">{title}</span>
        <span className="hf-lifecycle-panel-count">{entries.length}</span>
      </div>
      <div className="hf-lifecycle-panel-body">
        {entries.map(([address, config]) => (
          <div key={address} className="hf-address-card">
            <div className="hf-address-name">{address}</div>
            <div className="hf-stage-list">
              {(lifecycleStages ?? []).map((stage) => {
                const s = config[stage as "before" | "during" | "after"];
                return (
                  <div key={stage} className="hf-stage-row">
                    <div className="hf-stage-row-left">
                      <StageBadge stage={stage as "before" | "during" | "after"} />
                      <ExtBadge externalizable={s.externalizable} />
                    </div>
                    <div className="hf-stage-rules">
                      {s.rules.length === 0 ? (
                        <span className="hf-stage-no-rules">—</span>
                      ) : (
                        s.rules.map((r) => (
                          <span key={r} className="hf-stage-rule-path">{r}</span>
                        ))
                      )}
                      {s.retry_policy && (
                        <RetryBadge policy={s.retry_policy} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditLogPanel() {
  const title            = useContent("hiflux.ui.audit_log_label");
  const refreshLabel     = useContent("hiflux.ui.refresh_label");
  const loadingIndicator = useContent("hiflux.captions.loading_indicator");
  const emptyMsg         = useContent("hiflux.messages.audit_empty");
  const colTime          = useContent("hiflux.table.col_time_header");
  const colAddress       = useContent("hiflux.table.col_address_header");
  const colStage         = useContent("hiflux.table.col_stage_header");
  const colMs            = useContent("hiflux.table.col_duration_ms_header");
  const colResult        = useContent("hiflux.table.col_result_header");
  const auditVisible   = useRule<boolean>("hiflux.display.audit_log_visible", {});
  const truncateLength = useRule<number>("hiflux.config.result_truncate_length", {});

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lifecycle/audit");
      if (res.ok) setEntries(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!auditVisible) return null;

  const sorted = [...entries].reverse();

  return (
    <div className="hf-lifecycle-panel">
      <div className="hf-lifecycle-panel-header">
        <span className="hf-lifecycle-panel-title">{title}</span>
        <span className="hf-lifecycle-panel-count">{entries.length}</span>
        <button className="hf-btn hf-btn-ghost hf-btn-xs" onClick={refresh} disabled={loading}>
          {loading ? loadingIndicator : refreshLabel}
        </button>
      </div>
      <div className="hf-lifecycle-panel-body">
        {sorted.length === 0 ? (
          <div className="hf-empty" style={{ padding: "2rem 1rem" }}>{emptyMsg}</div>
        ) : (
          <table className="hf-table">
            <thead>
              <tr>
                <th>{colTime}</th>
                <th>{colAddress}</th>
                <th>{colStage}</th>
                <th>{colMs}</th>
                <th>{colResult}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => (
                <tr key={i} className="hf-row">
                  <td className="hf-cell-mono">{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td className="hf-cell-path">{e.address}</td>
                  <td><StageBadge stage={e.stage} /></td>
                  <td className="hf-cell-num hf-cell-mono">{e.durationMs}</td>
                  <td className="hf-cell-mono hf-cell-result">
                    {e.result == null || (Array.isArray(e.result) && e.result.length === 0)
                      ? <span className="hf-cell-dim">—</span>
                      : <span title={JSON.stringify(e.result)}>
                          {JSON.stringify(e.result).slice(0, truncateLength ?? 60)}
                        </span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function LifecyclePage() {
  const pageTitle = useContent("hiflux.ui.nav_lifecycle_label");

  return (
    <>
      <div className="hf-toolbar">
        <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{pageTitle}</span>
        <span className="hf-muted" style={{ fontSize: "0.75rem", color: "var(--hf-muted)" }}>
          v{manifest.version} · namespace: {manifest.namespace}
        </span>
      </div>
      <div className="hf-lifecycle-layout">
        <ManifestBrowser />
        <AuditLogPanel />
      </div>
    </>
  );
}
