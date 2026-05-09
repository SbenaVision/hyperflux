export interface ShortcutDef {
  key: string;
  ctrlOrMeta?: boolean;
  action: string;
  description: string;
}

export interface ShortcutOverrides {
  create?: string;
  edit?: string;
  delete?: string;
  close?: string;
}

export function buildShortcuts(overrides: ShortcutOverrides): ShortcutDef[] {
  return [
    { key: overrides.create ?? "n",      action: "create",  description: "New rule" },
    { key: overrides.edit   ?? "e",      action: "edit",    description: "Edit selected" },
    { key: overrides.delete ?? "d",      action: "delete",  description: "Delete selected" },
    { key: "s", ctrlOrMeta: true,        action: "save",    description: "Save" },
    { key: overrides.close  ?? "Escape", action: "escape",  description: "Cancel / close" },
  ];
}

export function registerShortcuts(
  handlers: Partial<Record<string, () => void>>,
  shortcuts: ShortcutDef[] = buildShortcuts({})
): () => void {
  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      if (e.key !== "Escape") return;
    }
    for (const s of shortcuts) {
      const modMatch = s.ctrlOrMeta
        ? e.ctrlKey || e.metaKey
        : !e.ctrlKey && !e.metaKey && !e.altKey;
      if (e.key === s.key && modMatch) {
        const handler = handlers[s.action];
        if (handler) {
          e.preventDefault();
          handler();
          return;
        }
      }
    }
  }
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}
