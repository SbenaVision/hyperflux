/**
 * @file Resolver — the core rule evaluation engine.
 * @module @hyperflux/core/resolver
 * @since 0.1.0
 */

import type { TypeSpec, Expression, Rule } from "./schema";
import type { FunctionRegistry, OperatorRegistry } from "./expressions";
import { buildCacheKey } from "./expressions";
import type { RuleStore } from "./rules";
import type { TraceNode, TraceTree } from "./trace";
import {
  RuleNotFoundError,
  InputTypeError,
  OutputTypeError,
  NoMatchingCaseError,
  FunctionNotRegisteredError,
} from "./errors";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ResolverOptions {
  ruleStore: RuleStore;
  functionRegistry: FunctionRegistry;
  operatorRegistry: OperatorRegistry;
}

export interface RequestContextOptions {
  recordTrace?: boolean;
}

// ---------------------------------------------------------------------------
// Runtime type check
// ---------------------------------------------------------------------------

function checkType(value: unknown, spec: TypeSpec): boolean {
  switch (spec.type) {
    case "any":     return true;
    case "null":    return value === null;
    case "string":  return typeof value === "string";
    case "number":  return typeof value === "number";
    case "boolean": return typeof value === "boolean";
    case "array":
      if (!Array.isArray(value)) return false;
      return value.every((item) => checkType(item, spec.items));
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
      const obj = value as Record<string, unknown>;
      for (const [key, fieldSpec] of Object.entries(spec.shape)) {
        if (!checkType(obj[key], fieldSpec)) return false;
      }
      return true;
    }
  }
}

function typeSpecName(spec: TypeSpec): string {
  if (spec.type === "array") return `array<${typeSpecName(spec.items)}>`;
  if (spec.type === "object") return "object";
  return spec.type;
}

function runtimeTypeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

// ---------------------------------------------------------------------------
// RequestContext
// ---------------------------------------------------------------------------

export class RequestContext {
  readonly recordTrace: boolean;
  private readonly _cache = new Map<string, unknown>();
  private readonly _traceNodes: TraceNode[] = [];

  constructor(options?: RequestContextOptions) {
    this.recordTrace = options?.recordTrace ?? false;
  }

  getTrace(): TraceTree | null {
    if (!this.recordTrace || this._traceNodes.length === 0) return null;
    const root = this._traceNodes[0];
    let totalTime = 0;
    let evalCount = 0;
    let cacheHits = 0;
    const walk = (node: TraceNode) => {
      totalTime += node.timeMs;
      evalCount++;
      if (node.cached) cacheHits++;
      for (const child of node.children) walk(child);
    };
    walk(root);
    return { root, totalTimeMs: totalTime, evaluationCount: evalCount, cacheHitCount: cacheHits };
  }

  getCacheEntry(key: string): unknown | undefined {
    return this._cache.has(key) ? this._cache.get(key) : undefined;
  }

  setCacheEntry(key: string, value: unknown): void {
    this._cache.set(key, value);
  }

  recordEvaluation(node: TraceNode): void {
    if (!this.recordTrace) return;
    this._traceNodes.push(node);
  }

  get cacheSize(): number {
    return this._cache.size;
  }
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export class Resolver {
  private _ruleStore: RuleStore;
  private readonly _functionRegistry: FunctionRegistry;
  private readonly _operatorRegistry: OperatorRegistry;

  constructor(options: ResolverOptions) {
    this._ruleStore = options.ruleStore;
    this._functionRegistry = options.functionRegistry;
    this._operatorRegistry = options.operatorRegistry;
  }

  evaluate<T = unknown>(
    path: string,
    inputs: Record<string, unknown>,
    ctx?: RequestContext
  ): T {
    return this._evaluate<T>(path, inputs, ctx);
  }

  evaluateAs<T = unknown>(
    path: string,
    expectedType: TypeSpec,
    inputs: Record<string, unknown>,
    ctx?: RequestContext
  ): T {
    const result = this._evaluate<T>(path, inputs, ctx);
    if (!checkType(result, expectedType)) {
      throw new OutputTypeError({
        path,
        caseIndex: -1,
        expected: typeSpecName(expectedType),
        actual: runtimeTypeName(result),
      });
    }
    return result;
  }

  swapRuleStore(ruleStore: RuleStore): void {
    this._ruleStore = ruleStore;
  }

  get ruleStore(): RuleStore { return this._ruleStore; }
  get operatorRegistry(): OperatorRegistry { return this._operatorRegistry; }
  get functionRegistry(): FunctionRegistry { return this._functionRegistry; }

  // ---------------------------------------------------------------------------
  // Core evaluation
  // ---------------------------------------------------------------------------

  private _evaluate<T>(
    path: string,
    inputs: Record<string, unknown>,
    ctx?: RequestContext
  ): T {
    // 1. Look up rule
    const rule = this._ruleStore.get(path);
    if (!rule) throw new RuleNotFoundError({ path });

    // 2. Validate inputs
    this._validateInputs(rule, inputs);

    // 3. Check cache
    const cacheKey = buildCacheKey(path, inputs);
    if (ctx) {
      const cached = ctx.getCacheEntry(cacheKey);
      if (cached !== undefined) {
        if (ctx.recordTrace) {
          ctx.recordEvaluation({
            path,
            inputs,
            output: cached,
            caseIndex: -1,
            timeMs: 0,
            cached: true,
            children: [],
          });
        }
        return cached as T;
      }
    }

    // 4–6. Iterate cases
    const start = performance.now();
    let matched = false;
    let matchedCaseIndex = 0;
    let output: unknown;

    for (let i = 0; i < rule.cases.length; i++) {
      const c = rule.cases[i];
      if (c.when === undefined) {
        // Unconditional default
        output = this._evaluateExpression(c.then, inputs, path, ctx);
        matchedCaseIndex = i;
        matched = true;
        break;
      }
      const guardResult = this._evaluateExpression(c.when, inputs, path, ctx);
      if (guardResult === true) {
        output = this._evaluateExpression(c.then, inputs, path, ctx);
        matchedCaseIndex = i;
        matched = true;
        break;
      }
    }

    if (!matched) {
      throw new NoMatchingCaseError({ path, inputs });
    }

    // 6. Validate output type
    if (!checkType(output, rule.output)) {
      throw new OutputTypeError({
        path,
        caseIndex: matchedCaseIndex,
        expected: typeSpecName(rule.output),
        actual: runtimeTypeName(output),
      });
    }

    const timeMs = performance.now() - start;

    // 7. Cache result
    if (ctx) {
      ctx.setCacheEntry(cacheKey, output);
      if (ctx.recordTrace) {
        ctx.recordEvaluation({
          path,
          inputs,
          output,
          caseIndex: matchedCaseIndex,
          timeMs,
          cached: false,
          children: [],
        });
      }
    }

    return output as T;
  }

  private _validateInputs(rule: Rule, inputs: Record<string, unknown>): void {
    for (const inputDecl of rule.inputs) {
      const value = inputs[inputDecl.name];
      if (!checkType(value, inputDecl.type)) {
        throw new InputTypeError({
          name: inputDecl.name,
          path: rule.path,
          expected: typeSpecName(inputDecl.type),
          actual: runtimeTypeName(value),
        });
      }
    }
  }

  private _evaluateExpression(
    expr: Expression,
    inputs: Record<string, unknown>,
    rulePath: string,
    ctx?: RequestContext
  ): unknown {
    switch (expr.kind) {
      case "literal":
        return expr.value;

      case "input": {
        let val: unknown = inputs;
        for (const key of expr.path) {
          if (typeof val !== "object" || val === null) return undefined;
          val = (val as Record<string, unknown>)[key];
        }
        return val;
      }

      case "rule": {
        const ruleInputs: Record<string, unknown> = {};
        if (expr.args && expr.args.length > 0) {
          const targetRule = this._ruleStore.get(expr.path);
          if (targetRule) {
            for (let i = 0; i < expr.args.length; i++) {
              const inputName = targetRule.inputs[i]?.name ?? String(i);
              ruleInputs[inputName] = this._evaluateExpression(
                expr.args[i],
                inputs,
                rulePath,
                ctx
              );
            }
          }
        }
        return this._evaluate(expr.path, ruleInputs, ctx);
      }

      case "fn": {
        if (!this._functionRegistry.has(expr.name)) {
          throw new FunctionNotRegisteredError({ name: expr.name, path: rulePath });
        }
        const def = this._functionRegistry.get(expr.name)!;
        const fnInputs: Record<string, unknown> = {};
        for (let i = 0; i < expr.args.length; i++) {
          const paramName = def.inputs[i]?.name ?? String(i);
          fnInputs[paramName] = this._evaluateExpression(expr.args[i], inputs, rulePath, ctx);
        }
        return def.implementation(fnInputs);
      }

      case "op": {
        const opDef = this._operatorRegistry.getOperator(expr.op);
        if (!opDef) {
          throw new Error(`Unknown operator '${expr.op}' in rule '${rulePath}'`);
        }
        const args = expr.args.map((a) =>
          this._evaluateExpression(a, inputs, rulePath, ctx)
        );
        return this._applyOperator(expr.op, args);
      }
    }
  }

  private _applyOperator(op: string, args: unknown[]): unknown {
    switch (op) {
      case "==":  return args[0] === args[1];
      case "!=":  return args[0] !== args[1];
      case "<":   return (args[0] as number) < (args[1] as number);
      case "<=":  return (args[0] as number) <= (args[1] as number);
      case ">":   return (args[0] as number) > (args[1] as number);
      case ">=":  return (args[0] as number) >= (args[1] as number);
      case "+":   return (args[0] as number) + (args[1] as number);
      case "-":   return (args[0] as number) - (args[1] as number);
      case "*":   return (args[0] as number) * (args[1] as number);
      case "/":   return (args[0] as number) / (args[1] as number);
      case "%":   return (args[0] as number) % (args[1] as number);
      case "AND": return args.every(Boolean);
      case "OR":  return args.some(Boolean);
      case "NOT": return !args[0];
      default:    throw new Error(`No implementation for operator '${op}'`);
    }
  }
}
