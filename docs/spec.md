# HyperFlux v0.1 — Implementation Specification

This document is the build specification for HyperFlux v0.1. Every requirement serves a single goal: **once a HyperFlux module is constructed, Claude can apply 80% of subsequent product changes by editing typed rule rows in under one minute, with fewer regressions than equivalent code edits.**

This spec is also the single source of truth. **HyperFlux is built using HyperFlux principles**: every behavioral decision lives either in this spec or in an externalized configuration file under `defaults/`. No hardcoded behavioral constants in source code. The framework eats its own dog food.

---

## 1. Self-consistency principle

HyperFlux teaches developers to externalize decisions out of code. The framework itself must obey this principle, or it has no credibility.

### 1.1 The rule

If a value or rule could plausibly change without changing the framework's interpretive logic, it lives in `defaults/` as data. The source code reads it at startup. Source code contains only the interpreter, the I/O, and the algorithms.

### 1.2 What this excludes from source

- Lint rule definitions
- CLI command definitions, aliases, descriptions, options
- Error code → message mappings
- Performance budgets (used by CI)
- Default file paths and watch patterns
- Project scaffolding templates
- DSL operator signatures
- Schema migration steps

### 1.3 What stays in source (legitimate code)

- The resolver's evaluation algorithm
- The lint analyzer's AST traversal
- Hot reload file watching
- React reconciliation hooks
- Type checking algorithm
- File I/O

### 1.4 Implementation constraint for Claude Code

Before adding any constant, string literal, magic number, or conditional based on a domain value to source code: ask whether it should live in `defaults/` instead. Default answer: yes.

---

## 2. Architectural decisions (explicit)

Every decision below is locked. If a decision needs to change, the spec changes first.

### 2.1 Storage

- **Decision**: JSON files, one per domain, in `rules/`.
- **Why**: Human-readable, git-diffable, natively valid in TypeScript and JavaScript, parseable by Claude with zero ambiguity. YAML adds a parser dependency and indentation pitfalls. TOML lacks nested array ergonomics.
- **Locked**.

### 2.2 Schema validation library

- **Decision**: Zod.
- **Why**: Strongest TypeScript ergonomics, widest adoption, runtime-and-compile-time types from one definition, Claude reads Zod schemas reliably. Alternatives (io-ts, valibot, ArkType) are credible but less universally known.
- **Locked**.

### 2.3 Rule path syntax

- **Decision**: Lowercase, dot-separated, snake_case segments. First segment matches the domain file name.
- **Why**: Predictable for Claude, namespacing is structural, file-domain mapping is explicit and verifiable.
- **Locked**.

### 2.4 Expression representation

- **Decision**: Expressions are JSON object trees with discriminator fields, never strings.
- **Why**: Strings need parsing and escaping; object trees are unambiguous, type-safe via Zod, and trivially editable by Claude. Eliminates an entire class of parse errors.
- **Locked**.

### 2.5 DSL purity

- **Decision**: All DSL functions must be pure (deterministic, no I/O, no mutation, no async).
- **Why**: Pure functions are cacheable, testable in isolation, debuggable through traces, and language-portable. Impurity breaks all four properties.
- **Locked**.

### 2.6 Cache key

- **Decision**: Canonical JSON serialization with sorted keys, recursively. Cache key is `path + "::" + canonicalJSON(inputs)`.
- **Why**: JavaScript object key order is not guaranteed across all edge cases. Canonical serialization is deterministic.
- **Locked**.

### 2.7 React integration mode

- **Decision**: Behavior mode only. Hooks (`useRule`, `useRuleStream`) inside normal React components. No declarative whole-page rendering.
- **Why**: The 80/80/1 goal is about post-construction edit speed. Whole-page rendering is a construction-time feature that turns HyperFlux into a UI framework, dramatically expanding scope without serving the goal.
- **Locked for v0.1**.

### 2.8 Effects

- **Decision**: No pre/post effects on rules in v0.1.
- **Why**: Effects break purity. Without them, every rule edit is fully reversible and trivially testable. The benchmark applications don't need them.
- **Locked for v0.1**.

### 2.9 Type checking depth

- **Decision**: Shallow only. Verify operator argument types, function signature matches, top-level case output type. No deep inference through nested object access or rule reference chains.
- **Why**: Deep inference is engineering luxury. Shallow checks catch the common errors fast, which is what serves the 1-minute edit goal.
- **Locked for v0.1**.

### 2.10 Discipline enforcement

- **Decision**: `hf lint` is the structural enforcement mechanism. CLAUDE.md is a complement, not the primary defense.
- **Why**: Prose discipline degrades over long contexts and across model versions. Static analysis that runs in CI and pre-commit does not degrade.
- **Locked**.

### 2.11 Runtime targets

- **Decision**: Node.js ≥ 20 and Bun ≥ 1.1. No native dependencies.
- **Why**: Both runtimes execute TypeScript, both are widely deployed, and Bun is owned by Anthropic (relevant alignment for Claude-tooling adjacency).
- **Locked for v0.1**.

### 2.12 Testing

- **Decision**: Vitest for unit tests. Snapshot tests for rules.
- **Why**: Vitest has the strongest TS ergonomics and Vite-compatible setup. Snapshot tests make rule changes auto-document expected behavior.
- **Locked for v0.1**.

### 2.13 Monorepo layout

- **Decision**: pnpm workspaces.
- **Why**: Fastest installs, strict workspace boundaries, native TypeScript support.
- **Locked for v0.1**.

### 2.14 Versioning

- **Decision**: Semantic versioning. v0.x is unstable; breaking changes allowed. v1.0.0 commits to the public API.
- **Locked**.

### 2.15 License

- **Decision**: MIT.
- **Why**: Maximum adoption, no commercial constraints, no patent disputes, aligns with the goal of saving tokens at scale (not building a startup).
- **Locked**.

---

## 3. Scope

### 3.1 In scope (v0.1)

JSON rule store organized by domain. Zod schema. Pure expression DSL. Resolver with per-request memoization. React adapter (hooks only). `hf lint` as static analyzer. CLI tool (`validate`, `test`, `new`, `lint`, `trace`). CLAUDE.md template. Snapshot test harness. Hot reload (dev). Reference application + 20-change benchmark.

### 3.2 Out of scope (v0.1)

Whole-page declarative rendering. Effects. Early-mode compiler. SQL/query rules. Self-hosting at runtime. Cross-language regeneration. Visual rule editor. Multi-tenancy. Web-based trace UI. Plugin system. Deep type inference.

### 3.3 Non-functional targets

- Cached rule evaluation: under 1 ms
- Uncached rule evaluation: under 5 ms
- Rule store load: under 200 ms for 1,000 rules
- `hf lint` runtime: under 2 seconds on 5,000-line codebase
- Hot reload: under 1 second from save

These targets live in `defaults/performance-budgets.json`. CI reads them and fails on regression.

---

## 4. The rule

### 4.1 Schema (Zod)

```typescript
import { z } from "zod";

export const TypeSpec = z.discriminatedUnion("type", [
  z.object({ type: z.literal("string") }),
  z.object({ type: z.literal("number") }),
  z.object({ type: z.literal("boolean") }),
  z.object({ type: z.literal("null") }),
  z.object({ type: z.literal("object"), shape: z.record(z.string(), z.lazy(() => TypeSpec)) }),
  z.object({ type: z.literal("array"), items: z.lazy(() => TypeSpec) }),
  z.object({ type: z.literal("any") }),
]);

export const Expression = z.union([
  z.object({ kind: z.literal("literal"), value: z.unknown() }),
  z.object({ kind: z.literal("input"), path: z.array(z.string()) }),
  z.object({ kind: z.literal("rule"), path: z.string(), args: z.array(z.lazy(() => Expression)).optional() }),
  z.object({ kind: z.literal("fn"), name: z.string(), args: z.array(z.lazy(() => Expression)) }),
  z.object({ kind: z.literal("op"), op: z.string(), args: z.array(z.lazy(() => Expression)) }),
]);

export const Case = z.object({
  when: Expression.optional(),
  then: Expression,
});

export const Rule = z.object({
  path: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
  kind: z.enum(["compute", "config"]),
  inputs: z.array(z.object({ name: z.string(), type: TypeSpec })),
  output: TypeSpec,
  cases: z.array(Case).min(1),
  metadata: z.object({
    version: z.string(),
    requires: z.array(z.string()).default([]),
    domain: z.string(),
    description: z.string().optional(),
  }),
});
```

The `op` enum in `Expression` is **not hardcoded** — it is read from `defaults/operators.json` at startup. See section 5.

### 4.2 Rule kinds

- **`compute`** — computes a value of any declared output type.
- **`config`** — static configuration. Single default case, no inputs.

### 4.3 Path conventions

Lowercase, dot-separated, snake_case segments. First segment is the domain. Rules in `rules/<domain>.json` must have paths starting with `<domain>.`.

### 4.4 Case evaluation

In array order. First matching `when` wins. Default case (no `when`) must be last. No match and no default → `NoMatchingCaseError`.

---

## 5. The DSL

### 5.1 Operators (externalized)

Operator definitions live in `defaults/operators.json`:

```json
{
  "operators": [
    { "op": "==", "arity": 2, "input_types": ["any", "any"], "output_type": "boolean" },
    { "op": "!=", "arity": 2, "input_types": ["any", "any"], "output_type": "boolean" },
    { "op": "<",  "arity": 2, "input_types": ["number", "number"], "output_type": "boolean" },
    { "op": "<=", "arity": 2, "input_types": ["number", "number"], "output_type": "boolean" },
    { "op": ">",  "arity": 2, "input_types": ["number", "number"], "output_type": "boolean" },
    { "op": ">=", "arity": 2, "input_types": ["number", "number"], "output_type": "boolean" },
    { "op": "+",  "arity": 2, "input_types": ["number", "number"], "output_type": "number" },
    { "op": "-",  "arity": 2, "input_types": ["number", "number"], "output_type": "number" },
    { "op": "*",  "arity": 2, "input_types": ["number", "number"], "output_type": "number" },
    { "op": "/",  "arity": 2, "input_types": ["number", "number"], "output_type": "number" },
    { "op": "%",  "arity": 2, "input_types": ["number", "number"], "output_type": "number" },
    { "op": "AND", "arity": "n", "min": 2, "input_types": "boolean", "output_type": "boolean" },
    { "op": "OR",  "arity": "n", "min": 2, "input_types": "boolean", "output_type": "boolean" },
    { "op": "NOT", "arity": 1, "input_types": ["boolean"], "output_type": "boolean" }
  ]
}
```

The resolver and the type checker both read this file. Adding an operator in v0.2 requires editing this file, not the source.

### 5.2 Function registry

Functions are registered by user code in `hyperflux.config.ts` via `hf.registerFunction({ name, inputs, output, implementation })`. Registered functions must be pure.

### 5.3 Type checking (shallow)

At load time, the resolver verifies:
- Operator arg counts and types match `defaults/operators.json`
- Function call arg counts and types match registered signature
- Top-level `then` expression's surface type matches rule `output` type
- Rule references resolve to existing paths
- Function references resolve to registered names

Deeper errors (e.g., wrong field on a nested object passed to a function) surface at evaluation time.

---

## 6. The rule store

### 6.1 File layout

```
project-root/
  rules/
    pricing.json
    ui.json
    validation.json
    config.json
  hyperflux.config.ts
  .hyperfluxrc.json
```

### 6.2 File format

```json
{
  "domain": "pricing",
  "version": "1",
  "rules": [
    { "path": "pricing.atm.fee", "kind": "compute", "inputs": [...], "output": {...}, "cases": [...], "metadata": {...} }
  ]
}
```

Loader rejects domain/filename mismatches and path/domain mismatches.

### 6.3 Loading

Scan, validate, build index, build dependency graph, reject cycles, shallow type-check. Any failure aborts startup with a clear error citing the offending rule.

### 6.4 Hot reload (dev only)

Watch `rules/`, re-validate on change, atomic swap on success. Failed reload preserves previous rules. Disabled in production. The watch glob lives in `defaults/watch-patterns.json`.

---

## 7. The resolver

### 7.1 Public API

```typescript
class Resolver {
  constructor(options: ResolverOptions);
  evaluate<T>(path: string, inputs: Record<string, unknown>, ctx?: RequestContext): T;
  evaluateAs<T>(path: string, expectedType: TypeSpec, inputs: Record<string, unknown>, ctx?: RequestContext): T;
}

class RequestContext {
  // Per-request cache and trace recording
}
```

### 7.2 Algorithm

Look up rule. Validate inputs. Compute canonical cache key. Check request cache. Iterate cases until match. Validate case output against declared output type. Cache and return.

### 7.3 Cache key

Canonical JSON serialization with sorted keys, recursively. Symbols and functions in inputs are rejected; inputs must be plain JSON-serializable values.

### 7.4 Errors

Error codes and messages live in `defaults/errors.json`:

```json
{
  "errors": {
    "RULE_NOT_FOUND": { "code": "HF001", "message": "Rule '{path}' not found" },
    "INPUT_TYPE_ERROR": { "code": "HF002", "message": "Input '{name}' type mismatch in rule '{path}': expected {expected}, got {actual}" },
    "OUTPUT_TYPE_ERROR": { "code": "HF003", "message": "Case {caseIndex} output type mismatch in rule '{path}': expected {expected}, got {actual}" },
    "NO_MATCHING_CASE": { "code": "HF004", "message": "No matching case in rule '{path}' and no default present" },
    "FUNCTION_NOT_REGISTERED": { "code": "HF005", "message": "Function '{name}' not registered (referenced in rule '{path}')" },
    "RULE_CYCLE": { "code": "HF006", "message": "Cyclic rule dependency detected: {cycle}" }
  }
}
```

### 7.5 Trace

When `recordTrace: true`, the resolver builds a tree:

```typescript
type TraceNode = {
  path: string;
  inputs: Record<string, unknown>;
  output: unknown;
  caseIndex: number;
  timeMs: number;
  cached: boolean;
  children: TraceNode[];
};
```

---

## 8. React adapter

### 8.1 Hooks

```typescript
useRule<T>(path: string, inputs: Record<string, unknown>): T
useRuleStream<T>(path: string, inputs: Record<string, unknown>): { value: T; loading: boolean; error?: Error }
```

`useRule` is synchronous. `useRuleStream` handles registered async function calls (deferred for v0.2 if too complex; minimal sync version sufficient for v0.1 benchmark).

### 8.2 Out of scope

No `<RuleView>`, no component registry, no declarative composition.

---

## 9. `hf lint`

### 9.1 Lint rules (externalized)

Lint rule definitions live in `defaults/lint-rules.json`. Each is itself a HyperFlux-style rule, applied to the codebase.

```json
{
  "rules": [
    {
      "id": "no-hardcoded-copy",
      "severity_default": "error",
      "scope": "src",
      "description": "User-facing string literals should be in a copy rule.",
      "patterns": [
        { "match": "string-literal-in-jsx-text", "exclude": ["test", "story"] },
        { "match": "string-literal-passed-as-children", "exclude": [] }
      ],
      "suggestion": "Replace with useRule('copy.<domain>.<key>')"
    },
    {
      "id": "no-magic-numbers",
      "severity_default": "warn",
      "scope": "src",
      "description": "Numeric literals in conditional expressions should be config rules.",
      "patterns": [
        { "match": "number-literal-in-binary-comparison", "exclude": ["0", "1", "-1"] }
      ],
      "suggestion": "Move to a config rule: useRule('config.<domain>.<key>')"
    },
    {
      "id": "no-inline-business-comparisons",
      "severity_default": "error",
      "scope": "src",
      "description": "Comparing fields against domain string literals belongs in a rule.",
      "patterns": [
        { "match": "string-equality-against-domain-enum" }
      ],
      "suggestion": "Move to an eligibility or compute rule"
    },
    {
      "id": "no-hardcoded-date-format",
      "severity_default": "error",
      "scope": "src",
      "description": "Date format strings should be config rules.",
      "patterns": [
        { "match": "date-format-string-literal" }
      ]
    },
    {
      "id": "rules-no-cycles",
      "severity_default": "error",
      "scope": "rules",
      "description": "Rules must not have cyclic dependencies."
    },
    {
      "id": "rules-no-orphans",
      "severity_default": "error",
      "scope": "rules",
      "description": "Every referenced rule path must exist."
    },
    {
      "id": "rules-no-unused",
      "severity_default": "warn",
      "scope": "rules",
      "description": "Defined rules must be referenced from somewhere."
    },
    {
      "id": "rules-domain-match",
      "severity_default": "error",
      "scope": "rules",
      "description": "Rule path domain must match file name."
    }
  ]
}
```

### 9.2 Project-level overrides

`.hyperfluxrc.json` at project root overrides defaults:

```json
{
  "lint": {
    "src_globs": ["src/**/*.ts", "src/**/*.tsx"],
    "rule_globs": ["rules/**/*.json"],
    "ignore": ["src/legacy/**"],
    "overrides": {
      "no-magic-numbers": "off",
      "no-hardcoded-copy": "warn"
    }
  }
}
```

### 9.3 Output

```
src/components/UserList.tsx:42:16
  error  no-magic-numbers  Numeric literal '5' in conditional. Move to config rule.
  hint   Try: useRule('config.users.high_value_threshold')

rules/pricing.json:12
  error  rules-domain-match  Path 'discounts.vip' does not start with domain 'pricing'.
```

### 9.4 Auto-fix

`hf lint --fix` applies unambiguous fixes:
- Hardcoded copy → extracts to `copy.<domain>.<key>` config rule, replaces with `useRule(...)`
- Magic number → extracts to `config.<domain>.<key>` rule

Ambiguous fixes are not applied; lint surfaces a hint instead.

---

## 10. Trace viewer (CLI)

```
hf-trace [file] [--grep <pattern>] [--slow <ms>] [--depth <n>] [--verbose]
```

CLI command structure lives in `defaults/cli-commands.json`. Adding a flag changes that file, not the CLI source.

---

## 11. CLAUDE.md (template)

Lives in `templates/claude-md.template`. Generated into a project on `npx hf init`.

```markdown
# HyperFlux Project Constraints

This project uses HyperFlux. Application logic lives in typed rules under `rules/`, not in code.

## You MUST

1. Express business logic, validation, conditional UI, copy, configuration, and thresholds as rules in `rules/<domain>.json`.
2. Run `npx hf lint` after any change. All errors must be fixed before commit.
3. Run `npx hf test` after rule changes. Snapshot tests must pass.
4. When a rule needs computation the DSL cannot express, register a typed pure function in `hyperflux.config.ts` and call it via `fn:name(...)`.
5. Add or update a snapshot test in `tests/rules/` whenever a rule is added or modified.

## You MUST NOT

1. Add business logic, conditional copy, validation rules, or threshold values as code in `src/`. Lint will reject this.
2. Bypass schema validation by editing rule JSON manually without running `hf validate`.
3. Add new rule kinds, operators, or expression forms. The DSL is fixed in v0.1.
4. Write impure functions and register them as DSL functions.

## Process for any change

1. Determine: rule edit, function registration, or actual code?
2. If rule edit: locate domain file, modify case, validate, test.
3. If actual code: run `hf lint` first to confirm no business logic is being added.
4. If lint fails: extract the logic to a rule.

If unsure, ask before editing.
```

---

## 12. Functional requirements

Each REQ is testable. Implementation is complete when all pass.

### 12.1 Schema and loading

- **REQ-001** Loading a valid rule file registers all rules.
- **REQ-002** Domain/filename mismatch fails loading.
- **REQ-003** Path/domain mismatch fails loading.
- **REQ-004** Duplicate paths fail loading.
- **REQ-005** Reference to unknown rule path fails loading.
- **REQ-006** Reference to unregistered function fails loading.
- **REQ-007** Cyclic dependencies fail loading.
- **REQ-008** Shallow type errors fail loading.
- **REQ-009** Operator definitions are read from `defaults/operators.json` at startup, not hardcoded.

### 12.2 Resolver

- **REQ-101** Valid evaluation returns a value matching declared output type.
- **REQ-102** Input type mismatch throws `InputTypeError` (HF002).
- **REQ-103** Cases evaluate in order; first match wins.
- **REQ-104** No match + no default throws `NoMatchingCaseError` (HF004).
- **REQ-105** Same `(path, inputs)` within `RequestContext` produces a cache hit.
- **REQ-106** Cache key is independent of input object key order.
- **REQ-107** Different `RequestContext` instances do not share cache.
- **REQ-108** 1,000 cached evaluations complete in under 100 ms.
- **REQ-109** Error messages are read from `defaults/errors.json`, not hardcoded.

### 12.3 React adapter

- **REQ-201** `useRule` returns evaluated value synchronously.
- **REQ-202** `useRule` re-renders when inputs change.
- **REQ-203** `useRuleStream` returns `{ value, loading, error }`.

### 12.4 Trace

- **REQ-301** Enabled trace records every rule evaluation.
- **REQ-302** Trace nodes include path, inputs, output, case index, time, cached, children.
- **REQ-303** `hf-trace` renders trace as readable tree.
- **REQ-304** `hf-trace` supports `--grep`, `--slow`, `--depth`, `--verbose`.

### 12.5 Lint

- **REQ-401** `hf lint` reads rule definitions from `defaults/lint-rules.json`.
- **REQ-402** Project overrides in `.hyperfluxrc.json` are honored.
- **REQ-403** Lint detects all rule violations declared in `defaults/lint-rules.json` and configurable in projects.
- **REQ-404** Lint runs in under 2 seconds on a 5,000-line codebase.
- **REQ-405** `hf lint --fix` applies unambiguous fixes; ambiguous ones surface hints.
- **REQ-406** Lint exits non-zero when errors are present, zero otherwise.

### 12.6 Hot reload

- **REQ-501** Dev mode: rule file change takes effect within 1 second.
- **REQ-502** Failed reload preserves previous rules and logs error.
- **REQ-503** Production mode: hot reload disabled.

### 12.7 CLI

- **REQ-601** `npx hf validate` exits 0 when valid, non-zero otherwise.
- **REQ-602** `npx hf test` runs snapshot tests.
- **REQ-603** `npx hf new <domain> <name>` scaffolds a new rule using `templates/rule.template`.
- **REQ-604** `npx hf init` scaffolds a new project using `templates/`.
- **REQ-605** CLI command structure is read from `defaults/cli-commands.json`.

### 12.8 Self-consistency

- **REQ-701** No source file in `packages/` contains hardcoded user-facing strings, magic numbers in conditionals, or hardcoded behavioral constants. All such values live under `defaults/`.
- **REQ-702** Running `hf lint` on the HyperFlux source itself produces zero errors.
- **REQ-703** Modifying `defaults/operators.json`, `defaults/errors.json`, or `defaults/lint-rules.json` and restarting changes framework behavior accordingly without recompilation.

---

## 13. Repository layout

```
hyperflux/
  packages/
    core/                  # resolver, schema, DSL evaluator, loader, trace
      src/
      tests/
    react/                 # useRule, useRuleStream
      src/
      tests/
    lint/                  # hf lint analyzer (AST traversal, rule application)
      src/
      tests/
    cli/                   # hf command-line tool
      src/
      tests/
  defaults/                # HF's own externalized configuration
    operators.json         # DSL operator definitions
    errors.json            # error codes and messages
    lint-rules.json        # lint rule definitions
    cli-commands.json      # CLI command structure
    performance-budgets.json  # perf targets for CI
    watch-patterns.json    # default watch globs
  templates/               # scaffolding templates
    claude-md.template
    hyperflux-config.template
    rule-domain.template
    rule-single.template
    snapshot-test.template
    reference-app/         # whole reference app as template tree
  examples/
    reference-app/         # built-out reference application for benchmarking
  benchmark/
    vanilla/               # vanilla React version of reference app
    hyperflux/             # HyperFlux version
    changes/               # 20-change definitions
    runner.ts
    results/
  docs/
    manifesto.md
    spec.md                # this document
    quickstart.md
    decisions.md           # decision log (mirrors section 2)
  .hyperfluxrc.json        # HF's own lint config (lints itself)
  pnpm-workspace.yaml
  package.json
  README.md
  LICENSE                  # MIT
```

---

## 14. Benchmark protocol

### 14.1 Reference application

Small admin dashboard, ~3,000 LOC vanilla. Authenticated routing. Dashboard with three widgets (revenue, users, alerts). User detail with editable profile. Pricing rules page. Settings page.

### 14.2 The 20 changes

Each is a one-sentence prompt, applied to both versions via Claude Code.

1. Change all "Submit" button labels to "Save"
2. Add a "deactivated" status filter to user list
3. Hide alerts widget when count < 3
4. Add 5% discount for VIP customers
5. Default timezone to browser-detected
6. Add email format validation to user profile form
7. Add confirmation dialog before deactivating a user
8. Hide pricing rules page from non-admin users
9. Sort user list by last-active by default
10. Add "high-value" badge for users with revenue > $10,000
11. Refresh alerts widget every 30 seconds
12. Add tooltip explaining discount stacking
13. Change date format from MM/DD/YYYY to YYYY-MM-DD
14. Add maintenance mode banner controlled by setting
15. Show warning if user hasn't logged in for 90 days
16. Add "copy ID" button next to user IDs
17. Change password requirement from 8 to 12 characters
18. Add notification preference for "weekly summary email"
19. Show "deleted" tag on archived users
20. Add site-wide setting to disable email notifications

### 14.3 Measurement

For each change on each codebase: tokens consumed, wall-clock time, LOC touched, regression count.

### 14.4 Publication

Results in `benchmark/results/`: summary CSV, raw transcripts, aggregate analysis.

---

## 15. Implementation order

1. **Days 1–2**: `defaults/` files (operators, errors, lint-rules, cli-commands, performance-budgets). Schema. Loader. Basic resolver. REQ-001 to REQ-009.
2. **Days 3–4**: Caching (canonical key), trace recording, error handling. REQ-101 to REQ-109.
3. **Days 5–6**: React adapter (useRule, useRuleStream). REQ-201 to REQ-203.
4. **Days 7–10**: `hf lint` (the most novel piece — invest most engineering here). REQ-401 to REQ-406.
5. **Days 11–12**: CLI (validate, test, new, lint, trace, init), hot reload. REQ-301 to REQ-605.
6. **Days 13–14**: CLAUDE.md template, project scaffold (`templates/`). Self-lint pass on HF itself. REQ-701 to REQ-703.
7. **Week 3**: Build reference app — vanilla version.
8. **Week 4**: Build reference app — HyperFlux version.
9. **Week 5**: Run benchmark, analyze, publish.

---

## 16. Acceptance for v0.1

Complete when:

1. All REQs pass.
2. `hf lint` run on HyperFlux source produces zero errors (REQ-702 passes — HF lints itself clean).
3. Reference app exists in both versions.
4. Benchmark applied, measured, and published with raw transcripts.
5. Documentation complete (manifesto, this spec, quickstart, decisions log).

If the benchmark contradicts the 80/80/1 claim, results ship anyway. The framework becomes a research artifact.

---

End of specification.
