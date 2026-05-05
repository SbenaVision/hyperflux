/**
 * @file Rule store interface and dependency graph types.
 *
 * The `RuleStore` is the in-memory index of all loaded rules, built by
 * `RuleLoader.load()` and consumed by the `Resolver`. It is read-only from
 * the outside; only the loader produces instances.
 *
 * @module @hyperflux/core/rules
 * @since 0.1.0
 */

import type { Rule, DomainFile } from "./schema";

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

/**
 * Immutable representation of the dependency graph built from all loaded
 * rules' `metadata.requires` fields and the rule-reference paths found in
 * their expressions.
 *
 * The loader uses this to detect cycles (via topological sort) and to
 * compute load order. The `RuleStore` exposes a read-only view of it.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link RuleStore.getDependencies}
 * @see {@link RuleStore.getDependents}
 */
export interface DependencyGraph {
  /**
   * Returns the rule paths that `path` directly depends on (its outgoing edges).
   *
   * @param path - A fully-qualified rule path.
   * @returns Ordered array of dependency paths, or an empty array if none.
   * @since 0.1.0
   */
  getDependencies(path: string): ReadonlyArray<string>;

  /**
   * Returns the rule paths that directly depend on `path` (its incoming edges).
   *
   * @param path - A fully-qualified rule path.
   * @returns Ordered array of dependent paths, or an empty array if none.
   * @since 0.1.0
   */
  getDependents(path: string): ReadonlyArray<string>;

  /**
   * Returns an ordered topological sort of all rule paths.
   *
   * The sort is guaranteed acyclic; if a cycle exists the loader throws
   * a {@link RuleCycleError} before this graph is produced.
   *
   * @returns All rule paths in topological (dependency-first) order.
   * @since 0.1.0
   */
  topologicalOrder(): ReadonlyArray<string>;

  /**
   * Returns `true` if a directed path exists from `from` to `to` in the
   * dependency graph (i.e., `from` transitively depends on `to`).
   *
   * @param from - Starting rule path.
   * @param to - Target rule path.
   * @returns `true` if `from` transitively depends on `to`.
   * @since 0.1.0
   */
  hasTransitiveDependency(from: string, to: string): boolean;
}

// ---------------------------------------------------------------------------
// RuleStore
// ---------------------------------------------------------------------------

/**
 * Immutable, indexed view of all rules loaded from the `rules/` directory.
 *
 * Built by `RuleLoader.load()` and passed to the `Resolver` via
 * `ResolverOptions.ruleStore`. The store is replaced atomically on hot reload;
 * each `RuleStore` instance is effectively frozen after construction.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const { ruleStore } = await loader.load();
 * const rule = ruleStore.get("pricing.atm.fee");
 * console.log(rule?.kind); // "compute"
 * console.log(ruleStore.size); // number of loaded rules
 * ```
 *
 * @see {@link RuleLoader}
 * @see {@link Resolver}
 */
export interface RuleStore {
  /**
   * Looks up a rule by its fully-qualified path.
   *
   * @param path - Fully-qualified rule path, e.g. `"pricing.atm.fee"`.
   * @returns The rule, or `undefined` if no rule with that path was loaded.
   * @since 0.1.0
   */
  get(path: string): Rule | undefined;

  /**
   * Returns every rule in the store in the order they were loaded
   * (domain file order, then rule array order within each file).
   *
   * @returns An immutable snapshot of all loaded rules.
   * @since 0.1.0
   */
  getAll(): ReadonlyArray<Rule>;

  /**
   * Returns the direct dependency paths of the rule at `path`.
   * Equivalent to `dependencyGraph.getDependencies(path)`.
   *
   * @param path - Fully-qualified rule path.
   * @returns Array of dependency paths, or an empty array if none.
   * @since 0.1.0
   */
  getDependencies(path: string): ReadonlyArray<string>;

  /**
   * Returns the paths of rules that directly depend on the rule at `path`.
   * Equivalent to `dependencyGraph.getDependents(path)`.
   *
   * @param path - Fully-qualified rule path.
   * @returns Array of dependent paths, or an empty array if none.
   * @since 0.1.0
   */
  getDependents(path: string): ReadonlyArray<string>;

  /**
   * Returns all domain names present in this store.
   *
   * @returns Array of unique domain strings, e.g. `["pricing", "ui", "validation"]`.
   * @since 0.1.0
   */
  getDomains(): ReadonlyArray<string>;

  /**
   * Returns all rules that belong to a given domain.
   *
   * @param domain - The domain name, e.g. `"pricing"`.
   * @returns Ordered array of rules in that domain, or an empty array.
   * @since 0.1.0
   */
  getByDomain(domain: string): ReadonlyArray<Rule>;

  /**
   * The raw domain file records that were parsed to build this store.
   * Useful for lint analysis that needs file-level metadata.
   *
   * @since 0.1.0
   */
  readonly domainFiles: ReadonlyArray<DomainFile>;

  /**
   * The dependency graph built from this store's rules.
   *
   * @since 0.1.0
   */
  readonly dependencyGraph: DependencyGraph;

  /** Total number of rules in this store. */
  readonly size: number;
}
