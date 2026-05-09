"use client";
import { useState, useEffect, useCallback } from "react";
import { useRule } from "@hyperflux/react";
import { useContent } from "@hyperflux/react";
import type { RuleDetail } from "../lib/viewmodel";
import { DependencyWarning } from "./DependencyWarning";

interface Props {
  mode: "create" | "edit";
  initial: Partial<RuleDetail> | null;
  onSave: (data: RuleFormData) => Promise<void>;
  onCancel: () => void;
}

export interface RuleFormData {
  path: string;
  kind: string;
  output: { type: string };
  cases: unknown[];
  status: "draft" | "active" | "archived";
}

type ValidationErrors = Partial<Record<keyof RuleFormData | "casesJson", string>>;

export function CreateEditModal({ mode, initial, onSave, onCancel }: Props) {
  const createTitle   = useContent("hiflux.actions.create_label");
  const editTitle     = useContent("hiflux.actions.edit_label");
  const saveLabel     = useContent("hiflux.actions.save_label");
  const cancelLabel   = useContent("hiflux.actions.cancel_label");
  const validateLabel = useContent("hiflux.actions.validate_label");
  const pathRequired  = useContent("hiflux.messages.path_required");
  const pathPrefix    = useContent("hiflux.messages.path_prefix_error");
  const casesJsonErr  = useContent("hiflux.messages.cases_json_error");
  const kindLabel     = useContent("hiflux.ui.kind_label");
  const outputLabel   = useContent("hiflux.ui.output_type_label");
  const casesLabel    = useContent("hiflux.ui.cases_label");
  const pathLabel     = useContent("hiflux.ui.path_label");
  const statusLabel   = useContent("hiflux.ui.status_label");
  const draftLabel    = useContent("hiflux.ui.status_draft_label");
  const activeLabel   = useContent("hiflux.ui.status_active_label");
  const archivedLabel = useContent("hiflux.ui.status_archived_label");

  const outputTypes        = useRule<string[]>("hiflux.config.output_types", {});
  const defaultPathPrefix  = useRule<string>("hiflux.config.default_rule_path_prefix", {});
  const defaultStatus      = useRule<string>("hiflux.config.default_rule_status", {});
  const ruleStatuses       = useRule<string[]>("hiflux.config.rule_statuses", {});
  const pathEditable       = useRule<boolean>("hiflux.policy.path_field_editable", { mode });
  const kindEditable       = useRule<boolean>("hiflux.policy.kind_field_editable", {});

  const [path, setPath]             = useState(initial?.path ?? defaultPathPrefix ?? "hiflux.");
  const [kind]                      = useState("compute");
  const [outputType, setOutputType] = useState(
    (initial?.output as { type?: string })?.type ?? "string"
  );
  const [casesText, setCasesText]   = useState(
    initial?.cases ? JSON.stringify(initial.cases, null, 2) : '[{"then":{"kind":"literal","value":""}}]'
  );
  const [status, setStatus]         = useState<"draft" | "active" | "archived">(
    (initial?.status as "draft" | "active" | "archived") ?? (defaultStatus as "draft" | "active" | "archived") ?? "draft"
  );
  const [errors, setErrors]         = useState<ValidationErrors>({});
  const [saving, setSaving]         = useState(false);

  // Validation rules evaluated reactively as path changes
  const pathNonempty  = useRule<boolean>("hiflux.validation.path_nonempty",          { path });
  const pathHasPrefix = useRule<boolean>("hiflux.validation.path_has_hiflux_prefix", { path });

  const validate = useCallback((): ValidationErrors => {
    const errs: ValidationErrors = {};
    if (!pathNonempty)  errs.path = pathRequired;
    else if (!pathHasPrefix) errs.path = pathPrefix;
    try { JSON.parse(casesText); } catch { errs.casesJson = casesJsonErr; }
    return errs;
  }, [pathNonempty, pathHasPrefix, casesText, pathRequired, pathPrefix, casesJsonErr]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave({ path, kind, output: { type: outputType }, cases: JSON.parse(casesText), status });
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "create" ? createTitle : editTitle;

  return (
    <div className="hf-modal-overlay" role="dialog" aria-modal>
      <div className="hf-modal">
        <h2 className="hf-modal-title">{title}</h2>

        <div className="hf-form-group">
          <label className="hf-label">{pathLabel}</label>
          <input
            className={`hf-input hf-mono${errors.path ? " error" : ""}`}
            value={path}
            onChange={(e) => setPath(e.target.value)}
            disabled={!pathEditable}
            autoFocus
          />
          {errors.path && <span className="hf-error">{errors.path}</span>}
        </div>

        <div className="hf-form-group">
          <label className="hf-label">{kindLabel}</label>
          <input className="hf-input" value={kind} disabled={!kindEditable} readOnly={!kindEditable} />
        </div>

        <div className="hf-form-group">
          <label className="hf-label">{outputLabel}</label>
          <select
            className="hf-select"
            value={outputType}
            onChange={(e) => setOutputType(e.target.value)}
          >
            {(outputTypes ?? []).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="hf-form-group">
          <label className="hf-label">{statusLabel}</label>
          <select
            className="hf-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "active" | "archived")}
          >
            {(ruleStatuses ?? []).map((s) => {
              const label = s === "draft" ? draftLabel : s === "active" ? activeLabel : archivedLabel;
              return <option key={s} value={s}>{label ?? s}</option>;
            })}
          </select>
        </div>

        <div className="hf-form-group">
          <label className="hf-label">{casesLabel}</label>
          <textarea
            className={`hf-textarea hf-mono${errors.casesJson ? " error" : ""}`}
            value={casesText}
            onChange={(e) => setCasesText(e.target.value)}
            rows={10}
          />
          {errors.casesJson && <span className="hf-error">{errors.casesJson}</span>}
        </div>

        <div className="hf-modal-actions">
          <button className="hf-btn hf-btn-ghost" onClick={() => setErrors(validate())}>
            {validateLabel}
          </button>
          <button className="hf-btn hf-btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className="hf-btn hf-btn-primary" onClick={handleSave} disabled={saving}>
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
