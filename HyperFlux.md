# HyperFlux

A React/Bun application architecture that forces Claude Code to develop with radical externalism — application logic lives in typed rule rows, not in code.

## The single testable claim

> Once a HyperFlux module is constructed, Claude can apply 80% of subsequent product changes by editing typed rule rows instead of React/Bun code, using roughly 10x fewer tokens per change, in under one minute, with fewer regressions than equivalent code edits.

This is a design target, not a proven fact. The benchmark publishes the truth either way.

## Why this might work

Editing code requires Claude to read surrounding context, generate replacement code that fits existing patterns, avoid breaking imports, types, and adjacent logic, and often regenerate entire functions or files. A typical small change in a Next.js app costs Claude 5,000 to 20,000 tokens because of how much context it must load.

Editing a typed rule row requires Claude to read the rule's schema (small, fixed), read the specific rule (one row), generate a validated replacement, and confirm the schema accepts it. A row edit costs roughly 500 to 2,000 tokens because the surface area is bounded by the schema, not by the size of the codebase.

Whether this scales to 80% of changes depends on whether 80% of typical product changes can actually be expressed as rule edits. We don't know yet. That is what the benchmark answers.

## Technical objections, addressed

**The DSL expressiveness problem.** Rules use a small DSL: comparison, boolean logic, arithmetic, references to other rules by path, and calls to registered host-language functions by name. When a rule needs computation the DSL cannot express, it calls a named function — `calculateCompoundInterest(principal, rate, years)` — whose implementation lives in TypeScript. The rule itself stays declarative and portable; the function library is the per-language boundary. This means language portability is partial, not free: regenerating to Python requires reimplementing the function library in Python (or wiring an existing Python library to the same names). We do not promise free portability. We promise that rules express *intent* in a portable way, while *implementation* of complex computation remains in host code where it belongs.

**The performance problem.** Late mode (interpreted) walks the rule graph at request time with per-request memoization of pure rules. For typical workloads — under 100 rule evaluations per request — overhead is sub-millisecond. For hot paths evaluating thousands of rules per request, late mode is too slow. Early mode (compiled) generates TypeScript functions from rules at build time, producing code structurally similar to what an engineer would write by hand, with O(1) dispatch and no graph traversal. The benchmark measures both. Honest expectation: late mode within 2x of hand-written code on typical workloads, early mode within 10% of hand-written.

**The debugging problem.** When rule interactions produce emergent behavior, debugging is harder than imperative flow. The trace viewer records every rule evaluation in a request — path, inputs, output, matched case, dependencies — as a tree. This makes interactions visible, but does not fully replace imperative debugging intuition. Compensating structural property: rules are pure functions of explicitly typed inputs. Each rule is testable in isolation. Snapshot tests on rules are trivial to generate. Property-based tests on the dependency graph catch cycles and dead branches automatically. Net: a different debugging surface, not a strictly easier one.

**Why this hasn't won before.** Rule engines (Drools, JsonLogic, OpenL Tablets) and schema-driven UI frameworks (JSON Forms, Form.io) have existed for over a decade. They never went mainstream because (1) human business analysts were the assumed maintainers and humans hate maintaining rule tables; (2) the DSLs were designed to read like natural language, which made them weakly typed and ambiguous; (3) tooling was always weaker than for code — worse IDEs, debugging, refactoring; (4) developers concluded "just write code" was lower friction. HyperFlux flips each of these: Claude is the maintainer, the DSL is strict and machine-validated, tooling is the standard TypeScript ecosystem (Zod, vitest, the language server), and the friction calculus has reversed because Claude reads schemas faster than it reads codebases. The bet is that the original ideas were right and the missing ingredient was the maintainer.

## What v0.1 builds

A JSON rule store. Zod validation. A resolver that evaluates rules at request time with per-request memoization. A React adapter that renders views from rules. A trace viewer that shows the rule evaluation tree for any request. A CLAUDE.md that constrains rule edits and prevents drift back to code.

That is the entire v0.1. Single developer, one-month build.

## What v0.1 deliberately does not promise

No early-mode compiler — late mode only. No SQL or query rules — runtime database access through rule data has security implications we have not designed for. No self-hosting. No regeneration to other frameworks. No bot. No runtime UI customization. No visual editor.

Each of these may be valuable later. None helps prove or disprove the core claim. They are deferred to v0.2 and beyond.

## The benchmark is the validation

Take a representative React/Bun application — a small admin dashboard with forms, tables, conditional UI logic, and roughly 3,000 lines of code. Define 20 realistic product changes covering copy edits, validation rule changes, threshold adjustments, conditional UI logic, new fields, and pricing tweaks.

Apply each change twice with the same Claude model and the same overall prompt: once to the vanilla codebase, once to the HyperFlux equivalent.

Measure four things: tokens consumed, wall-clock time, lines of code touched, and regression count (did the change work as specified, did it break unrelated features, did it introduce type errors or test failures).

Publish raw transcripts alongside numbers. Token counts can be gamed; transcripts cannot.

If HyperFlux delivers 5x to 10x token reduction with equal or fewer regressions on the majority of changes, the thesis holds. If it delivers 2x with a regression advantage, it is a quality story rather than a token story. If it delivers 1x, we were wrong and we say so.

## Honest open questions

What percentage of typical product changes can actually be expressed as rule edits? The benchmark estimates this on one application. Generalizing requires more applications.

How does Claude behave on long sessions where the rule store has thousands of rows? Stress testing required.

Can the small DSL stay small as real applications expose edge cases, or does the function-library escape hatch grow unboundedly? Open until tested.

Does early-mode compilation actually close the performance gap, or are there workloads where rule semantics cannot compile to efficient code? Open.

How fragile is Claude's discipline on edits across model versions, long contexts, and competing patterns from other codebases in its training? The single biggest risk to the project. Mitigation is making constraint enforcement structural — schema validation, dependency checks, snapshot tests — so that violations are caught by tooling, not left to Claude's good behavior.

---

This is what to build. The benchmark publishes the truth. Everything downstream of the benchmark is a separate question.
