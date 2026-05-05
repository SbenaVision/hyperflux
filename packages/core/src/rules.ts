/**
 * @file Rule store interface, dependency graph, and concrete implementations.
 * @module @hyperflux/core/rules
 * @since 0.1.0
 */

import type { Rule, DomainFile } from "./schema";

// ---------------------------------------------------------------------------
// DependencyGraph interface
// ---------------------------------------------------------------------------

/**
 * Immutable representation of the dependency graph built from all loaded rules.
 * @since 0.1.0
 * @public
 */
export interface DependencyGraph {
  getDependencies(path: string): ReadonlyArray<string>;
  getDependents(path: string): ReadonlyArray<string>;
  topologicalOrder(): ReadonlyArray<string>;
  hasTransitiveDependency(from: string, to: string): boolean;
}

// ---------------------------------------------------------------------------
// DependencyGraph implementation
// ---------------------------------------------------------------------------

/**
 * @internal
 */
export class DependencyGraphImpl implements DependencyGraph {
  private readonly _deps = new Map<string, string[]>();    // path → what it depends on
  private readonly _rdeps = new Map<string, string[]>();   // path → what depends on it
  private readonly _order: string[];

  constructor(deps: Map<string, string[]>, order: string[]) {
    this._order = order;
    for (const [path, dependencies] of deps) {
      this._deps.set(path, dependencies);
      for (const dep of dependencies) {
        if (!this._rdeps.has(dep)) this._rdeps.set(dep, []);
        this._rdeps.get(dep)!.push(path);
      }
    }
  }

  getDependencies(path: string): ReadonlyArray<string> {
    return this._deps.get(path) ?? [];
  }

  getDependents(path: string): ReadonlyArray<string> {
    return this._rdeps.get(path) ?? [];
  }

  topologicalOrder(): ReadonlyArray<string> {
    return this._order;
  }

  hasTransitiveDependency(from: string, to: string): boolean {
    const visited = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === to) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const dep of this.getDependencies(current)) {
        stack.push(dep);
      }
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// RuleStore interface
// ---------------------------------------------------------------------------

/**
 * Immutable, indexed view of all rules loaded from the `rules/` directory.
 * @since 0.1.0
 * @public
 */
export interface RuleStore {
  get(path: string): Rule | undefined;
  getAll(): ReadonlyArray<Rule>;
  getDependencies(path: string): ReadonlyArray<string>;
  getDependents(path: string): ReadonlyArray<string>;
  getDomains(): ReadonlyArray<string>;
  getByDomain(domain: string): ReadonlyArray<Rule>;
  readonly domainFiles: ReadonlyArray<DomainFile>;
  readonly dependencyGraph: DependencyGraph;
  readonly size: number;
}

// ---------------------------------------------------------------------------
// RuleStore implementation
// ---------------------------------------------------------------------------

/**
 * @internal
 */
export class RuleStoreImpl implements RuleStore {
  private readonly _index = new Map<string, Rule>();
  private readonly _all: Rule[];
  private readonly _byDomain = new Map<string, Rule[]>();

  constructor(
    rules: Rule[],
    readonly domainFiles: ReadonlyArray<DomainFile>,
    readonly dependencyGraph: DependencyGraph
  ) {
    this._all = rules;
    for (const rule of rules) {
      this._index.set(rule.path, rule);
      const domain = rule.path.split(".")[0];
      if (!this._byDomain.has(domain)) this._byDomain.set(domain, []);
      this._byDomain.get(domain)!.push(rule);
    }
  }

  get(path: string): Rule | undefined {
    return this._index.get(path);
  }

  getAll(): ReadonlyArray<Rule> {
    return this._all;
  }

  getDependencies(path: string): ReadonlyArray<string> {
    return this.dependencyGraph.getDependencies(path);
  }

  getDependents(path: string): ReadonlyArray<string> {
    return this.dependencyGraph.getDependents(path);
  }

  getDomains(): ReadonlyArray<string> {
    return Array.from(this._byDomain.keys());
  }

  getByDomain(domain: string): ReadonlyArray<Rule> {
    return this._byDomain.get(domain) ?? [];
  }

  get size(): number {
    return this._index.size;
  }
}
