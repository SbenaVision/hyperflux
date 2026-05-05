# HyperFlux v0.1

> **The single testable claim:** Once a HyperFlux module is constructed, Claude can apply 80%
> of subsequent product changes by editing typed rule rows in under one minute, with fewer
> regressions than equivalent code edits.

HyperFlux is a typed rule engine that externalizes application decisions — business logic,
copy, validation, configuration, thresholds, and conditional UI — into JSON rule files.
A pure expression resolver evaluates rules at request time. React hooks make the results
available to components. A static analyzer enforces that code stays clean.

---

## Why it exists

Editing application code requires reading surrounding context, fitting new logic to existing
patterns, avoiding broken imports and types, and often regenerating entire functions or files.
A typical small change in a React app costs Claude 5,000–20,000 tokens.

Editing a typed rule row requires reading the rule's schema (small and fixed), reading the
specific rule (one row), and generating a validated replacement. A row edit costs 500–2,000
tokens because the surface area is bounded by the schema, not by the codebase size.

Whether this scales to 80% of changes depends on whether 80% of typical product changes can
be expressed as rule edits. The benchmark in `benchmark/` answers this question empirically.

---

## Architecture

HyperFlux is a four-package monorepo. Each package has a single clear responsibility.
No package depends on one above it in this diagram.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        @hyperflux/cli                               │
│  hf validate · hf test · hf lint · hf trace · hf new · hf init     │
│  Command structure loaded from defaults/cli-commands.json            │
└────────────────────┬────────────────────────────────────────────────┘
                     │ depends on
          ┌──────────┴──────────┐
          │                     │
┌─────────▼────────┐   ┌────────▼────────────────────────────────────┐
│  @hyperflux/lint │   │              @hyperflux/react                │
│  Analyzer        │   │  useRule · useRuleStream · HyperFluxProvider │
│  FixEngine       │   │  Behavior-mode hooks only (no page rendering) │
└─────────┬────────┘   └────────┬────────────────────────────────────┘
          │                     │
          └──────────┬──────────┘
                     │ depends on
┌────────────────────▼────────────────────────────────────────────────┐
│                        @hyperflux/core                              │
│                                                                     │
│  Schema ────── Rule · TypeSpec · Expression · Case · DomainFile     │
│  Expressions ── OperatorRegistry · FunctionRegistry · canonicalJSON │
│  Rules ──────── RuleStore · DependencyGraph                         │
│  Loader ──────── RuleLoader (scan → validate → index → type-check)  │
│  Resolver ────── Resolver · RequestContext (evaluate + cache)        │
│  Trace ─────────  TraceNode · TraceTree · formatTrace               │
│  Errors ──────── HF001–HF010 error hierarchy                        │
└─────────────────────────────────────────────────────────────────────┘
                     │
          reads at startup
┌────────────────────▼────────────────────────────────────────────────┐
│                         defaults/                                   │
│  operators.json       DSL operator definitions (arity, types)       │
│  errors.json          Error code → message templates                │
│  lint-rules.json      Lint rule definitions                         │
│  cli-commands.json    CLI command/flag structure                     │
│  performance-budgets.json  CI perf thresholds                       │
│  watch-patterns.json  Hot-reload glob patterns                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Packages

### `@hyperflux/core`

The runtime engine. Every other package depends on it.

| Module | Responsibility |
|---|---|
| `schema.ts` | Zod schemas + TypeScript types for `TypeSpec`, `Expression`, `Case`, `Rule`, `DomainFile` |
| `expressions.ts` | `OperatorRegistry`, `FunctionRegistry`, `canonicalJSON`, `buildCacheKey` |
| `rules.ts` | `RuleStore` interface, `DependencyGraph` interface |
| `loader.ts` | `RuleLoader` — scans, validates, builds index, detects cycles, shallow type-checks |
| `resolver.ts` | `Resolver` — evaluates rules; `RequestContext` — per-request cache + trace |
| `trace.ts` | `TraceNode`, `TraceTree`, `formatTrace`, `filterTrace`, `traceToJSON`, `traceFromJSON` |
| `errors.ts` | `HyperFluxError` base + 10 typed subclasses (HF001–HF010) |

**Load pipeline** (executed by `RuleLoader.load()`):

```
rules/*.json
     │
     ├─ 1. Parse each file with DomainFile Zod schema
     ├─ 2. Assert domain === filename stem
     ├─ 3. Assert every rule path starts with <domain>.
     ├─ 4. Assert no duplicate paths across files
     ├─ 5. Build dependency graph from metadata.requires + rule expressions
     ├─ 6. Topological sort — reject cycles (RuleCycleError HF006)
     ├─ 7. Shallow type check (operator arity, function signature, output type)
     └─ 8. Return RuleStore  ──────►  Resolver
```

**Evaluation algorithm** (executed by `Resolver.evaluate()`):

```
evaluate(path, inputs, ctx?)
     │
     ├─ 1. Look up path in RuleStore  (RuleNotFoundError HF001 if missing)
     ├─ 2. Validate inputs against declared TypeSpecs  (InputTypeError HF002)
     ├─ 3. Compute cache key: path + "::" + canonicalJSON(inputs)
     ├─ 4. Return cached value if present in RequestContext
     ├─ 5. Iterate cases in order:
     │      when: evaluate guard expression → if true, evaluate then expression
     │      no when: unconditional default (must be last)
     ├─ 6. Validate output against declared output TypeSpec  (OutputTypeError HF003)
     ├─ 7. Cache result in RequestContext
     └─ 8. Optionally record TraceNode if ctx.recordTrace === true
```

---

### `@hyperflux/react`

React hooks adapter. Behavior mode only — hooks inside normal components, no whole-page rendering.

| Export | Description |
|---|---|
| `HyperFluxProvider` | React context provider. Wrap your app root with this, passing the `Resolver` instance. |
| `useRule<T>(path, inputs)` | Synchronous rule evaluation. Re-renders when `inputs` changes. Returns `T`. |
| `useRuleStream<T>(path, inputs)` | Rule evaluation with `{ value, loading, error }` envelope. Future-proofs for async functions in v0.2. |
| `HyperFluxContext` | The raw React context. Use hooks, not this. |

**Usage pattern:**

```tsx
// App root
<HyperFluxProvider resolver={resolver}>
  <Router />
</HyperFluxProvider>

// Any component
function SubmitButton() {
  const label = useRule<string>("ui.labels.submit_button", {});
  return <button type="submit">{label}</button>;
}

function UserBadge({ revenue }: { revenue: number }) {
  const isHighValue = useRule<boolean>("users.is_high_value", { revenue });
  return isHighValue ? <Badge label="High Value" /> : null;
}
```

---

### `@hyperflux/lint`

Static analyzer that enforces HyperFlux discipline — detects business logic leaking back into code.
Rule definitions live in `defaults/lint-rules.json`, not in source.

| Export | Description |
|---|---|
| `Analyzer` | Runs all active lint rules against TypeScript source files (AST traversal) and rule JSON files. |
| `FixEngine` | Computes and applies automated fixes for fixable diagnostics (`no-hardcoded-copy`, `no-magic-numbers`). |

**Built-in lint rules** (defined in `defaults/lint-rules.json`, not hardcoded):

| Rule ID | Scope | Default | What it catches |
|---|---|---|---|
| `no-hardcoded-copy` | src | error | User-facing string literals in JSX — should be copy rules |
| `no-magic-numbers` | src | warn | Numeric literals in conditionals — should be config rules |
| `no-inline-business-comparisons` | src | error | String equality against domain enums — should be rules |
| `no-hardcoded-date-format` | src | error | Date format string literals — should be config rules |
| `rules-no-cycles` | rules | error | Cyclic rule dependencies |
| `rules-no-orphans` | rules | error | Rule references that point to non-existent paths |
| `rules-no-unused` | rules | warn | Defined rules that are never referenced |
| `rules-domain-match` | rules | error | Rule path domain doesn't match file name |

**Diagnostic output format:**

```
src/components/UserList.tsx:42:16
  error  no-magic-numbers  Numeric literal '5' in conditional. Move to config rule.
  hint   Try: useRule('config.users.high_value_threshold')

rules/pricing.json:12
  error  rules-domain-match  Path 'discounts.vip' does not start with domain 'pricing'.
```

---

### `@hyperflux/cli`

The `hf` command-line tool. Command structure is loaded from `defaults/cli-commands.json` —
adding a flag means editing that file, not this source.

| Command | Description |
|---|---|
| `hf validate` | Validate all rule files. Exits 0 on success, non-zero on any error. |
| `hf test` | Run snapshot tests for rules via Vitest. |
| `hf lint` | Run discipline enforcement. `--fix` applies unambiguous fixes. |
| `hf trace [file]` | Render a saved trace JSON file as a readable tree. |
| `hf new <domain> <name>` | Scaffold a new rule stub using `templates/rule-single.template`. |
| `hf init` | Scaffold a new HyperFlux project (rules/, config, CLAUDE.md). |

---

## The rule format

Rules are stored in `rules/<domain>.json`. Every behavioral decision in a HyperFlux
application is one or more rules:

```json
{
  "domain": "pricing",
  "version": "1",
  "rules": [
    {
      "path": "pricing.atm.fee",
      "kind": "compute",
      "inputs": [{ "name": "amount", "type": { "type": "number" } }],
      "output": { "type": "number" },
      "cases": [
        {
          "when": { "kind": "op", "op": ">",
            "args": [{ "kind": "input", "path": ["amount"] }, { "kind": "literal", "value": 1000 }]
          },
          "then": { "kind": "literal", "value": 0 }
        },
        { "then": { "kind": "literal", "value": 2.5 } }
      ],
      "metadata": { "version": "1", "requires": [], "domain": "pricing" }
    }
  ]
}
```

Claude reads this schema reliably, edits the `value` fields or `when` conditions, and
`hf validate` immediately catches any mistakes. No code context needed.

---

## The DSL

The expression tree uses five node kinds:

| Kind | Shape | Meaning |
|---|---|---|
| `literal` | `{ kind: "literal", value: X }` | Constant value |
| `input` | `{ kind: "input", path: ["x", "y"] }` | `inputs.x.y` |
| `rule` | `{ kind: "rule", path: "domain.name" }` | Evaluate another rule |
| `fn` | `{ kind: "fn", name: "formatCurrency", args: [...] }` | Call a registered pure function |
| `op` | `{ kind: "op", op: "==", args: [...] }` | Apply an operator |

Operators are externalized in `defaults/operators.json`. In v0.1: `==`, `!=`, `<`, `<=`,
`>`, `>=`, `+`, `-`, `*`, `/`, `%`, `AND`, `OR`, `NOT`.

---

## Self-consistency principle

HyperFlux is built using HyperFlux principles. Every behavioral constant in the framework
itself lives in `defaults/`, not in source. The framework lints itself clean (REQ-702).

| `defaults/` file | What it controls |
|---|---|
| `operators.json` | Which operators exist, their arity and types |
| `errors.json` | All error messages — none are hardcoded |
| `lint-rules.json` | Which lint rules run and at what severity |
| `cli-commands.json` | All command names, aliases, flags, and defaults |
| `performance-budgets.json` | CI thresholds for evaluation speed, lint speed, hot reload |
| `watch-patterns.json` | Which files trigger hot reload |

---

## Getting started

```bash
# Install
pnpm install

# Scaffold a new project
npx hf init

# Validate rules
npx hf validate

# Enforce discipline
npx hf lint
npx hf lint --fix

# Run snapshot tests
npx hf test

# Inspect an evaluation trace
npx hf trace ./traces/request-1.json --verbose --slow 1

# Add a rule
npx hf new pricing atm.fee
```

---

## Development

```bash
pnpm typecheck     # tsc --noEmit across all packages (must exit 0)
pnpm docs          # regenerate docs/api/ via TypeDoc
pnpm test          # run all Vitest tests
```

---

## License

MIT — see [LICENSE](LICENSE).
