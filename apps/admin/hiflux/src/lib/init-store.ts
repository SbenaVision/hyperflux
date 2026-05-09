import { ruleStore } from "./ruleStore";
import { loadPersistedOverrides } from "./overridePersistence";
import type { DomainFile } from "@hyperflux/core";

// content/ — all user-facing text (labels, messages, button text, headers)
import uiContent       from "../../content/ui.json";
import actionsContent  from "../../content/actions.json";
import tableContent    from "../../content/table.json";
import statusContent   from "../../content/status.json";
import captionsContent from "../../content/captions.json";
import messagesContent from "../../content/messages.json";

// rules/ — business policy, config, display, validation, and dependency logic
import policyRules      from "../../rules/policy.json";
import configRules      from "../../rules/config.json";
import dependencyRules  from "../../rules/dependencies.json";
import permissionRules  from "../../rules/permissions.json";
import displayRules     from "../../rules/display.json";
import validationRules  from "../../rules/validation.json";

// lifecycle/ — guard, during, and after rules for registered addresses
import lifecycleDelete  from "../../lifecycle/delete.json";
import lifecycleCreate  from "../../lifecycle/create.json";
import lifecycleEdit    from "../../lifecycle/edit.json";
import lifecyclePromote from "../../lifecycle/promote.json";

// Source rules load synchronously at module init (idempotent across hot-reloads)
const g = globalThis as typeof globalThis & {
  _hifluxOverridesPromise?: Promise<void>;
};

if (ruleStore.getAll().length === 0) {
  const domainFiles = [
    uiContent,
    actionsContent,
    tableContent,
    statusContent,
    captionsContent,
    messagesContent,
    policyRules,
    configRules,
    dependencyRules,
    permissionRules,
    displayRules,
    validationRules,
    lifecycleDelete,
    lifecycleCreate,
    lifecycleEdit,
    lifecyclePromote,
  ] as unknown as DomainFile[];
  ruleStore.load(domainFiles, "hiflux");
}

// Overrides load once per process from the configured store (file or Upstash Redis).
// Cached as a promise so concurrent cold-start requests don't trigger duplicate loads.
if (!g._hifluxOverridesPromise) {
  g._hifluxOverridesPromise = loadPersistedOverrides()
    .then((overrides) => {
      for (const rule of overrides) {
        ruleStore.write(rule);
      }
    })
    .catch((err) => {
      console.error("[HyperFlux] Failed to load override store:", err);
    });
}

export { ruleStore };

export function ensureOverridesLoaded(): Promise<void> {
  return g._hifluxOverridesPromise ?? Promise.resolve();
}
