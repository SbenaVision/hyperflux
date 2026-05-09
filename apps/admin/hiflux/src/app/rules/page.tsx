"use client";
import { useState, useEffect, useCallback } from "react";
import { useRule, useContent } from "@hyperflux/react";
import { RulesTable } from "../../components/RulesTable";
import { DetailPanel } from "../../components/DetailPanel";
import { CreateEditModal } from "../../components/CreateEditModal";
import { CaptionSizeSelector } from "../../components/CaptionSizeSelector";
import { registerShortcuts, buildShortcuts } from "../../lib/keyboard";
import type { RulesTableRow, RuleDetail } from "../../lib/viewmodel";
import { useResolverRefresh } from "../../components/Providers";
import { SearchResultsTable } from "../../components/SearchResultsTable";
import type { RuleFormData } from "../../components/CreateEditModal";
import type { CaptionSize } from "../../components/CaptionSizeSelector";

type ModalMode = { type: "create" } | { type: "edit"; detail: RuleDetail } | null;

export default function RulesPage() {
  // All useRule calls hoisted to component top level — no hooks in callbacks
  const searchPlaceholder      = useRule<string>("hiflux.ui.search_placeholder", {});
  const filterStatusLabel      = useRule<string>("hiflux.ui.filter_status_label", {});
  const filterSourceLabel      = useRule<string>("hiflux.ui.filter_source_label", {});
  const createLabel            = useRule<string>("hiflux.actions.create_label", {});
  const filterAllLabel         = useRule<string>("hiflux.actions.filter_all_label", {});
  const shortcutsHint          = useRule<string>("hiflux.ui.shortcuts_hint", {});
  const legacySectionTitle     = useRule<string>("hiflux.messages.legacy_section_title", {});
  const legacySectionNote      = useRule<string>("hiflux.messages.legacy_section_note", {});
  const saveSuccess            = useRule<string>("hiflux.messages.save_success", {});
  const keyboardEnabled        = useRule<boolean>("hiflux.policy.keyboard_shortcuts_enabled", {});
  const ruleStatuses           = useRule<string[]>("hiflux.config.rule_statuses", {});
  const contentNamespaces      = useRule<string[]>("hiflux.config.content_namespaces", {});
  const logicNamespaces        = useRule<string[]>("hiflux.config.logic_namespaces", {});
  const legacySectionVisible   = useRule<boolean>("hiflux.policy.legacy_section_visible", {});
  const toastDurationMs        = useRule<number>("hiflux.config.toast_duration_ms", {});
  const shortcutCreate         = useRule<string>("hiflux.config.shortcut_create", {});
  const shortcutEdit           = useRule<string>("hiflux.config.shortcut_edit", {});
  const shortcutDelete         = useRule<string>("hiflux.config.shortcut_delete", {});
  const shortcutClose          = useRule<string>("hiflux.config.shortcut_close", {});
  const sectionSearch  = useContent("hiflux.ui.section_search");
  const sectionContent = useContent("hiflux.ui.section_content");
  const sectionLogic   = useContent("hiflux.ui.section_logic");

  const [rows, setRows]               = useState<RulesTableRow[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [detail, setDetail]           = useState<RuleDetail | null>(null);
  const [modal, setModal]             = useState<ModalMode>(null);
  const [captionSize, setCaptionSize] = useState<CaptionSize>("M");
  const [filterText, setFilterText]       = useState("");
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterSource, setFilterSource]   = useState("");
  const [filterNamespace, setFilterNamespace] = useState("");
  const [toast, setToast]             = useState<string | null>(null);

  const refreshResolver = useResolverRefresh();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), toastDurationMs ?? 2500);
  }, [toastDurationMs]);

  const fetchRows = useCallback(async () => {
    try {
      const res = await fetch("/api/rules");
      if (res.ok) {
        setRows(await res.json());
      } else {
        console.error("GET /api/rules failed:", res.status, await res.text());
      }
    } catch (err) {
      console.error("GET /api/rules threw:", err);
    }
  }, []);

  const fetchDetail = useCallback(async (path: string) => {
    const res = await fetch(`/api/rule?path=${encodeURIComponent(path)}`);
    if (res.ok) setDetail(await res.json());
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    if (selectedPath) fetchDetail(selectedPath);
    else setDetail(null);
  }, [selectedPath, fetchDetail]);

  const openEdit   = useCallback(() => { if (detail) setModal({ type: "edit", detail }); }, [detail]);
  const openCreate = useCallback(() => setModal({ type: "create" }), []);
  const closeModal = useCallback(() => setModal(null), []);

  const handleDelete = useCallback(async () => {
    if (!selectedPath) return;
    const res = await fetch(`/api/rule?path=${encodeURIComponent(selectedPath)}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedPath(null);
      setDetail(null);
      await fetchRows();
      await refreshResolver();
    } else {
      const body = await res.json() as { error?: string };
      showToast(body.error ?? "Delete failed");
    }
  }, [selectedPath, fetchRows, refreshResolver, showToast]);

  const handlePromote = useCallback(async () => {
    if (!selectedPath) return;
    const res = await fetch(`/api/rule/promote?path=${encodeURIComponent(selectedPath)}`, { method: "POST" });
    if (res.ok) {
      await fetchRows();
      await fetchDetail(selectedPath);
      await refreshResolver();
      showToast("Promoted to source.");
    }
  }, [selectedPath, fetchRows, fetchDetail, refreshResolver, showToast]);

  const handleSave = useCallback(async (data: RuleFormData) => {
    const isEdit = modal?.type === "edit";
    const url    = isEdit ? `/api/rule?path=${encodeURIComponent(data.path)}` : "/api/rules";
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      closeModal();
      await fetchRows();
      await refreshResolver();
      setSelectedPath(data.path);
      await fetchDetail(data.path);
      showToast(saveSuccess);
    } else {
      const body = await res.json() as { error?: string };
      showToast(body.error ?? "Save failed");
    }
  }, [modal, fetchRows, fetchDetail, closeModal, refreshResolver, showToast, saveSuccess]);

  useEffect(() => {
    if (!keyboardEnabled) return;
    const shortcuts = buildShortcuts({
      create: shortcutCreate ?? undefined,
      edit:   shortcutEdit   ?? undefined,
      delete: shortcutDelete ?? undefined,
      close:  shortcutClose  ?? undefined,
    });
    return registerShortcuts({
      create: openCreate,
      edit:   openEdit,
      delete: () => { if (detail) handleDelete(); },
      escape: closeModal,
    }, shortcuts);
  }, [keyboardEnabled, shortcutCreate, shortcutEdit, shortcutDelete, shortcutClose, openCreate, openEdit, handleDelete, closeModal, detail]);

  const applyFilters = (r: RulesTableRow) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterSource && r.source !== filterSource) return false;
    if (filterNamespace && r.namespace !== filterNamespace) return false;
    if (filterText) {
      const t = filterText.toLowerCase();
      if (!r.path.toLowerCase().includes(t) && !(r.resolvedValue?.toLowerCase().includes(t))) return false;
    }
    return true;
  };

  const contentRows = rows.filter((r) => r.ruleKind === "content");
  const logicRows   = rows.filter((r) => r.ruleKind === "logic");
  const legacyRows  = rows.filter((r) => r.source === "legacy-admin");
  const allRows     = [...contentRows, ...logicRows, ...legacyRows];
  const filteredRows = allRows.filter(applyFilters);
  const visiblePaths = new Set(filteredRows.map((r) => r.path));
  const isFiltering = !!(filterText || filterStatus || filterNamespace);
  const rowCountLabel = isFiltering
    ? `${filteredRows.length} / ${allRows.length} rules`
    : `${allRows.length} rules`;

  // Clear selection when the selected rule is no longer visible after filtering
  useEffect(() => {
    if (selectedPath && !visiblePaths.has(selectedPath)) {
      setSelectedPath(null);
      setDetail(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterText, filterStatus, filterSource, filterNamespace]);

  return (
    <>
      <div className="hf-toolbar">
        <input
          className="hf-search"
          placeholder={searchPlaceholder}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <select
          className="hf-select-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label={filterStatusLabel}
        >
          <option value="">{filterAllLabel}</option>
          {(ruleStatuses ?? []).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="hf-select-filter"
          value={filterNamespace}
          onChange={(e) => setFilterNamespace(e.target.value)}
          aria-label="Namespace"
        >
          <option value="">{filterAllLabel}</option>
          <optgroup label="Content">
            {(contentNamespaces ?? []).map((ns) => <option key={ns} value={ns}>{ns}</option>)}
          </optgroup>
          <optgroup label="Logic">
            {(logicNamespaces ?? []).map((ns) => <option key={ns} value={ns}>{ns}</option>)}
          </optgroup>
        </select>
        <button className="hf-btn hf-btn-primary" onClick={openCreate}>{createLabel}</button>
        <CaptionSizeSelector current={captionSize} onChange={setCaptionSize} />
      </div>

      <div className="hf-hint-bar">{shortcutsHint}</div>

      <div className="hf-content-area">
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem", overflow: "hidden" }}>

          {filterText ? (
            <>
              <div className="hf-section-header">{sectionSearch}</div>
              <SearchResultsTable
                rows={filteredRows}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                captionSize={captionSize}
              />
            </>
          ) : (
            <>
              <div className="hf-section-header">{sectionContent}</div>
              <RulesTable
                rows={contentRows}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                captionSize={captionSize}
                filterText=""
                filterStatus={filterStatus}
                filterSource={filterSource}
                filterNamespace={filterNamespace}
                showValue
              />

              <div className="hf-section-header">{sectionLogic}</div>
              <RulesTable
                rows={logicRows}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                captionSize={captionSize}
                filterText=""
                filterStatus={filterStatus}
                filterSource={filterSource}
                filterNamespace={filterNamespace}
              />

              {legacySectionVisible && legacyRows.length > 0 && (
                <div className="hf-legacy-section">
                  <div className="hf-legacy-header">
                    <div className="hf-legacy-title">{legacySectionTitle}</div>
                    <div className="hf-legacy-note">{legacySectionNote}</div>
                  </div>
                  <RulesTable
                    rows={legacyRows}
                    selectedPath={selectedPath}
                    onSelect={setSelectedPath}
                    captionSize={captionSize}
                    filterText=""
                    filterStatus={filterStatus}
                    filterSource={filterSource}
                    filterNamespace={filterNamespace}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <DetailPanel
          detail={detail}
          onEdit={openEdit}
          onDelete={handleDelete}
          onPromote={handlePromote}
        />
      </div>

      {modal && (
        <CreateEditModal
          mode={modal.type}
          initial={modal.type === "edit" ? modal.detail : null}
          onSave={handleSave}
          onCancel={closeModal}
        />
      )}

      {toast && (
        <div className="hf-toast">{toast}</div>
      )}
    </>
  );
}
