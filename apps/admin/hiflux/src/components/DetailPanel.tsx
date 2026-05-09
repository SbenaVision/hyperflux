"use client";
import { useRule } from "@hyperflux/react";
import { useContent } from "@hyperflux/react";
import type { RuleDetail } from "../lib/viewmodel";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { DependencyWarning } from "./DependencyWarning";
import { ExplainPanel } from "./ExplainPanel";

interface Props {
  detail: RuleDetail | null;
  onEdit: () => void;
  onDelete: () => void;
  onPromote: () => void;
}

export function DetailPanel({ detail, onEdit, onDelete, onPromote }: Props) {
  const panelTitle    = useContent("hiflux.ui.detail_panel_title");
  const editLabel     = useContent("hiflux.actions.edit_label");
  const deleteLabel   = useContent("hiflux.actions.delete_label");
  const promoteLabel  = useContent("hiflux.actions.promote_label");
  const requiresLabel = useContent("hiflux.ui.requires_label");
  const usedByLabel   = useContent("hiflux.ui.used_by_label");
  const casesLabel    = useContent("hiflux.ui.cases_label");
  const outputLabel   = useContent("hiflux.ui.output_type_label");
  const kindLabel     = useContent("hiflux.ui.kind_label");
  const pathLabel     = useContent("hiflux.ui.path_label");
  const sourceLabel   = useContent("hiflux.ui.source_label");
  const statusLabel   = useContent("hiflux.ui.status_label");
  const dryRunLabel   = useContent("hiflux.ui.dry_run_label");
  const emptyMsg      = useContent("hiflux.messages.empty_selection");
  const noDeps        = useContent("hiflux.messages.no_dependents");
  const noRequires    = useContent("hiflux.messages.no_requires");

  const dependentCount = detail?.usedBy.length ?? 0;
  const isOverride     = detail?.isOverride ?? false;

  const showPromote  = useRule<boolean>("hiflux.display.promote_action_visible",   { is_override: isOverride });
  const showWarning  = useRule<boolean>("hiflux.display.show_dependency_warning", { dependent_count: dependentCount });
  const showExplain  = useRule<boolean>("hiflux.display.explain_section_visible", {});
  const canDelete    = useRule<boolean>("hiflux.policy.can_delete",  { dependent_count: dependentCount });
  const canEdit      = useRule<boolean>("hiflux.policy.can_edit",    {});
  const canPromote   = useRule<boolean>("hiflux.policy.can_promote", { is_override: isOverride });

  if (!detail) {
    return (
      <aside className="hf-detail hf-detail-empty">
        <p className="hf-detail-empty-msg">{emptyMsg}</p>
      </aside>
    );
  }

  return (
    <aside className="hf-detail">
      <div className="hf-detail-header">
        <h2 className="hf-detail-title">{panelTitle}</h2>
        <div className="hf-detail-actions">
          {canEdit && (
            <button className="hf-btn hf-btn-secondary" onClick={onEdit}>{editLabel}</button>
          )}
          {showPromote && canPromote && (
            <button className="hf-btn hf-btn-promote" onClick={onPromote}>{promoteLabel}</button>
          )}
          {canDelete && (
            <button className="hf-btn hf-btn-danger" onClick={onDelete}>{deleteLabel}</button>
          )}
        </div>
      </div>

      <div className="hf-detail-body">
        <div className="hf-detail-row">
          <span className="hf-detail-field-label">{pathLabel}</span>
          <span className="hf-detail-field-value hf-mono">{detail.path}</span>
        </div>
        <div className="hf-detail-row">
          <span className="hf-detail-field-label">{kindLabel}</span>
          <span className="hf-detail-field-value">{detail.kind}</span>
        </div>
        <div className="hf-detail-row">
          <span className="hf-detail-field-label">{outputLabel}</span>
          <span className="hf-detail-field-value hf-mono">
            {JSON.stringify(detail.output)}
          </span>
        </div>
        <div className="hf-detail-row">
          <span className="hf-detail-field-label">{sourceLabel}</span>
          <ProvenanceBadge source={detail.source} />
        </div>
        <div className="hf-detail-row">
          <span className="hf-detail-field-label">{statusLabel}</span>
          <span className={`hf-status-badge hf-status-${detail.status}`}>{detail.status}</span>
        </div>

        <div className="hf-detail-section">
          <h3 className="hf-detail-section-title">{casesLabel}</h3>
          <pre className="hf-detail-pre">{JSON.stringify(detail.cases, null, 2)}</pre>
        </div>

        <div className="hf-detail-section">
          <h3 className="hf-detail-section-title">{requiresLabel}</h3>
          {detail.requires.length === 0 ? (
            <p className="hf-detail-none">{noRequires}</p>
          ) : (
            <ul className="hf-detail-list">
              {detail.requires.map((r) => (
                <li key={r} className="hf-mono">{r}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="hf-detail-section">
          <h3 className="hf-detail-section-title">{usedByLabel}</h3>
          {detail.usedBy.length === 0 ? (
            <p className="hf-detail-none">{noDeps}</p>
          ) : (
            <ul className="hf-detail-list">
              {detail.usedBy.map((r) => (
                <li key={r} className="hf-mono">{r}</li>
              ))}
            </ul>
          )}
        </div>

        {showWarning && <DependencyWarning dependents={detail.usedBy} />}

        {showExplain && (
          <div className="hf-detail-section">
            <h3 className="hf-detail-section-title">{dryRunLabel}</h3>
            <ExplainPanel path={detail.path} />
          </div>
        )}
      </div>
    </aside>
  );
}
