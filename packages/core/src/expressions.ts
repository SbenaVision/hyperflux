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
 * @since 0.1.0
 * @public
 */
export type OperatorArity = 1 | 2 | "n";

/**
 * A single operator definition as it appears in `defaults/operators.json`.
 * @since 0.1.0
 * @public
 */
export interface OperatorDefinition {
  op: string;
  arity: OperatorArity;
  min?: number;
  input_types: string[] | string;
  output_type: string;
}

/**
 * Read-only view of the operator registry, populated from
 * `defaults/operators.json` at startup.
 * @since 0.1.0
 * @public
 */
export interface OperatorRegistry {
  getOperator(op: string): OperatorDefinition | undefined;
  getAllOperators(): ReadonlyArray<OperatorDefinition>;
  hasOperator(op: string): boolean;
}

/**
 * Concrete implementation of {@link OperatorRegistry}.
 * @since 0.1.0
 * @internal
 */
export class OperatorRegistryImpl implements OperatorRegistry {
  private readonly _map = new Map<string, OperatorDefinition>();
  private readonly _all: OperatorDefinition[] = [];

  constructor(definitions: OperatorDefinition[]) {
    for (const def of definitions) {
      this._map.set(def.op, def);
      this._all.push(def);
    }
  }

  getOperator(op: string): OperatorDefinition | undefined {
    return this._map.get(op);
  }

  getAllOperators(): ReadonlyArray<OperatorDefinition> {
    return this._all;
  }

  hasOperator(op: string): boolean {
    return this._map.has(op);
  }
}

// ---------------------------------------------------------------------------
// Function definitions (registered by user code)
// ---------------------------------------------------------------------------

/**
 * Declaration of a single named input parameter for a registered function.
 * @since 0.1.0
 * @public
 */
export interface FunctionInputDeclaration {
  name: string;
  type: TypeSpec;
}

/**
 * Full definition of a pure function registered for use in `fn` expressions.
 * @since 0.1.0
 * @public
 */
export interface FunctionDefinition<
  TInputs extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  name: string;
  inputs: FunctionInputDeclaration[];
  output: TypeSpec;
  implementation: (inputs: TInputs) => TOutput;
}

/**
 * Registry that stores pure functions available to rule `fn` expressions.
 * @since 0.1.0
 * @public
 */
export class FunctionRegistry {
  private readonly _map = new Map<string, FunctionDefinition>();

  constructor() {}

  register<TInputs extends Record<string, unknown>, TOutput>(
    definition: FunctionDefinition<TInputs, TOutput>
  ): void {
    if (this._map.has(definition.name)) {
      throw new Error(`Function '${definition.name}' is already registered`);
    }
    this._map.set(definition.name, definition as FunctionDefinition);
  }

  get(name: string): FunctionDefinition | undefined {
    return this._map.get(name);
  }

  getAll(): ReadonlyArray<FunctionDefinition> {
    return Array.from(this._map.values());
  }

  has(name: string): boolean {
    return this._map.has(name);
  }
}

// ---------------------------------------------------------------------------
// Canonical JSON serialization (for cache keys)
// ---------------------------------------------------------------------------

/**
 * Serializes a plain JSON-compatible value to a canonical string with
 * recursively sorted object keys.
 * @since 0.1.0
 * @public
 */
export function canonicalJSON(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "null";
  const t = typeof value;
  if (t === "boolean" || t === "number") return String(value);
  if (t === "string") return JSON.stringify(value);
  if (t === "symbol" || t === "function") {
    throw new TypeError(`Cannot canonicalize value of type ${t}`);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJSON).join(",") + "]";
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + canonicalJSON(obj[k])).join(",") +
      "}"
    );
  }
  throw new TypeError(`Cannot canonicalize value of type ${t}`);
}

/**
 * Builds the string cache key used by the resolver for a given rule evaluation.
 * @since 0.1.0
 * @public
 */
export function buildCacheKey(
  path: string,
  inputs: Record<string, unknown>
): string {
  return path + "::" + canonicalJSON(inputs);
}
