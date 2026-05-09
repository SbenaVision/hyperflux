"use client";
import { useContent } from "@hyperflux/react";
import type { RulesTableRow } from "../lib/viewmodel";
import type { CaptionSize } from "./CaptionSizeSelector";
import { ProvenanceBadge } from "./ProvenanceBadge";

interface Props {
  rows: RulesTableRow[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  captionSize: CaptionSize;
  filterText: string;
  filterStatus: string;
  filterSource: string;
  filterNamespace: string;
  showValue?: boolean;
}

const STATUS_CLASS: Record<string, string> = {
  draft: "hf-status-draft",
  active: "hf-status-active",
  archived: "hf-status-archived",
};

export function RulesTable({
  rows,
  selectedPath,
  onSelect,
  captionSize,
  filterText,
  filterStatus,
  filterSource,
  filterNamespace,
  showValue = false,
}: Props) {
  const colRule    = useContent("hiflux.table.col_rule_header");
  const colValue   = useContent("hiflux.table.col_value_header");
  const colStatus  = useContent("hiflux.table.col_status_header");
  const colUpdated = useContent("hiflux.table.col_updated_header");
  const colDeps    = useContent("hiflux.table.col_deps_header");
  const colSource  = useContent("hiflux.table.col_source_header");
  const noResults  = useContent("hiflux.messages.no_results");
  const overrideIndicator = useContent("hiflux.ui.override_indicator");

  const draftLabel    = useContent("hiflux.status.draft_label");
  const activeLabel   = useContent("hiflux.status.active_label");
  const archivedLabel = useContent("hiflux.status.archived_label");

  const statusLabel = (s: string) =>
    s === "draft" ? draftLabel : s === "active" ? activeLabel : archivedLabel;

  const filtered = rows.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterSource && r.source !== filterSource) return false;
    if (filterNamespace && r.namespace !== filterNamespace) return false;
    if (filterText) {
      const t = filterText.toLowerCase();
      const pathMatch = r.path.toLowerCase().includes(t);
      const valueMatch = r.resolvedValue?.toLowerCase().includes(t) ?? false;
      if (!pathMatch && !valueMatch) return false;
    }
    return true;
  });

  const isFiltered = filtered.length !== rows.length;

  return (
    <div className={`hf-table-wrap hf-caption-${captionSize.toLowerCase()}`}>
      <div className="hf-table-count">
        {isFiltered
          ? <><span className="hf-table-count-match">{filtered.length}</span><span className="hf-table-count-sep"> / {rows.length}</span></>
          : <span className="hf-table-count-total">{rows.length}</span>
        }
      </div>
      <table className="hf-table">
        <thead>
          <tr>
            <th>{colRule}</th>
            {showValue && <th>{colValue}</th>}
            <th>{colStatus}</th>
            <th>{colUpdated}</th>
            <th>{colDeps}</th>
            <th>{colSource}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={showValue ? 6 : 5} className="hf-empty">{noResults}</td>
            </tr>
          ) : (
            filtered.map((row) => (
              <tr
                key={row.path}
                className={[
                  "hf-row",
                  selectedPath === row.path ? "selected" : "",
                  row.isOverride ? "override" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onSelect(row.path)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSelect(row.path)}
              >
                <td className="hf-cell-path">
                  {row.path}
                  {row.isOverride && (
                    <span className="hf-override-pill">{overrideIndicator}</span>
                  )}
                </td>
                {showValue && (
                  <td className="hf-cell-value" title={row.resolvedValue ?? ""}>
                    {row.resolvedValue ?? <span className="hf-cell-dim">—</span>}
                  </td>
                )}
                <td>
                  <span className={`hf-status-badge ${STATUS_CLASS[row.status] ?? ""}`}>
                    {statusLabel(row.status)}
                  </span>
                </td>
                <td className="hf-cell-mono">
                  {new Date(row.lastUpdated).toLocaleString()}
                </td>
                <td className="hf-cell-num">{row.dependencyCount}</td>
                <td><ProvenanceBadge source={row.source} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
