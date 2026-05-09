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
}

const STATUS_CLASS: Record<string, string> = {
  draft: "hf-status-draft",
  active: "hf-status-active",
  archived: "hf-status-archived",
};

const KIND_CLASS: Record<string, string> = {
  content: "hf-ns-content",
  logic:   "hf-ns-logic",
  other:   "hf-ns-other",
};

export function SearchResultsTable({ rows, selectedPath, onSelect, captionSize }: Props) {
  const colNs       = useContent("hiflux.table.col_ns_header");
  const colRulePath = useContent("hiflux.table.col_rule_path_header");
  const colValue    = useContent("hiflux.table.col_value_header");
  const colStatus   = useContent("hiflux.table.col_status_header");
  const colSource   = useContent("hiflux.table.col_source_header");
  const noMatches   = useContent("hiflux.messages.no_matches");

  return (
    <div className={`hf-table-wrap hf-caption-${captionSize.toLowerCase()}`}>
      <div className="hf-table-count">
        <span className="hf-table-count-match">{rows.length}</span>
        <span className="hf-table-count-sep"> result{rows.length !== 1 ? "s" : ""}</span>
      </div>
      {rows.length === 0 ? (
        <div className="hf-empty" style={{ padding: "1rem 0" }}>{noMatches}</div>
      ) : (
        <table className="hf-table">
          <thead>
            <tr>
              <th>{colNs}</th>
              <th>{colRulePath}</th>
              <th>{colValue}</th>
              <th>{colStatus}</th>
              <th>{colSource}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.path}
                className={["hf-row", selectedPath === row.path ? "selected" : "", row.isOverride ? "override" : ""].filter(Boolean).join(" ")}
                onClick={() => onSelect(row.path)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSelect(row.path)}
              >
                <td>
                  <span className={`hf-ns-badge ${KIND_CLASS[row.ruleKind] ?? ""}`}>{row.namespace}</span>
                </td>
                <td className="hf-cell-path">{row.path}</td>
                <td className="hf-cell-value" title={row.resolvedValue ?? ""}>
                  {row.resolvedValue ?? <span className="hf-cell-dim">—</span>}
                </td>
                <td>
                  <span className={`hf-status-badge ${STATUS_CLASS[row.status] ?? ""}`}>{row.status}</span>
                </td>
                <td><ProvenanceBadge source={row.source} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
