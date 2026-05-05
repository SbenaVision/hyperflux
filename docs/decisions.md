# HyperFlux v0.1 — Architectural Decision Log

This file records every significant architectural decision made during the
v0.1 engineering specification, including decisions locked in the spec (§2)
and new decisions made during TypeScript type design. If a decision needs to
change, update this file first, then update the spec, then update the code.

---

## Decisions locked in spec §2 (reproduced here for navigation)

### ADR-001 — Storage format: JSON files per domain

**Status**: Locked  
**Decision**: Rule files are JSON, one file per domain, under `rules/`.  
**Why**: Human-readable, git-diffable, natively valid in JS/TS, zero-ambiguity parsing by Claude. YAML adds a dependency and indentation pitfalls; TOML lacks nested array ergonomics.

---

### ADR-002 — Schema validation: Zod

**Status**: Locked  
**Decision**: Zod v3 for all schema validation.  
**Why**: Strongest TypeScript ergonomics (type and runtime from one definition), widest adoption, Claude reads Zod schemas reliably.

---

### ADR-003 — Rule path syntax: dot-separated snake_case

**Status**: Locked  
**Decision**: `lowercase.dot_separated.snake_case`. First segment = domain = filename stem.  
**Why**: Predictable for Claude. File → domain mapping is structural and verifiable by `grep`.

---

### ADR-004 — Expression representation: JSON object trees

**Status**: Locked  
**Decision**: Expressions are JSON discriminated-union objects, never strings.  
**Why**: Strings require parsing and escaping; object trees are type-safe, trivially editable, and unambiguous. Eliminates an entire class of parse errors.

---

### ADR-005 — DSL purity: all functions must be pure

**Status**: Locked  
**Decision**: Every function registered in `FunctionRegistry` must be pure (deterministic, no I/O, no mutation, no async).  
**Why**: Pure functions are cacheable, testable in isolation, debuggable via traces, and language-portable.

---

### ADR-006 — Cache key: canonical JSON with sorted keys

**Status**: Locked  
**Decision**: Cache key = `path + "::" + canonicalJSON(inputs)` where `canonicalJSON` sorts keys recursively.  
**Why**: JavaScript object key order is non-deterministic across edge cases. Canonical serialization is fully deterministic.

---

### ADR-007 — React integration: hooks only, no declarative rendering

**Status**: Locked for v0.1  
**Decision**: `useRule` and `useRuleStream` hooks inside normal React components. No `<RuleView>`, no component registry.  
**Why**: The 80/80/1 goal is about edit speed post-construction. Whole-page rendering expands scope without serving the goal.

---

### ADR-008 — No pre/post effects in v0.1

**Status**: Locked for v0.1  
**Decision**: No side-effect hooks on rule evaluation.  
**Why**: Effects break purity. Every rule edit is fully reversible and trivially testable without them.

---

### ADR-009 — Type checking depth: shallow only

**Status**: Locked for v0.1  
**Decision**: Validate operator arity/types, function signature matches, and top-level output type only.  
**Why**: Deep inference is an engineering luxury. Shallow checks catch the common errors in under 1 second.

---

### ADR-010 — Discipline enforcement: `hf lint`, not prose

**Status**: Locked  
**Decision**: `hf lint` is the primary enforcement mechanism. `CLAUDE.md` is a complement.  
**Why**: Prose discipline degrades over long contexts and across model versions. CI-enforced static analysis does not.

---

### ADR-011 — Runtime: Node.js ≥ 20, Bun ≥ 1.1, no native dependencies

**Status**: Locked for v0.1  
**Decision**: Target both runtimes; zero native module dependencies.  
**Why**: Both runtimes execute TypeScript natively. Bun is Anthropic-aligned (relevant for Claude-tooling adjacency).

---

### ADR-012 — Testing: Vitest + snapshots

**Status**: Locked for v0.1  
**Decision**: Vitest for all unit tests. Snapshot tests for rules.  
**Why**: Best TypeScript ergonomics, Vite-compatible setup. Snapshot tests auto-document expected behavior on rule changes.

---

### ADR-013 — Monorepo: pnpm workspaces

**Status**: Locked for v0.1  
**Decision**: `pnpm-workspace.yaml` with four packages: `core`, `react`, `lint`, `cli`.  
**Why**: Fastest installs, strict workspace boundaries, native TypeScript support.

---

### ADR-014 — Versioning: semantic versioning, v0.x unstable

**Status**: Locked  
**Decision**: SemVer. v0.x allows breaking changes. v1.0.0 commits to public API.

---

### ADR-015 — License: MIT

**Status**: Locked  
**Decision**: MIT license.  
**Why**: Maximum adoption, no commercial constraints, aligns with saving tokens at scale rather than building a startup.

---

## New decisions made during TypeScript type design

### ADR-016 — Type/value co-naming for Zod schemas (Zod idiomatic pattern)

**Status**: Decided  
**Decision**: TypeScript types and Zod schemas share the same identifier
(e.g., `export type Rule = ...` and `export const Rule: z.ZodType<Rule> = ...`).  
**Why**: The canonical TypeScript/Zod pattern. Callers use `Rule` in type
positions for compile-time checking and in value positions for runtime
validation — no need to learn two names (`RuleSchema` vs `Rule`).  
**Trade-off**: Slight cognitive overhead for developers unfamiliar with the
pattern. Mitigated by the TSDoc on every schema noting it is a Zod schema.

---

### ADR-017 — Recursive Zod schemas use `z.lazy()` with explicit `z.ZodType<T>` annotation

**Status**: Decided  
**Decision**: `TypeSpec` and `Expression` use `z.lazy(() => ...)` with an
explicit `z.ZodType<T>` annotation to resolve the TypeScript forward-reference
for recursive types.  
**Why**: Without the explicit annotation TypeScript cannot infer the return type
of the recursive schema. The annotation is the documented Zod pattern for
recursive schemas.

---

### ADR-018 — `FunctionRegistry` is a concrete class, not an interface

**Status**: Decided  
**Decision**: `FunctionRegistry` is a `class` (with stub bodies) rather than an
`interface`.  
**Why**: User code calls `registry.register(...)` directly; making it an
interface would force user code to construct an `implements` object.
A class gives a concrete, newing API consistent with `Resolver` and
`RuleLoader`.  
**Trade-off**: Slightly harder to mock in tests. Acceptable because tests will
construct real `FunctionRegistry` instances.

---

### ADR-019 — `OperatorRegistry` is an interface, not a class

**Status**: Decided  
**Decision**: `OperatorRegistry` is an `interface` (not a class).  
**Why**: The registry is populated by the loader from `defaults/operators.json`,
not by user code. The loader constructs whatever concrete type implements the
interface. Exposing it as an interface allows the loader to return any
implementation (Map-backed, frozen object, etc.) without coupling callers
to a specific class.  
**Trade-off**: The implementing class is internal and not part of the public API.

---

### ADR-020 — `RequestContext` exposes `getCacheEntry` / `setCacheEntry` as `@internal`

**Status**: Decided  
**Decision**: The two cache manipulation methods are public in the TypeScript
sense (not `private`) but annotated `@internal` in TSDoc.  
**Why**: The resolver needs to call them. Making them `private` or `protected`
would require the resolver to be a subclass of `RequestContext`, which is the
wrong model. `@internal` signals "do not use from application code" while
keeping the resolver's dependency satisfied.

---

### ADR-021 — `HotReloadSuccessHandler` and `HotReloadErrorHandler` as named function types

**Status**: Decided  
**Decision**: Named `type` aliases for the callback parameters of `RuleLoader.watch()`.  
**Why**: Named types produce better TypeDoc and better IDE hover documentation
than inline anonymous function types. They are also more discoverable when
searching the API reference.

---

### ADR-022 — `LoadError` collects all errors (not fail-fast)

**Status**: Decided  
**Decision**: The loader collects every validation error and throws a single
`LoadError` with an array of child `HyperFluxError` objects.  
**Why**: Fail-fast gives one error per run, forcing iterative fix cycles.
Collecting all errors surfaces every problem at once — a better developer
experience for someone editing multiple rule files.  
**Trade-off**: The loader must not short-circuit on the first error, which
requires more careful error-propagation code.

---

### ADR-023 — `DomainFile.domain` regex enforces single-segment

**Status**: Decided  
**Decision**: `DomainFile.domain` is validated by Zod with regex
`/^[a-z][a-z0-9_]*$/` (single segment, no dots).  
**Why**: The spec requires `domain` to match the filename stem. Filename stems
are single segments by definition. A dot in `domain` would be ambiguous (it
could mean a sub-domain or a directory separator). Rejecting it early gives a
clear error message.

---

### ADR-024 — `FixEngine` returns `Record<string, string>` (not writes to disk)

**Status**: Decided  
**Decision**: `FixEngine.applyFixes()` returns a `Record<string, string>` of
updated source texts; it does not write to disk.  
**Why**: The fix engine is a pure transformation. The CLI command that calls it
is responsible for writing files. This separation makes the engine fully
testable without filesystem I/O.

---

### ADR-025 — `Analyzer.analyzeFile` is `async`, `analyzeRules` is synchronous

**Status**: Decided  
**Decision**: `analyzeFile` is `async` because the TypeScript compiler API
`createProgram` may be moved behind an async interface in future TS versions
and because reading file contents can be async in some environments.
`analyzeRules` is synchronous because it operates on in-memory `DomainFile`
objects.  
**Why**: Matches the access pattern: source file analysis is I/O-adjacent;
rule analysis is pure in-memory computation.

---

### ADR-026 — `TraceTree` has aggregate statistics at the top level

**Status**: Decided  
**Decision**: `TraceTree` includes `totalTimeMs`, `evaluationCount`, and
`cacheHitCount` as first-class fields, not computed from the node tree.  
**Why**: The CLI and tests need these values frequently. Computing them by
walking the tree on every access is wasteful. The resolver pre-computes them
during trace recording.

---

### ADR-027 — `moduleResolution: "bundler"` for `tsc --noEmit`

**Status**: Decided  
**Decision**: The root `tsconfig.json` uses `"module": "ESNext"` and
`"moduleResolution": "bundler"` with `paths` mapping workspace packages.  
**Why**: `"moduleResolution": "bundler"` does not require explicit `.js`
extensions in imports, which keeps declaration-only files clean. It is the
correct resolution mode for tooling (TypeDoc, Vitest) that processes files
through a bundler. `paths` provide cross-package resolution without
`pnpm install` being required for typechecking.

---

*Last updated: v0.1.0 specification*
