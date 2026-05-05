/**
 * @file Zod schemas and inferred TypeScript types for all HyperFlux rule primitives.
 *
 * This file is the single source of truth for the HyperFlux data model.
 * Every other package imports types from here; no other file re-declares
 * these shapes. Types and Zod schemas share names, following the idiomatic
 * TypeScript/Zod pattern: use the name as a type in type positions and as
 * a value (schema) in runtime positions.
 *
 * @module @hyperflux/core/schema
 * @since 0.1.0
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// TypeSpec — the HyperFlux type system
// ---------------------------------------------------------------------------

/**
 * The TypeScript type for a HyperFlux TypeSpec.
 *
 * A TypeSpec describes the shape of a value at both compile time and runtime.
 * Object and array variants are recursive: an array's `items` is itself a
 * TypeSpec, and an object's `shape` is a record of string keys to TypeSpecs.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const priceType: TypeSpec = { type: "number" };
 * const userType: TypeSpec = {
 *   type: "object",
 *   shape: { name: { type: "string" }, age: { type: "number" } },
 * };
 * ```
 */
export type TypeSpec =
  | { type: "string" }
  | { type: "number" }
  | { type: "boolean" }
  | { type: "null" }
  | { type: "object"; shape: Record<string, TypeSpec> }
  | { type: "array"; items: TypeSpec }
  | { type: "any" };

/**
 * Zod schema for {@link TypeSpec}.
 *
 * Validates that a runtime value is a well-formed HyperFlux type descriptor.
 * Recursive variants (`object`, `array`) use `z.lazy()` to break the
 * forward-reference cycle.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const result = TypeSpec.safeParse({ type: "array", items: { type: "string" } });
 * if (!result.success) console.error(result.error.issues);
 * ```
 *
 * @see {@link TypeSpec} for the inferred TypeScript type.
 */
export const TypeSpec: z.ZodType<TypeSpec> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("string") }),
    z.object({ type: z.literal("number") }),
    z.object({ type: z.literal("boolean") }),
    z.object({ type: z.literal("null") }),
    z.object({
      type: z.literal("object"),
      shape: z.record(z.string(), TypeSpec),
    }),
    z.object({ type: z.literal("array"), items: TypeSpec }),
    z.object({ type: z.literal("any") }),
  ])
);

// ---------------------------------------------------------------------------
// Expression — the HyperFlux DSL
// ---------------------------------------------------------------------------

/**
 * A `literal` expression that returns a constant value directly.
 *
 * @since 0.1.0
 * @public
 */
export interface LiteralExpression {
  kind: "literal";
  /**
   * The constant value to return. Must be JSON-serializable.
   * Optional to match Zod's inference of `z.unknown()` (which admits `undefined`).
   */
  value?: unknown;
}

/**
 * An `input` expression that reads a field from the rule's input object.
 *
 * `path` is a sequence of string keys used to navigate the input structure
 * (e.g., `["user", "age"]` reads `inputs.user.age`).
 *
 * @since 0.1.0
 * @public
 */
export interface InputExpression {
  kind: "input";
  /** Ordered key path into the input record. */
  path: string[];
}

/**
 * A `rule` expression that evaluates another HyperFlux rule by path and
 * optionally passes positional arguments to it.
 *
 * @since 0.1.0
 * @public
 */
export interface RuleExpression {
  kind: "rule";
  /** Fully-qualified rule path, e.g. `"pricing.vip_discount"`. */
  path: string;
  /** Optional positional argument expressions passed to the referenced rule. */
  args?: Expression[];
}

/**
 * An `fn` expression that calls a named pure function registered in the
 * {@link FunctionRegistry} of the current {@link Resolver}.
 *
 * @since 0.1.0
 * @public
 */
export interface FnExpression {
  kind: "fn";
  /** Name of a function registered via `FunctionRegistry.register`. */
  name: string;
  /** Argument expressions, evaluated left-to-right before the function is called. */
  args: Expression[];
}

/**
 * An `op` expression that applies a built-in operator to its arguments.
 *
 * The set of valid `op` strings is determined at startup by reading
 * `defaults/operators.json`; it is NOT hardcoded in source. The shallow
 * type checker validates operator names and arity at load time.
 *
 * @since 0.1.0
 * @public
 */
export interface OpExpression {
  kind: "op";
  /** Operator symbol or name, e.g. `"=="`, `"AND"`, `"+"`. Must exist in `defaults/operators.json`. */
  op: string;
  /** Argument expressions. Count must match the operator's declared arity. */
  args: Expression[];
}

/**
 * A discriminated union of all HyperFlux DSL expression kinds.
 *
 * Expressions are JSON object trees — never strings — to eliminate an entire
 * class of parse errors and make them trivially editable by Claude.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * // "If amount > 100, return 0.1; otherwise return 0.0"
 * const expr: Expression = {
 *   kind: "op",
 *   op: ">",
 *   args: [
 *     { kind: "input", path: ["amount"] },
 *     { kind: "literal", value: 100 },
 *   ],
 * };
 * ```
 */
export type Expression =
  | LiteralExpression
  | InputExpression
  | RuleExpression
  | FnExpression
  | OpExpression;

/**
 * Zod schema for {@link Expression}.
 *
 * Validates a runtime value as a well-formed HyperFlux expression. Recursive
 * variants (`rule.args`, `fn.args`, `op.args`) use `z.lazy()` to handle
 * self-reference.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link Expression} for the inferred TypeScript type.
 */
export const Expression: z.ZodType<Expression> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal("literal"), value: z.unknown() }),
    z.object({ kind: z.literal("input"), path: z.array(z.string()) }),
    z.object({
      kind: z.literal("rule"),
      path: z.string(),
      args: z.array(Expression).optional(),
    }),
    z.object({
      kind: z.literal("fn"),
      name: z.string(),
      args: z.array(Expression),
    }),
    z.object({
      kind: z.literal("op"),
      op: z.string(),
      args: z.array(Expression),
    }),
  ])
);

// ---------------------------------------------------------------------------
// Case
// ---------------------------------------------------------------------------

/**
 * A single case within a rule's `cases` array.
 *
 * If `when` is present, the case matches when `when` evaluates to `true`.
 * If `when` is absent, the case is the unconditional default and must appear
 * last in the array.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const vipCase: Case = {
 *   when: { kind: "input", path: ["user", "is_vip"] },
 *   then: { kind: "literal", value: 0.1 },
 * };
 * const defaultCase: Case = {
 *   then: { kind: "literal", value: 0.0 },
 * };
 * ```
 */
export interface Case {
  /** Guard expression. Absent on the default case (must be last in the array). */
  when?: Expression;
  /** Value expression, evaluated when `when` matches or is absent. */
  then: Expression;
}

/**
 * Zod schema for {@link Case}.
 * @since 0.1.0
 * @public
 */
export const Case = z.object({
  when: Expression.optional(),
  then: Expression,
}) as unknown as z.ZodType<Case>;

// ---------------------------------------------------------------------------
// RuleInput
// ---------------------------------------------------------------------------

/**
 * Declaration of a single named input for a rule.
 *
 * Each input has a name (referenced by `InputExpression.path[0]`) and a
 * TypeSpec that the resolver validates at evaluation time.
 *
 * @since 0.1.0
 * @public
 */
export interface RuleInput {
  /** Identifier used to reference this input in expressions, e.g. `"amount"`. */
  name: string;
  /** Runtime type constraint for this input's value. */
  type: TypeSpec;
}

/**
 * Zod schema for {@link RuleInput}.
 * @since 0.1.0
 * @public
 */
export const RuleInput: z.ZodType<RuleInput> = z.object({
  name: z.string(),
  type: TypeSpec,
});

// ---------------------------------------------------------------------------
// RuleMetadata
// ---------------------------------------------------------------------------

/**
 * Metadata block attached to every rule.
 *
 * Carries versioning, domain attribution, optional human-readable description,
 * and an explicit `requires` list of rule paths that this rule depends on
 * (used for dependency-graph construction and cycle detection).
 *
 * @since 0.1.0
 * @public
 */
export interface RuleMetadata {
  /** Semver or monotonic version string for this specific rule, e.g. `"1"`. */
  version: string;
  /**
   * Explicit list of rule paths this rule depends on.
   * The loader uses this to build the dependency graph for cycle detection.
   * Defaults to `[]` if absent.
   */
  requires: string[];
  /** Domain this rule belongs to; must match the containing file's `domain` field. */
  domain: string;
  /** Optional prose description visible in TypeDoc and `hf trace` output. */
  description?: string;
}

/**
 * Zod schema for {@link RuleMetadata}.
 * @since 0.1.0
 * @public
 */
export const RuleMetadata = z.object({
  version: z.string(),
  requires: z.array(z.string()).default([]),
  domain: z.string(),
  description: z.string().optional(),
}) as unknown as z.ZodType<RuleMetadata>;

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * A complete HyperFlux rule.
 *
 * Rules are the central unit of HyperFlux. Every behavioral decision in a
 * HyperFlux application is expressed as one or more rules stored in JSON
 * under `rules/<domain>.json`. The resolver evaluates rules at request time
 * against typed inputs to produce a typed output.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const feeRule: Rule = {
 *   path: "pricing.atm.fee",
 *   kind: "compute",
 *   inputs: [{ name: "amount", type: { type: "number" } }],
 *   output: { type: "number" },
 *   cases: [
 *     {
 *       when: { kind: "op", op: ">", args: [
 *         { kind: "input", path: ["amount"] },
 *         { kind: "literal", value: 1000 },
 *       ]},
 *       then: { kind: "literal", value: 0 },
 *     },
 *     { then: { kind: "literal", value: 2.5 } },
 *   ],
 *   metadata: { version: "1", requires: [], domain: "pricing" },
 * };
 * ```
 */
export interface Rule {
  /**
   * Fully-qualified, dot-separated path. Must match the pattern
   * `/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/`.
   * The first segment must equal the containing file's `domain`.
   */
  path: string;
  /**
   * `"compute"` rules evaluate a dynamic expression tree against inputs.
   * `"config"` rules are static: single default case, no inputs.
   */
  kind: "compute" | "config";
  /**
   * Ordered list of typed inputs. For `"config"` rules this must be empty.
   */
  inputs: RuleInput[];
  /** Declared output type; the resolver validates every case output against this. */
  output: TypeSpec;
  /**
   * Ordered case list; at least one case is required.
   * The first case whose `when` evaluates to `true` wins.
   * A case without `when` is the unconditional default and must be last.
   */
  cases: [Case, ...Case[]];
  /** Version, domain, dependency, and description metadata. */
  metadata: RuleMetadata;
}

/**
 * Zod schema for {@link Rule}.
 *
 * The `path` regex is enforced here; domain–path consistency is enforced
 * by the loader (not Zod) to produce better error messages.
 *
 * @since 0.1.0
 * @public
 */
export const Rule = z.object({
  path: z
    .string()
    .regex(
      /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
      "Rule path must be lowercase dot-separated snake_case with at least two segments"
    ),
  kind: z.enum(["compute", "config"]),
  inputs: z.array(RuleInput),
  output: TypeSpec,
  cases: z.array(Case).min(1),
  metadata: RuleMetadata,
}) as unknown as z.ZodType<Rule>;

// ---------------------------------------------------------------------------
// DomainFile — the on-disk JSON file format
// ---------------------------------------------------------------------------

/**
 * The shape of a HyperFlux rule domain file stored under `rules/<domain>.json`.
 *
 * A domain file groups rules that share the same first path segment. The
 * loader validates that `domain` matches the filename stem and that every
 * rule's path starts with `<domain>.`.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```json
 * {
 *   "domain": "pricing",
 *   "version": "1",
 *   "rules": [
 *     { "path": "pricing.atm.fee", "kind": "compute", ... }
 *   ]
 * }
 * ```
 */
export interface DomainFile {
  /** Must equal the stem of the filename (e.g. `"pricing"` for `pricing.json`). */
  domain: string;
  /** File-level version string for change tracking. */
  version: string;
  /** Ordered list of rules in this domain. */
  rules: Rule[];
}

/**
 * Zod schema for {@link DomainFile}.
 * @since 0.1.0
 * @public
 */
export const DomainFile: z.ZodType<DomainFile> = z.object({
  domain: z
    .string()
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Domain must be a single lowercase snake_case segment"
    ),
  version: z.string(),
  rules: z.array(Rule),
});
