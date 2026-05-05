/**
 * @file HyperFlux error hierarchy.
 *
 * All error codes, messages, and structured context fields are defined here.
 * Message *templates* are externalized in `defaults/errors.json`; the classes
 * below define structure and TypeScript types only.
 *
 * @module @hyperflux/core/errors
 * @since 0.1.0
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/**
 * Enumeration of all HyperFlux error codes.
 *
 * Each code corresponds to a key in `defaults/errors.json`, which supplies
 * the message template. Adding a new error requires adding an entry there
 * **first**, then adding a member here.
 *
 * @since 0.1.0
 * @public
 */
export enum HyperFluxErrorCode {
  /** Rule path was not found in the loaded rule store. */
  RULE_NOT_FOUND = "HF001",
  /** An input value did not match the declared TypeSpec for that input. */
  INPUT_TYPE_ERROR = "HF002",
  /** A case `then` expression produced a value that violated the rule's output TypeSpec. */
  OUTPUT_TYPE_ERROR = "HF003",
  /** No case matched the given inputs and the rule has no default case. */
  NO_MATCHING_CASE = "HF004",
  /** A `fn` expression referenced a function name that was not registered. */
  FUNCTION_NOT_REGISTERED = "HF005",
  /** The rule dependency graph contains a cycle. */
  RULE_CYCLE = "HF006",
  /** The domain declared in a rule file does not match its filename. */
  DOMAIN_MISMATCH = "HF007",
  /** Two or more rules share the same path within the loaded store. */
  DUPLICATE_PATH = "HF008",
  /** An expression or rule reference failed the shallow type check at load time. */
  SHALLOW_TYPE_ERROR = "HF009",
  /** One or more rule files failed to load; wraps multiple child errors. */
  LOAD_ERROR = "HF010",
}

// ---------------------------------------------------------------------------
// Base error
// ---------------------------------------------------------------------------

/**
 * Base class for all errors thrown by HyperFlux.
 *
 * Every HyperFlux error carries a machine-readable `code` (from
 * `HyperFluxErrorCode`) and a structured `context` object for programmatic
 * inspection. Message strings are derived from `defaults/errors.json` at
 * runtime.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * try {
 *   resolver.evaluate("pricing.fee", { amount: 100 }, ctx);
 * } catch (err) {
 *   if (err instanceof HyperFluxError) {
 *     console.error(err.code, err.context);
 *   }
 * }
 * ```
 */
export abstract class HyperFluxError extends Error {
  /**
   * Machine-readable error code matching a key in `defaults/errors.json`.
   * @since 0.1.0
   */
  abstract readonly code: HyperFluxErrorCode;

  /**
   * Structured context for programmatic inspection. The shape differs per
   * subclass; see each subclass for its specific context interface.
   * @since 0.1.0
   */
  abstract readonly context: object;

  /**
   * Constructs a HyperFluxError with a formatted message.
   *
   * @param message - Human-readable description, formatted from the template in `defaults/errors.json`.
   * @since 0.1.0
   */
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Resolver errors
// ---------------------------------------------------------------------------

/**
 * Context carried by a {@link RuleNotFoundError}.
 * @since 0.1.0
 * @public
 */
export interface RuleNotFoundContext {
  /** The rule path that was requested but not found. */
  path: string;
}

/**
 * Thrown when `Resolver.evaluate` is called with a path that does not exist
 * in the loaded `RuleStore`. Corresponds to error code HF001.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * try {
 *   resolver.evaluate("pricing.unknown_rule", {}, ctx);
 * } catch (err) {
 *   if (err instanceof RuleNotFoundError) {
 *     console.error("Missing rule:", err.context.path); // "pricing.unknown_rule"
 *   }
 * }
 * ```
 *
 * @see {@link Resolver.evaluate}
 * @see {@link HyperFluxErrorCode.RULE_NOT_FOUND}
 */
export class RuleNotFoundError extends HyperFluxError {
  readonly code = HyperFluxErrorCode.RULE_NOT_FOUND;

  /**
   * @param context - Structured context identifying the missing rule path.
   */
  constructor(readonly context: RuleNotFoundContext) {
    super(`Rule '${context.path}' not found`);
  }
}

/**
 * Context carried by an {@link InputTypeError}.
 * @since 0.1.0
 * @public
 */
export interface InputTypeContext {
  /** Name of the input that failed type validation. */
  name: string;
  /** Path of the rule being evaluated. */
  path: string;
  /** Human-readable description of the declared type. */
  expected: string;
  /** Human-readable description of the actual runtime type. */
  actual: string;
}

/**
 * Thrown when an input value passed to `Resolver.evaluate` does not satisfy
 * the TypeSpec declared for that input on the rule. Corresponds to HF002.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * // Rule "pricing.fee" declares input "amount" as { type: "number" }
 * resolver.evaluate("pricing.fee", { amount: "not-a-number" }, ctx);
 * // throws InputTypeError: { name: "amount", expected: "number", actual: "string" }
 * ```
 *
 * @see {@link Resolver.evaluate}
 * @see {@link HyperFluxErrorCode.INPUT_TYPE_ERROR}
 */
export class InputTypeError extends HyperFluxError {
  readonly code = HyperFluxErrorCode.INPUT_TYPE_ERROR;

  /**
   * @param context - Structured context with the failing input name, path, expected type, and actual type.
   */
  constructor(readonly context: InputTypeContext) {
    super(
      `Input '${context.name}' type mismatch in rule '${context.path}': expected ${context.expected}, got ${context.actual}`
    );
  }
}

/**
 * Context carried by an {@link OutputTypeError}.
 * @since 0.1.0
 * @public
 */
export interface OutputTypeContext {
  /** Zero-based index of the case whose output failed validation. */
  caseIndex: number;
  /** Path of the rule being evaluated. */
  path: string;
  /** Human-readable description of the declared output type. */
  expected: string;
  /** Human-readable description of the actual runtime type. */
  actual: string;
}

/**
 * Thrown when a case's `then` expression evaluates to a value that does not
 * match the rule's declared output TypeSpec. Corresponds to HF003.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link Resolver.evaluate}
 * @see {@link HyperFluxErrorCode.OUTPUT_TYPE_ERROR}
 */
export class OutputTypeError extends HyperFluxError {
  readonly code = HyperFluxErrorCode.OUTPUT_TYPE_ERROR;

  /**
   * @param context - Structured context with the failing case index, path, expected type, and actual type.
   */
  constructor(readonly context: OutputTypeContext) {
    super(
      `Case ${context.caseIndex} output type mismatch in rule '${context.path}': expected ${context.expected}, got ${context.actual}`
    );
  }
}

/**
 * Context carried by a {@link NoMatchingCaseError}.
 * @since 0.1.0
 * @public
 */
export interface NoMatchingCaseContext {
  /** Path of the rule that had no matching case. */
  path: string;
  /** The inputs that were provided, serialized for debugging. */
  inputs: Record<string, unknown>;
}

/**
 * Thrown when no case in a rule matches the provided inputs and the rule
 * has no default (unconditional) case. Corresponds to HF004.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link Resolver.evaluate}
 * @see {@link HyperFluxErrorCode.NO_MATCHING_CASE}
 */
export class NoMatchingCaseError extends HyperFluxError {
  readonly code = HyperFluxErrorCode.NO_MATCHING_CASE;

  /**
   * @param context - Structured context with the rule path and the inputs that found no match.
   */
  constructor(readonly context: NoMatchingCaseContext) {
    super(`No matching case in rule '${context.path}' and no default present`);
  }
}

/**
 * Context carried by a {@link FunctionNotRegisteredError}.
 * @since 0.1.0
 * @public
 */
export interface FunctionNotRegisteredContext {
  /** Name of the function that was referenced but not registered. */
  name: string;
  /** Path of the rule that contained the unresolved function reference. */
  path: string;
}

/**
 * Thrown when an expression of kind `"fn"` references a function name that
 * was not registered in the `FunctionRegistry`. Corresponds to HF005.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link FunctionRegistry}
 * @see {@link HyperFluxErrorCode.FUNCTION_NOT_REGISTERED}
 */
export class FunctionNotRegisteredError extends HyperFluxError {
  readonly code = HyperFluxErrorCode.FUNCTION_NOT_REGISTERED;

  /**
   * @param context - Structured context with the unregistered function name and the containing rule path.
   */
  constructor(readonly context: FunctionNotRegisteredContext) {
    super(
      `Function '${context.name}' not registered (referenced in rule '${context.path}')`
    );
  }
}

// ---------------------------------------------------------------------------
// Loader errors
// ---------------------------------------------------------------------------

/**
 * Context carried by a {@link RuleCycleError}.
 * @since 0.1.0
 * @public
 */
export interface RuleCycleContext {
  /** Ordered array of rule paths that form the cycle, e.g. `["a.b", "a.c", "a.b"]`. */
  cycle: string[];
}

/**
 * Thrown during rule loading when the dependency graph contains a cycle.
 * The loader rejects the entire rule store when a cycle is detected.
 * Corresponds to HF006.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link RuleLoader}
 * @see {@link HyperFluxErrorCode.RULE_CYCLE}
 */
export class RuleCycleError extends HyperFluxError {
  readonly code = HyperFluxErrorCode.RULE_CYCLE;

  /**
   * @param context - Structured context listing the paths that form the cycle.
   */
  constructor(readonly context: RuleCycleContext) {
    super(`Cyclic rule dependency detected: ${context.cycle.join(" → ")}`);
  }
}

/**
 * Context carried by a {@link DomainMismatchError}.
 * @since 0.1.0
 * @public
 */
export interface DomainMismatchContext {
  /** The `domain` field declared in the JSON file. */
  declaredDomain: string;
  /** The domain inferred from the filename (without extension). */
  filenameDomain: string;
  /** Absolute path to the offending file. */
  filePath: string;
}

/**
 * Thrown during loading when a rule file's declared `domain` field does not
 * match the file's stem (filename without extension). Corresponds to HF007.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link RuleLoader}
 * @see {@link HyperFluxErrorCode.DOMAIN_MISMATCH}
 */
export class DomainMismatchError extends HyperFluxError {
  readonly code = HyperFluxErrorCode.DOMAIN_MISMATCH;

  /**
   * @param context - Structured context with the declared domain, filename-derived domain, and file path.
   */
  constructor(readonly context: DomainMismatchContext) {
    super(
      `Domain '${context.declaredDomain}' in file '${context.filePath}' does not match filename domain '${context.filenameDomain}'`
    );
  }
}

/**
 * Context carried by a {@link DuplicatePathError}.
 * @since 0.1.0
 * @public
 */
export interface DuplicatePathContext {
  /** The rule path that appeared more than once. */
  path: string;
  /** Absolute paths to all files that declared this path. */
  files: string[];
}

/**
 * Thrown during loading when two or more rules share the same path across
 * the loaded rule store. Corresponds to HF008.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link RuleLoader}
 * @see {@link HyperFluxErrorCode.DUPLICATE_PATH}
 */
export class DuplicatePathError extends HyperFluxError {
  readonly code = HyperFluxErrorCode.DUPLICATE_PATH;

  /**
   * @param context - Structured context with the duplicated path and the files that define it.
   */
  constructor(readonly context: DuplicatePathContext) {
    super(
      `Duplicate rule path '${context.path}' found in: ${context.files.join(", ")}`
    );
  }
}

/**
 * Context carried by a {@link ShallowTypeError}.
 * @since 0.1.0
 * @public
 */
export interface ShallowTypeContext {
  /** Path of the rule that failed the shallow type check. */
  path: string;
  /** Human-readable description of the type violation found. */
  violation: string;
}

/**
 * Thrown during loading when the shallow type checker detects a type
 * inconsistency in a rule — e.g., operator arity mismatch or function
 * signature mismatch. Corresponds to HF009.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link RuleLoader}
 * @see {@link HyperFluxErrorCode.SHALLOW_TYPE_ERROR}
 */
export class ShallowTypeError extends HyperFluxError {
  readonly code = HyperFluxErrorCode.SHALLOW_TYPE_ERROR;

  /**
   * @param context - Structured context with the rule path and a description of the violation.
   */
  constructor(readonly context: ShallowTypeContext) {
    super(`Shallow type error in rule '${context.path}': ${context.violation}`);
  }
}

/**
 * Context carried by a {@link LoadError}.
 * @since 0.1.0
 * @public
 */
export interface LoadErrorContext {
  /** All individual errors encountered during the loading pass. */
  errors: HyperFluxError[];
}

/**
 * Aggregate error thrown when `RuleLoader.load()` encounters one or more
 * validation failures. Collects all child errors so callers can report
 * every problem in a single pass rather than fail-fast. Corresponds to HF010.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * try {
 *   await loader.load();
 * } catch (err) {
 *   if (err instanceof LoadError) {
 *     for (const child of err.context.errors) {
 *       console.error(child.code, child.message);
 *     }
 *   }
 * }
 * ```
 *
 * @see {@link RuleLoader}
 * @see {@link HyperFluxErrorCode.LOAD_ERROR}
 */
export class LoadError extends HyperFluxError {
  readonly code = HyperFluxErrorCode.LOAD_ERROR;

  /**
   * @param context - Structured context wrapping all individual load-time errors.
   */
  constructor(readonly context: LoadErrorContext) {
    super(
      `Rule store failed to load with ${context.errors.length} error(s):\n` +
        context.errors.map((e) => `  [${e.code}] ${e.message}`).join("\n")
    );
  }
}
