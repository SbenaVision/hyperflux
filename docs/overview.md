# HyperFlux — Technical Overview

**Version**: 0.1  
**Status**: Engineering specification complete. Implementation in progress.

---

## The claim

> Once a HyperFlux module is constructed, Claude can apply 80% of subsequent product changes by editing typed rule rows in under one minute, with fewer regressions than equivalent code edits.

This is a design target, not a proven fact. A structured benchmark answers it empirically. Results ship regardless of outcome.

---

## The problem it solves

When Claude edits application code, it must read surrounding context, generate replacement code that fits existing patterns, avoid breaking imports and types, and often regenerate entire functions or files. A small change in a typical React app costs 5,000–20,000 tokens because the relevant surface area is the entire codebase.

When Claude edits a typed rule row, it reads the rule's schema (small and fixed), reads the specific rule (one row), and generates a validated replacement. A row edit costs 500–2,000 tokens because the surface area is bounded by the schema, not the codebase size.

HyperFlux makes the second case the default for the majority of product changes.

---

## How it works

HyperFlux moves behavioral decisions out of code and into JSON rule files.

```
BEFORE (code)                          AFTER (rule)
─────────────────────────────────      ─────────────────────────────────
const fee = amount > 1000 ? 0 : 2.5;  { "path": "pricing.atm.fee",
                                         "kind": "compute",
                                         "cases": [
                                           { "when": { "op": ">",
                                               "args": [{"input": "amount"},
                                                        {"literal": 1000}] },
                                             "then": { "literal": 0 } },
                                           { "then": { "literal": 2.5 } }
                                         ] }
```

The rule is a **typed, validated, machine-readable data structure**. Claude reads the schema once, then edits `value` fields and `when` conditions directly. No code context needed. Schema validation catches mistakes immediately.

A static analyzer (`hf lint`) enforces the discipline — it detects business logic leaking back into code and blocks it at pre-commit.

---

## The architecture

HyperFlux is four packages in a monorepo, plus a `defaults/` directory where every behavioral constant lives.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        @hyperflux/cli                               │
│  hf validate · hf test · hf lint · hf trace · hf new · hf init     │
└────────────────────┬────────────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
┌─────────▼────────┐   ┌────────▼────────────────────────────────────┐
│  @hyperflux/lint │   │              @hyperflux/react                │
│  Static analyzer │   │  useRule · useRuleStream · HyperFluxProvider │
└─────────┬────────┘   └────────┬────────────────────────────────────┘
          └──────────┬──────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│                        @hyperflux/core                              │
│  Schema · Loader · Resolver · FunctionRegistry · Trace · Errors     │
└─────────────────────────────────────────────────────────────────────┘
                     │
          reads at startup
┌────────────────────▼────────────────────────────────────────────────┐
│                         defaults/                                   │
│  operators.json  errors.json  lint-rules.json  cli-commands.json    │
│  performance-budgets.json  watch-patterns.json                      │
└─────────────────────────────────────────────────────────────────────┘
```

### `@hyperflux/core`

The runtime engine. Provides:

- **Schema** — Zod schemas for `TypeSpec`, `Expression`, `Case`, `Rule`, and `DomainFile`. These are the types Claude reads and edits.
- **Loader** — Scans `rules/*.json`, validates every file, builds an indexed `RuleStore`, constructs a dependency graph, detects cycles, runs a shallow type check. Any failure aborts startup with a structured error naming the offending rule.
- **Resolver** — Evaluates rules at request time against typed inputs. Iterates cases in order; the first matching `when` wins; a case without `when` is the unconditional default. Results are cached per `RequestContext` using a canonical JSON cache key (sorted keys, deterministic). Target: under 1 ms cached, under 5 ms uncached.
- **FunctionRegistry** — User code registers pure functions (`calculateCompoundInterest`, `formatCurrency`, etc.) that rules can call by name. Functions must be deterministic, no I/O, no async. The DSL stays declarative; complex computation lives in the function library.
- **Trace** — When `recordTrace: true`, the resolver records every evaluation as a tree: path, inputs, output, matched case index, time, cached flag, children. The `hf trace` command renders this for debugging.
- **Errors** — Structured error hierarchy (HF001–HF010). Error messages are not hardcoded — they are loaded from `defaults/errors.json` at startup.

### `@hyperflux/react`

React hooks adapter. Behavior mode only — no whole-page rendering, no component registry.

```tsx
// Wrap your app once
<HyperFluxProvider resolver={resolver}>
  <App />
</HyperFluxProvider>

// Use anywhere in the tree
function SubmitButton() {
  const label = useRule<string>("ui.labels.submit_button", {});
  return <button type="submit">{label}</button>;
}

function UserBadge({ revenue }: { revenue: number }) {
  const isHighValue = useRule<boolean>("users.is_high_value", { revenue });
  return isHighValue ? <Badge label="High Value" /> : null;
}
```

`useRule` is synchronous. `useRuleStream` wraps the result in `{ value, loading, error }` for future async function support.

### `@hyperflux/lint`

Static analyzer that enforces the discipline. Reads rule definitions from `defaults/lint-rules.json` — none are hardcoded in source.

| Rule | What it catches |
|---|---|
| `no-hardcoded-copy` | User-facing string literals in JSX — should be copy rules |
| `no-magic-numbers` | Numeric literals in conditionals — should be config rules |
| `no-inline-business-comparisons` | String equality against domain enums — should be rules |
| `no-hardcoded-date-format` | Date format strings — should be config rules |
| `rules-no-cycles` | Cyclic rule dependencies |
| `rules-no-orphans` | References to non-existent rule paths |
| `rules-no-unused` | Rules that are defined but never referenced |
| `rules-domain-match` | Rule path domain doesn't match file name |

`hf lint --fix` applies unambiguous fixes automatically (extracts string literals to copy rules, numeric literals to config rules). Ambiguous fixes surface a hint instead.

### `@hyperflux/cli`

The `hf` command-line tool. Command structure (names, aliases, flags, defaults) is loaded from `defaults/cli-commands.json` — not hardcoded.

| Command | What it does |
|---|---|
| `hf validate` | Full rule store validation. Exits 0 if clean. |
| `hf lint` | Discipline enforcement. `--fix` applies automated fixes. |
| `hf test` | Snapshot tests for rules via Vitest. |
| `hf trace [file]` | Render a saved evaluation trace as a readable tree. |
| `hf new <domain> <name>` | Scaffold a new rule stub. |
| `hf init` | Scaffold a new HyperFlux project. |

---

## The rule format

Rules are JSON, stored in `rules/<domain>.json`. One file per domain; each domain maps to a first path segment.

```json
{
  "domain": "pricing",
  "version": "1",
  "rules": [
    {
      "path": "pricing.atm.fee",
      "kind": "compute",
      "inputs": [
        { "name": "amount", "type": { "type": "number" } }
      ],
      "output": { "type": "number" },
      "cases": [
        {
          "when": {
            "kind": "op", "op": ">",
            "args": [
              { "kind": "input", "path": ["amount"] },
              { "kind": "literal", "value": 1000 }
            ]
          },
          "then": { "kind": "literal", "value": 0 }
        },
        {
          "then": { "kind": "literal", "value": 2.5 }
        }
      ],
      "metadata": {
        "version": "1",
        "requires": [],
        "domain": "pricing",
        "description": "ATM fee: free for amounts over $1000, otherwise $2.50"
      }
    }
  ]
}
```

**Rule kinds:**
- `compute` — evaluates a dynamic expression tree against inputs.
- `config` — static configuration; single default case, no inputs.

**Path convention:** lowercase, dot-separated, snake_case. First segment = domain = filename stem. (`pricing.atm.fee` lives in `rules/pricing.json`.)

---

## The expression DSL

Expressions are JSON object trees — never strings. Five node kinds:

| Kind | Shape | Meaning |
|---|---|---|
| `literal` | `{ "kind": "literal", "value": 2.5 }` | Constant |
| `input` | `{ "kind": "input", "path": ["amount"] }` | Read from inputs |
| `rule` | `{ "kind": "rule", "path": "pricing.vip_discount" }` | Call another rule |
| `fn` | `{ "kind": "fn", "name": "round", "args": [...] }` | Call a registered function |
| `op` | `{ "kind": "op", "op": "AND", "args": [...] }` | Apply an operator |

Operators in v0.1: `==`, `!=`, `<`, `<=`, `>`, `>=`, `+`, `-`, `*`, `/`, `%`, `AND`, `OR`, `NOT`.

Operators are externalized in `defaults/operators.json`. Adding a new operator in v0.2 means editing that file, not source code.

---

## The self-consistency principle

HyperFlux teaches developers to externalize behavioral decisions. The framework itself obeys the same principle: every behavioral constant in HyperFlux lives in `defaults/`, not in source.

| File | What it controls |
|---|---|
| `defaults/operators.json` | DSL operator definitions (arity, types, symbols) |
| `defaults/errors.json` | All error codes and message templates |
| `defaults/lint-rules.json` | Which lint rules exist and at what severity |
| `defaults/cli-commands.json` | All CLI command names, aliases, flags, and defaults |
| `defaults/performance-budgets.json` | CI thresholds for evaluation speed, lint speed, hot reload |
| `defaults/watch-patterns.json` | Which files trigger hot reload |

Running `hf lint` on HyperFlux's own source produces zero errors. The framework eats its own dog food.

---

## The type system

HyperFlux has a shallow runtime type system (`TypeSpec`) covering: `string`, `number`, `boolean`, `null`, `object` (with a typed shape), `array` (with typed items), and `any`.

Types are validated at three moments:
1. **Load time** — shallow type check on rule expressions against declared input/output types.
2. **Evaluation time** — input values validated against declared `TypeSpec`; case output validated against declared output `TypeSpec`.
3. **Lint time** — static analysis detects type-unsafe patterns in source code.

---

## Performance targets

All targets are enforced by CI, read from `defaults/performance-budgets.json`:

| Metric | Target |
|---|---|
| Cached rule evaluation | < 1 ms |
| Uncached rule evaluation | < 5 ms |
| Rule store load (1,000 rules) | < 200 ms |
| `hf lint` on 5,000-line codebase | < 2 seconds |
| Hot reload from file save | < 1 second |

---

## The benchmark

The claim is validated by a structured benchmark comparing two versions of the same reference application.

**Reference application:** A small admin dashboard (~3,000 LOC) with authenticated routing, a dashboard with revenue/users/alerts widgets, user detail with editable profile, a pricing rules page, and a settings page.

**The 20 test changes** (applied twice — once to vanilla, once to HyperFlux — by Claude with identical prompts):

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

**Measurement per change:** tokens consumed, wall-clock time, lines of code touched, regression count.

**Publication:** Raw transcripts alongside numbers. Token counts can be gamed; transcripts cannot. If the benchmark contradicts the 80/80/1 claim, results ship anyway. The framework becomes a research artifact.

---

## Why this hasn't been done before

Rule engines (Drools, JsonLogic, OpenL Tablets) and schema-driven UI frameworks (JSON Forms, Form.io) have existed for over a decade. They never went mainstream because:

1. **Human analysts were the assumed maintainers** — humans hate maintaining rule tables.
2. **DSLs were designed to read like natural language** — weakly typed, ambiguous, hard to validate.
3. **Tooling was weaker than for code** — worse IDEs, debugging, refactoring.
4. **"Just write code" was lower friction** — for humans.

HyperFlux flips each of these:
1. **Claude is the maintainer** — Claude reads schemas faster than it reads codebases.
2. **The DSL is strictly typed and machine-validated** — Zod schemas, not prose.
3. **Tooling is the standard TypeScript ecosystem** — Zod, Vitest, the language server.
4. **The friction calculus has reversed** — for Claude, bounded schema edits are cheaper than unbounded code edits.

The bet is that the original ideas were right and the missing ingredient was the maintainer.

---

## Current status

The TypeScript engineering specification is complete:
- Full type declarations and TSDoc for all four packages (25 source files)
- All `defaults/` files specified with schema documentation
- 27 architectural decisions recorded
- 115-page TypeDoc API reference generated
- `tsc --noEmit` exits clean

Implementation begins with `defaults/` files → schema → loader → resolver → tests.

---

## Open questions

1. What percentage of typical product changes can actually be expressed as rule edits? The benchmark estimates this on one application.
2. How does Claude behave on long sessions where the rule store has thousands of rows?
3. Can the DSL stay small as real applications expose edge cases, or does the function-library escape hatch grow unboundedly?
4. How fragile is Claude's discipline across model versions, long contexts, and competing training patterns?

The biggest risk: Claude drift. Mitigation is structural — schema validation, cycle detection, snapshot tests, and `hf lint` in CI catch violations without relying on Claude's good behavior.

---

*HyperFlux v0.1 — engineering specification. MIT license.*
