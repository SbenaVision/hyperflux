# HyperFlux Foundational Framework — Engineering Spec v0.1

**Status:** RFC — for internal review  
**Author:** SBA  
**Date:** 2026-05-06

---

## 1. Problem Statement

HyperFlux today is an engine. It externalizes decisions (business logic, labels, config, lifecycle guards) into rules that can be changed without a redeploy. This is the right idea.

The problem: an engine alone only addresses ~25–30% of development work — the decision layer. The remaining 70% (components, routing, data fetching, forms, tables, modals, navigation) is still written from scratch by every developer, every time, in whatever way they feel like. The result is drift, inconsistency, and a codebase that grows with every feature instead of shrinking.

**Our goal is aggressive and non-negotiable:**
- 80% reduction in development time for new applications
- 80% reduction in tokens required to implement a change
- Changes to behavior happen in rules, not in code — no rebuild, no redeploy, no PR

We are not meeting this goal today. The current HyperFlux repository has ~10,000 lines of code and ~200 externalized rules. That ratio is inverted from where it needs to be for a developer building on top of HyperFlux.

This spec defines the strategy to fix that.

---

## 2. Terminology (agreed, non-negotiable)

| Term | Definition |
|---|---|
| **HyperFlux Core** | The engine: resolver, rule store, lifecycle, trace, expressions. Stable infrastructure. Rarely changes. |
| **HyperFlux UI** | A library of rule-driven primitive components: Table, Form, Modal, Nav, Toolbar, DetailPanel. Every behavior reads from rules. No hardcoded decisions. |
| **HyperFlux Shell** | The starter application template a developer clones to begin a new project. Structured as 90% rules, 10% wiring code. |
| **HyperFlux Component** | Any component created via `createHyperFluxComponent()`. This is the enforced pattern for all UI in any app built on HyperFlux. |
| **hf migrate** | The AI-powered CLI tool that scans an existing application and produces rule files + replaces hardcoded values with `useRule()` calls. |
| **Rule path** | A dot-notation address for a rule value, e.g. `ui.submit_button.label`. The component reads this; the rule holds the value. |

---

## 3. Architecture

### 3.1 Current State

```
@hyperflux/core          — engine (resolver, lifecycle, trace)
@hyperflux/react         — useRule, useContent, useRuleStream hooks
apps/admin/hiflux        — dogfood admin app (proof of concept)
packages/lint            — Analyzer, FixEngine
packages/cli             — hf commands
```

### 3.2 Target State

```
@hyperflux/core          — engine (unchanged, minimal surface)
@hyperflux/react         — hooks (unchanged)
@hyperflux/ui            — NEW: rule-driven primitive component library
@hyperflux/eslint        — NEW: enforcement plugin
apps/admin/hiflux        — refactored to consume @hyperflux/ui
apps/shell               — NEW: starter template
packages/lint            — existing
packages/cli             — extended with hf migrate
```

Nothing in Core changes. Everything new is additive.

---

## 4. The Core Enforcement Mechanism

### 4.1 The Problem With Opt-In

Every existing state management approach — XState, reducers, Zustand, HyperFlux rules — shares one fatal weakness: **opt-in**. A developer can write a component that ignores the system entirely. Nothing stops them. The system works only when developers remember to use it.

This is unacceptable for a framework that promises structural consistency.

### 4.2 The Solution: `createHyperFluxComponent()`

Every component in a HyperFlux application — whether from `@hyperflux/ui` or written by the developer — must be created through the `createHyperFluxComponent()` factory.

```typescript
// What a developer writes
const SubmitButton = createHyperFluxComponent("ui.submit_button", (rules) => (
  <button disabled={!rules.enabled}>
    {rules.label}
  </button>
));
```

The factory:
- Binds the component to a rule namespace
- Injects all rule values as a typed `rules` prop — no raw `useRule` calls in the component body
- Connects the component to the lifecycle engine for state transitions
- Registers the component in the HyperFlux component registry (visible in the admin)

A component created outside this factory has no access to the rule system. It is structurally isolated from HyperFlux.

### 4.3 ESLint Enforcement

`@hyperflux/eslint` ships one rule: **`hyperflux/enforce-component-factory`**.

It does one thing: scans every `.tsx` file in the application and verifies that every exported component is created via `createHyperFluxComponent()`. If not, the build fails.

```
✗ src/components/SubmitButton.tsx
  Component 'SubmitButton' is not a HyperFlux component.
  Wrap it with createHyperFluxComponent() or it will not be enforced.
  [hyperflux/enforce-component-factory]
```

This runs as part of `hf lint` and is wired into the pre-commit hook by the Shell template. A developer cannot commit a non-HyperFlux component.

**This is the structural enforcement.** It is the functional equivalent of "every class must extend the base class" — the right mechanism for a React/TypeScript environment.

### 4.4 Why Not Class Inheritance

React function components cannot extend a class. More importantly, a class-based state machine bakes states into code — the exact opposite of HyperFlux's goal. The `createHyperFluxComponent()` factory is the base class, expressed as a function.

---

## 5. `@hyperflux/ui` — The Primitive Library

### 5.1 Scope

Six primitives cover 80% of application UI needs:

| Component | Rule namespace | Description |
|---|---|---|
| `HFTable` | `ui.table.*` | Sortable, filterable data table. Columns, labels, actions — all from rules. |
| `HFForm` | `ui.form.*` | Form with field definitions, validation rules, submit behavior — all from rules. |
| `HFModal` | `ui.modal.*` | Modal dialog. Title, content, confirm/cancel labels, blocking conditions — from rules. |
| `HFNav` | `ui.nav.*` | Navigation bar. Links, labels, active state logic, visibility — from rules. |
| `HFDetailPanel` | `ui.detail.*` | Side panel showing entity detail. Fields, actions, layout — from rules. |
| `HFToolbar` | `ui.toolbar.*` | Action bar with search, filters, buttons — all from rules. |

### 5.2 Source

These components already exist — in `apps/admin/hiflux/src/components/`. `RulesTable`, `DetailPanel`, `CreateEditModal`, `Nav`, and the toolbar in `rules/page.tsx` are the prototypes. Phase 1 is extraction and generalization, not invention.

### 5.3 What "Rule-Driven" Means in Practice

A developer using `HFTable` writes no column definitions in code. They write this:

```json
// rules/ui.json
{
  "path": "ui.users_table.columns",
  "kind": "compute",
  "output": { "type": "array", "items": { "type": "string" } },
  "cases": [{ "then": { "kind": "literal", "value": ["name", "email", "role", "status"] } }]
}
```

They change columns by editing the rule. No code change. No redeploy.

---

## 6. `apps/shell` — The Starter Template

The Shell is what a developer clones to start a new project. Its structure:

```
apps/shell/
  rules/           — all business logic lives here
    ui.json        — labels, column defs, form fields
    config.json    — thresholds, feature flags, settings
    policy.json    — permissions, visibility
    lifecycle/     — before/during/after guards
  src/
    app/           — routing only (minimal)
    pages/         — thin wiring files that mount HF components
  content/         — copy strings
```

A developer's entire job is:
1. Define their rules in `rules/`
2. Mount the appropriate `@hyperflux/ui` components in `pages/`
3. Write only what is genuinely unique to their domain

Everything else — state management, transitions, validation, copy, config — is in rules.

---

## 7. The State Machine

This section addresses the question: *how is state machine behavior enforced across all components?*

HyperFlux's state machine is not in a class. It is in two places:

**Rules** — define what is true in any given state:
- `policy.form.submittable` → `true` or `false` based on current inputs
- `ui.button.label` → changes based on `status` input
- `config.retry.max_attempts` → externalized threshold

**Lifecycle engine** — enforces valid transitions:
- `before` → validates the transition is allowed (blocks with reason if not)
- `during` → executes the transition
- `after` → records the audit trail, triggers side effects

Every `HyperFluxComponent` has access to both. The developer declares state transitions as lifecycle addresses in `lifecycle/manifest.json`. The engine enforces them. No transition can happen outside the engine.

A component that is not a `HyperFluxComponent` has no access to either. The ESLint rule ensures no such component can be committed.

**This is the enforcement.** Not a base class. A factory + a lint rule + an engine.

---

## 8. Delivery Plan

### Phase 1 — Extract `@hyperflux/ui` (2–3 weeks)
- Move admin components into `packages/ui/`
- Generalize them from admin-specific to domain-agnostic
- Implement `createHyperFluxComponent()` factory
- Wire existing admin to consume `@hyperflux/ui`
- **Exit criteria:** Admin runs identically using the new package

### Phase 2 — `@hyperflux/eslint` (1 week)
- Build `hyperflux/enforce-component-factory` lint rule
- Integrate into `hf lint`
- Add pre-commit hook to Shell template
- **Exit criteria:** Non-HyperFlux component fails build

### Phase 3 — `apps/shell` (1 week)
- Build the starter template using `@hyperflux/ui`
- Document the developer workflow (write rules → mount components → ship)
- **Exit criteria:** A new developer can clone Shell and have a running rule-driven app in under 30 minutes

### Phase 4 — `hf migrate` (3–4 weeks)
- AI-powered scanner: finds hardcoded values, generates rule files, rewrites callsites
- Produces a migration PR for review
- **Exit criteria:** benchmark/vanilla app migrated to HyperFlux Shell via `hf migrate` with no manual edits

---

## 9. What This Does NOT Do

To keep scope clear:

- Does not change `@hyperflux/core` — the engine is not touched
- Does not generate backend code — HyperFlux is a frontend/decision layer framework
- Does not replace a design system — `@hyperflux/ui` is structural, not styled; it integrates with shadcn, Tailwind, or any design system
- Does not enforce backend patterns — state machine enforcement applies to the UI layer only

---

## 10. Success Metrics

A new application built on HyperFlux Shell should achieve:

| Metric | Target |
|---|---|
| Lines of code written by developer | < 500 for a standard CRUD app |
| % of changes achievable without code edit | > 80% |
| Time to first working app from clone | < 30 minutes |
| Components that bypass the rule system | 0 (enforced by lint) |
| Hardcoded strings in developer code | 0 (enforced by lint) |

---

## 11. Open Questions for Engineering Review

1. Should `createHyperFluxComponent()` be a HOC, a factory function, or a class decorator? What are the tradeoffs for testing?
2. How does `HFForm` handle domain-specific validation that can't be expressed in a rule? Is there an escape hatch, and if so, how do we prevent it from becoming the default?
3. Should the ESLint rule be a hard build failure or a warning with a grace period for migration?
4. How do we handle third-party components (shadcn, Radix) that are not HyperFlux components by definition?
5. What is the versioning contract between `@hyperflux/ui` and `@hyperflux/core`? How do we prevent breaking changes?
