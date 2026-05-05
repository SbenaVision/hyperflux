/**
 * @file Rule loader — scans, validates, indexes, and hot-reloads rule files.
 *
 * `RuleLoader` is the entry point for loading a HyperFlux rule store from
 * disk. It reads every `*.json` file in the configured rules directory,
 * validates them against the {@link DomainFile} schema, builds a
 * {@link RuleStore} with a dependency graph, runs the shallow type checker,
 * and rejects the entire store on any error (fail-fast at startup).
 *
 * In development mode it also starts a file watcher that re-runs the same
 * pipeline on any file change and atomically swaps the store on success,
 * preserving the old store on failure.
 *
 * @module @hyperflux/core/loader
 * @since 0.1.0
 */

import type { DomainFile } from "./schema";
import type { FunctionRegistry, OperatorRegistry } from "./expressions";
import type { RuleStore } from "./rules";
import type { HyperFluxError, LoadError } from "./errors";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options for constructing a {@link RuleLoader}.
 *
 * @since 0.1.0
 * @public
 */
export interface LoaderOptions {
  /**
   * Absolute or CWD-relative path to the directory containing rule JSON files.
   * Defaults to `"rules"` relative to `process.cwd()` if not provided.
   * The default glob patterns are loaded from `defaults/watch-patterns.json`.
   */
  rulesDir: string;

  /**
   * Populated function registry used for shallow type checking during load.
   * Must be fully populated before calling `load()`.
   */
  functionRegistry: FunctionRegistry;

  /**
   * Operator registry populated from `defaults/operators.json`.
   */
  operatorRegistry: OperatorRegistry;

  /**
   * Runtime environment.
   * In `"production"` mode hot reload is disabled regardless of `watchPatterns`.
   * @defaultValue `"development"` when `NODE_ENV !== "production"`.
   */
  env?: "development" | "production";

  /**
   * Custom glob patterns for files to watch in dev mode.
   * When omitted, patterns are loaded from `defaults/watch-patterns.json`.
   */
  watchPatterns?: string[];
}

// ---------------------------------------------------------------------------
// LoadResult
// ---------------------------------------------------------------------------

/**
 * The successful result of `RuleLoader.load()`.
 *
 * @since 0.1.0
 * @public
 */
export interface LoadResult {
  /**
   * Validated, indexed, dependency-sorted rule store ready to pass to
   * `Resolver` or `Analyzer`.
   */
  ruleStore: RuleStore;

  /**
   * The parsed domain file records, in file-system scan order.
   * Useful for tools (lint, trace) that need file-level metadata.
   */
  domainFiles: ReadonlyArray<DomainFile>;

  /**
   * Non-fatal warnings produced during loading, e.g. empty domain files.
   * The store is valid despite warnings.
   */
  warnings: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// HotReloadHandler
// ---------------------------------------------------------------------------

/**
 * Callback type for successful hot-reload events.
 *
 * Called by `RuleLoader.watch()` each time a rule file changes and the new
 * store validates successfully.
 *
 * @param result - The new load result with the updated rule store.
 * @since 0.1.0
 * @public
 */
export type HotReloadSuccessHandler = (result: LoadResult) => void;

/**
 * Callback type for hot-reload validation failures.
 *
 * Called when a rule file change produces an invalid store. The previous
 * valid store is preserved; callers should log the error and continue serving
 * the old rules.
 *
 * @param error - The load error describing what went wrong.
 * @since 0.1.0
 * @public
 */
export type HotReloadErrorHandler = (error: LoadError) => void;

/**
 * Function returned by `RuleLoader.watch()` that stops the file watcher.
 *
 * Call this during application shutdown or in tests to prevent resource leaks.
 *
 * @returns `void`.
 * @since 0.1.0
 * @public
 */
export type StopWatching = () => void;

// ---------------------------------------------------------------------------
// RuleLoader
// ---------------------------------------------------------------------------

/**
 * Scans a rules directory, validates all domain files, builds a
 * {@link RuleStore}, and optionally starts a hot-reload watcher in dev mode.
 *
 * **Load pipeline** (per spec §6.3):
 * 1. Scan `rulesDir` for `*.json` files.
 * 2. Parse and validate each file with the {@link DomainFile} Zod schema.
 * 3. Assert that `domain` matches the filename stem.
 * 4. Assert that every rule's `path` starts with `<domain>.`.
 * 5. Assert that no two rules share the same `path`.
 * 6. Build the dependency graph; reject cycles.
 * 7. Run the shallow type checker on all rules.
 * 8. On any failure: collect all errors and throw a {@link LoadError}.
 * 9. On success: return a {@link LoadResult} with the validated store.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const loader = new RuleLoader({
 *   rulesDir: "./rules",
 *   functionRegistry,
 *   operatorRegistry,
 *   env: "development",
 * });
 *
 * const { ruleStore } = await loader.load();
 *
 * // Start hot reload in dev
 * const stop = loader.watch(
 *   (result) => resolver.swapRuleStore(result.ruleStore),
 *   (err) => console.error("Hot reload failed:", err.message),
 * );
 * process.on("SIGTERM", stop);
 * ```
 *
 * @see {@link LoadResult}
 * @see {@link LoadError}
 */
export class RuleLoader {
  /**
   * Constructs a new `RuleLoader` with the given options.
   *
   * @param options - Loader configuration including rules directory and registries.
   * @since 0.1.0
   */
  constructor(options: LoaderOptions) {
    throw new Error("Not implemented");
  }

  /**
   * Executes the full load pipeline asynchronously and returns the result.
   *
   * Reads all `*.json` files from `rulesDir`, validates them, builds the store,
   * and returns the result. Any validation failure causes a {@link LoadError}
   * containing all individual errors.
   *
   * @returns A promise that resolves to the validated `LoadResult`.
   * @throws {LoadError} If any validation step fails (schema, domain match, path match, cycle, type check).
   * @since 0.1.0
   * @public
   *
   * @example
   * ```ts
   * const { ruleStore, warnings } = await loader.load();
   * for (const warning of warnings) console.warn(warning);
   * const resolver = new Resolver({ ruleStore, functionRegistry, operatorRegistry });
   * ```
   */
  async load(): Promise<LoadResult> {
    throw new Error("Not implemented");
  }

  /**
   * Starts watching the rules directory for changes and re-runs the load
   * pipeline on each change.
   *
   * **Dev-mode only**: calling `watch()` in production (`env === "production"`)
   * returns a no-op `StopWatching` function and logs a warning.
   *
   * On a successful reload, `onSuccess` is called with the new store.
   * On a failed reload, `onError` is called and the previous store is preserved.
   * The watch glob patterns are loaded from `defaults/watch-patterns.json`
   * unless overridden via `LoaderOptions.watchPatterns`.
   *
   * @param onSuccess - Called with the new load result when a reload succeeds.
   * @param onError - Called with the load error when a reload fails.
   * @returns A function that stops the watcher; call during shutdown.
   * @since 0.1.0
   * @public
   *
   * @example
   * ```ts
   * const stop = loader.watch(
   *   ({ ruleStore }) => resolver.swapRuleStore(ruleStore),
   *   (err) => process.stderr.write(err.message + "\n"),
   * );
   * ```
   *
   * @see {@link StopWatching}
   * @see {@link HotReloadSuccessHandler}
   * @see {@link HotReloadErrorHandler}
   */
  watch(
    onSuccess: HotReloadSuccessHandler,
    onError: HotReloadErrorHandler
  ): StopWatching {
    throw new Error("Not implemented");
  }

  /**
   * Validates a single parsed `DomainFile` object without touching the
   * filesystem. Useful for testing and for validating in-memory modifications.
   *
   * @param file - The domain file object to validate.
   * @returns An array of `HyperFluxError` instances; empty if valid.
   * @since 0.1.0
   * @public
   *
   * @example
   * ```ts
   * const errors = loader.validateFile(parsedJson);
   * if (errors.length > 0) errors.forEach(e => console.error(e.message));
   * ```
   */
  validateFile(file: DomainFile): HyperFluxError[] {
    throw new Error("Not implemented");
  }
}
