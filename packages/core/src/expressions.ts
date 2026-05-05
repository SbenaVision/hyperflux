/**
 * @file Operator and function registries for the HyperFlux DSL.
 *
 * Operators are loaded from `defaults/operators.json` at startup — they are
 * never hardcoded here. Functions are registered by user code in
 * `hyperflux.config.ts`. Both registries are passed to the Resolver and the
 * shallow type checker.
 *
 * @module @hyperflux/core/expressions
 * @since 0.1.0
 */

import type { TypeSpec } from "./schema";

// ---------------------------------------------------------------------------
// Operator definitions (loaded from defaults/operators.json)
// ---------------------------------------------------------------------------

/**
 * Describes how an operator handles variable-arity calls.
 *
 * - `2` / `1` — exact fixed arity.
 * - `"n"` — variadic; requires at least `min` arguments.
 *
 * @since 0.1.0
 * @public
 */
export type OperatorArity = 1 | 2 | "n";

/**
 * A single operator definition as it appears in `defaults/operators.json`.
 *
 * The resolver reads this file at startup and populates the
 * {@link OperatorRegistry}. Adding a new operator means editing
 * `defaults/operators.json` and restarting — no source changes required.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const eq: OperatorDefinition = {
 *   op: "==",
 *   arity: 2,
 *   input_types: ["any", "any"],
 *   output_type: "boolean",
 * };
 * const and: OperatorDefinition = {
 *   op: "AND",
 *   arity: "n",
 *   min: 2,
 *   input_types: "boolean",
 *   output_type: "boolean",
 * };
 * ```
 */
export interface OperatorDefinition {
  /** The operator symbol or name used in `OpExpression.op`, e.g. `"=="`, `"AND"`. */
  op: string;
  /** Arity: `1` unary, `2` binary, `"n"` variadic. */
  arity: OperatorArity;
  /**
   * Minimum argument count for variadic operators (`arity === "n"`).
   * Not present for fixed-arity operators.
   */
  min?: number;
  /**
   * Expected input type(s).
   * - Array form: one entry per positional argument (for fixed arity).
   * - String form: all arguments must have this type (for variadic `"n"`).
   */
  input_types: string[] | string;
  /** The type that this operator's result conforms to. */
  output_type: string;
}

/**
 * Read-only view of the operator registry, populated from
 * `defaults/operators.json` at startup.
 *
 * The resolver and the shallow type checker both depend on this interface.
 * There is exactly one `OperatorRegistry` instance per `Resolver`.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link OperatorDefinition}
 * @see {@link Resolver}
 *
 * @example
 * ```ts
 * const registry: OperatorRegistry = resolver.operatorRegistry;
 * const eq = registry.getOperator("=="); // OperatorDefinition | undefined
 * ```
 */
export interface OperatorRegistry {
  /**
   * Returns the definition for a given operator symbol, or `undefined` if the
   * operator is not registered.
   *
   * @param op - The operator symbol or name to look up, e.g. `"=="`.
   * @returns The operator definition, or `undefined` if not found.
   * @since 0.1.0
   */
  getOperator(op: string): OperatorDefinition | undefined;

  /**
   * Returns every registered operator in the order they were loaded.
   *
   * @returns An immutable snapshot of all operator definitions.
   * @since 0.1.0
   */
  getAllOperators(): ReadonlyArray<OperatorDefinition>;

  /**
   * Returns `true` if an operator with the given symbol is registered.
   *
   * @param op - The operator symbol to check.
   * @returns `true` if the operator exists in this registry.
   * @since 0.1.0
   */
  hasOperator(op: string): boolean;
}

// ---------------------------------------------------------------------------
// Function definitions (registered by user code)
// ---------------------------------------------------------------------------

/**
 * Declaration of a single named input parameter for a registered function.
 *
 * Mirrors {@link RuleInput} but belongs to the function registry rather than
 * the rule schema.
 *
 * @since 0.1.0
 * @public
 */
export interface FunctionInputDeclaration {
  /** Parameter name used for documentation and error messages. */
  name: string;
  /** TypeSpec that the argument must satisfy at evaluation time. */
  type: TypeSpec;
}

/**
 * Full definition of a pure function registered for use in `fn` expressions.
 *
 * Functions must be **pure**: deterministic, no I/O, no mutation, no async.
 * Registered via `FunctionRegistry.register` inside `hyperflux.config.ts`.
 *
 * @typeParam TInputs - Record type mapping parameter names to their values.
 * @typeParam TOutput - Return type of the function.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const def: FunctionDefinition<{ principal: number; rate: number; years: number }, number> = {
 *   name: "compoundInterest",
 *   inputs: [
 *     { name: "principal", type: { type: "number" } },
 *     { name: "rate",      type: { type: "number" } },
 *     { name: "years",     type: { type: "number" } },
 *   ],
 *   output: { type: "number" },
 *   implementation: ({ principal, rate, years }) =>
 *     principal * Math.pow(1 + rate, years),
 * };
 * ```
 */
export interface FunctionDefinition<
  TInputs extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  /** Unique name used to reference this function in `fn` expressions. */
  name: string;
  /**
   * Ordered list of input parameter declarations.
   * The shallow type checker validates argument expressions against these.
   */
  inputs: FunctionInputDeclaration[];
  /** Declared output type. */
  output: TypeSpec;
  /**
   * Pure function implementation.
   * Must not perform I/O, mutation, or async work.
   * Called with a record whose keys are the declared input `name` values.
   *
   * @param inputs - Named arguments, keyed by `FunctionInputDeclaration.name`.
   * @returns The computed output value.
   */
  implementation: (inputs: TInputs) => TOutput;
}

/**
 * Registry that stores pure functions available to rule `fn` expressions.
 *
 * User code calls `register` inside `hyperflux.config.ts`. The resolver and
 * the shallow type checker both read from this registry. A single
 * `FunctionRegistry` instance is shared between the `RuleLoader` (for type
 * checking) and the `Resolver` (for evaluation).
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const registry = new FunctionRegistry();
 * registry.register({
 *   name: "formatCurrency",
 *   inputs: [{ name: "amount", type: { type: "number" } }],
 *   output: { type: "string" },
 *   implementation: ({ amount }) => `$${amount.toFixed(2)}`,
 * });
 * ```
 */
export class FunctionRegistry {
  /**
   * Constructs a new, empty `FunctionRegistry`.
   *
   * @since 0.1.0
   */
  constructor() {
    throw new Error("Not implemented");
  }

  /**
   * Registers a pure function definition.
   *
   * The function is immediately available to subsequently loaded rules.
   * All functions must be registered before calling `RuleLoader.load()`.
   *
   * @typeParam TInputs - Record type for the function's named parameters.
   * @typeParam TOutput - Return type of the function.
   * @param definition - Complete function definition including signature and implementation.
   * @throws {Error} If a function with the same `name` is already registered.
   * @since 0.1.0
   *
   * @example
   * ```ts
   * registry.register({
   *   name: "clamp",
   *   inputs: [
   *     { name: "value", type: { type: "number" } },
   *     { name: "min",   type: { type: "number" } },
   *     { name: "max",   type: { type: "number" } },
   *   ],
   *   output: { type: "number" },
   *   implementation: ({ value, min, max }) => Math.min(Math.max(value, min), max),
   * });
   * ```
   */
  register<
    TInputs extends Record<string, unknown>,
    TOutput,
  >(definition: FunctionDefinition<TInputs, TOutput>): void {
    throw new Error("Not implemented");
  }

  /**
   * Returns the function definition registered under the given name, or
   * `undefined` if no function with that name has been registered.
   *
   * @param name - The function name to look up.
   * @returns The definition, or `undefined` if not registered.
   * @since 0.1.0
   */
  get(name: string): FunctionDefinition | undefined {
    throw new Error("Not implemented");
  }

  /**
   * Returns every registered function definition in registration order.
   *
   * @returns An immutable snapshot of all registered definitions.
   * @since 0.1.0
   */
  getAll(): ReadonlyArray<FunctionDefinition> {
    throw new Error("Not implemented");
  }

  /**
   * Returns `true` if a function with the given name has been registered.
   *
   * @param name - The function name to check.
   * @returns `true` if the function exists in this registry.
   * @since 0.1.0
   */
  has(name: string): boolean {
    throw new Error("Not implemented");
  }
}

// ---------------------------------------------------------------------------
// Canonical JSON serialization (for cache keys)
// ---------------------------------------------------------------------------

/**
 * Serializes a plain JSON-compatible value to a canonical string with
 * recursively sorted object keys.
 *
 * The resolver uses this to produce deterministic cache keys of the form
 * `"<path>::<canonicalJSON(inputs)>"` regardless of the order in which
 * callers construct their input objects.
 *
 * Symbols and functions in `value` are rejected and cause an error — inputs
 * must be plain JSON-serializable values.
 *
 * @param value - A plain JSON-serializable value to canonicalize.
 * @returns A canonical JSON string with object keys sorted recursively.
 * @throws {TypeError} If `value` contains a Symbol or function, which cannot be JSON-serialized.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * canonicalJSON({ b: 2, a: 1 }); // '{"a":1,"b":2}'
 * canonicalJSON({ b: { d: 4, c: 3 }, a: 1 }); // '{"a":1,"b":{"c":3,"d":4}}'
 * canonicalJSON([3, 1, 2]); // '[3,1,2]'  (arrays preserve order)
 * ```
 *
 * @see {@link RequestContext} for cache key usage.
 */
export function canonicalJSON(value: unknown): string {
  throw new Error("Not implemented");
}

/**
 * Builds the string cache key used by the resolver for a given rule evaluation.
 *
 * The key is `"<path>::<canonicalJSON(inputs)>"`. Two evaluations with the
 * same `path` and inputs (regardless of key order) will produce identical keys.
 *
 * @param path - The fully-qualified rule path being evaluated.
 * @param inputs - The plain-JSON inputs record for this evaluation.
 * @returns A deterministic cache key string.
 * @throws {TypeError} If `inputs` contains non-serializable values.
 * @since 0.1.0
 * @public
 *
 * @see {@link canonicalJSON}
 * @see {@link RequestContext}
 */
export function buildCacheKey(
  path: string,
  inputs: Record<string, unknown>
): string {
  throw new Error("Not implemented");
}
