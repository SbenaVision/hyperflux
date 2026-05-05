/**
 * @file Rule loader — scans, validates, indexes, and hot-reloads rule files.
 * @module @hyperflux/core/loader
 * @since 0.1.0
 */

import { readdir, readFile, watch as fsWatch } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import type { DomainFile, Rule, Expression } from "./schema";
import { DomainFile as DomainFileSchema } from "./schema";
import type { FunctionRegistry, OperatorRegistry } from "./expressions";
import type { RuleStore } from "./rules";
import { RuleStoreImpl, DependencyGraphImpl } from "./rules";
import {
  HyperFluxError,
  LoadError,
  DomainMismatchError,
  DuplicatePathError,
  RuleCycleError,
  ShallowTypeError,
} from "./errors";

// ---------------------------------------------------------------------------
// Options and result types
// ---------------------------------------------------------------------------

export interface LoaderOptions {
  rulesDir: string;
  functionRegistry: FunctionRegistry;
  operatorRegistry: OperatorRegistry;
  env?: "development" | "production";
  watchPatterns?: string[];
}

export interface LoadResult {
  ruleStore: RuleStore;
  domainFiles: ReadonlyArray<DomainFile>;
  warnings: ReadonlyArray<string>;
}

export type HotReloadSuccessHandler = (result: LoadResult) => void;
export type HotReloadErrorHandler = (error: LoadError) => void;
export type StopWatching = () => void;

// ---------------------------------------------------------------------------
// Helpers — dependency extraction
// ---------------------------------------------------------------------------

function collectRuleDepsFromExpression(expr: Expression, deps: Set<string>): void {
  switch (expr.kind) {
    case "rule":
      deps.add(expr.path);
      if (expr.args) {
        for (const arg of expr.args) collectRuleDepsFromExpression(arg, deps);
      }
      break;
    case "fn":
    case "op":
      for (const arg of expr.args) collectRuleDepsFromExpression(arg, deps);
      break;
    case "literal":
    case "input":
      break;
  }
}

function collectRuleDepsFromRule(rule: Rule): string[] {
  const deps = new Set<string>(rule.metadata.requires);
  for (const c of rule.cases) {
    if (c.when) collectRuleDepsFromExpression(c.when, deps);
    collectRuleDepsFromExpression(c.then, deps);
  }
  return Array.from(deps);
}

// ---------------------------------------------------------------------------
// Helpers — topological sort (Kahn's algorithm)
// ---------------------------------------------------------------------------

function topologicalSort(
  paths: string[],
  deps: Map<string, string[]>
): { order: string[]; cycle: string[] | null } {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>(); // path -> dependents (reverse)

  for (const p of paths) {
    if (!inDegree.has(p)) inDegree.set(p, 0);
    if (!graph.has(p)) graph.set(p, []);
  }

  for (const [path, dependencies] of deps) {
    for (const dep of dependencies) {
      if (!inDegree.has(dep)) inDegree.set(dep, 0);
      if (!graph.has(dep)) graph.set(dep, []);
      graph.get(dep)!.push(path);
      inDegree.set(path, (inDegree.get(path) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [p, deg] of inDegree) {
    if (deg === 0) queue.push(p);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const dependent of graph.get(node) ?? []) {
      const newDeg = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDeg);
      if (newDeg === 0) queue.push(dependent);
    }
  }

  if (order.length < inDegree.size) {
    // Cycle exists — find it via DFS
    const visited = new Set<string>();
    const inStack = new Set<string>();
    let cyclePath: string[] = [];

    function dfs(node: string): boolean {
      visited.add(node);
      inStack.add(node);
      for (const dep of deps.get(node) ?? []) {
        if (!visited.has(dep)) {
          if (dfs(dep)) return true;
        } else if (inStack.has(dep)) {
          cyclePath = [dep, node];
          return true;
        }
      }
      inStack.delete(node);
      return false;
    }

    for (const p of paths) {
      if (!visited.has(p)) dfs(p);
      if (cyclePath.length > 0) break;
    }

    return { order: [], cycle: cyclePath };
  }

  return { order, cycle: null };
}

// ---------------------------------------------------------------------------
// Helpers — shallow type checker
// ---------------------------------------------------------------------------

function shallowCheckExpression(
  expr: Expression,
  rule: Rule,
  operatorRegistry: OperatorRegistry,
  functionRegistry: FunctionRegistry,
  errors: HyperFluxError[]
): void {
  switch (expr.kind) {
    case "op": {
      if (!operatorRegistry.hasOperator(expr.op)) {
        errors.push(
          new ShallowTypeError({
            path: rule.path,
            violation: `Unknown operator '${expr.op}'`,
          })
        );
      } else {
        const def = operatorRegistry.getOperator(expr.op)!;
        const expectedArity = def.arity;
        if (expectedArity === 1 && expr.args.length !== 1) {
          errors.push(
            new ShallowTypeError({
              path: rule.path,
              violation: `Operator '${expr.op}' expects 1 argument, got ${expr.args.length}`,
            })
          );
        } else if (expectedArity === 2 && expr.args.length !== 2) {
          errors.push(
            new ShallowTypeError({
              path: rule.path,
              violation: `Operator '${expr.op}' expects 2 arguments, got ${expr.args.length}`,
            })
          );
        } else if (expectedArity === "n" && def.min !== undefined && expr.args.length < def.min) {
          errors.push(
            new ShallowTypeError({
              path: rule.path,
              violation: `Operator '${expr.op}' requires at least ${def.min} arguments, got ${expr.args.length}`,
            })
          );
        }
      }
      for (const arg of expr.args) {
        shallowCheckExpression(arg, rule, operatorRegistry, functionRegistry, errors);
      }
      break;
    }
    case "fn": {
      if (!functionRegistry.has(expr.name)) {
        errors.push(
          new ShallowTypeError({
            path: rule.path,
            violation: `Unknown function '${expr.name}'`,
          })
        );
      } else {
        const def = functionRegistry.get(expr.name)!;
        if (expr.args.length !== def.inputs.length) {
          errors.push(
            new ShallowTypeError({
              path: rule.path,
              violation: `Function '${expr.name}' expects ${def.inputs.length} arguments, got ${expr.args.length}`,
            })
          );
        }
      }
      for (const arg of expr.args) {
        shallowCheckExpression(arg, rule, operatorRegistry, functionRegistry, errors);
      }
      break;
    }
    case "rule":
      if (expr.args) {
        for (const arg of expr.args) {
          shallowCheckExpression(arg, rule, operatorRegistry, functionRegistry, errors);
        }
      }
      break;
    case "literal":
    case "input":
      break;
  }
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

async function runLoadPipeline(
  rulesDir: string,
  operatorRegistry: OperatorRegistry,
  functionRegistry: FunctionRegistry
): Promise<LoadResult> {
  const errors: HyperFluxError[] = [];
  const warnings: string[] = [];
  const domainFiles: DomainFile[] = [];
  const allRules: Rule[] = [];
  const pathToFile = new Map<string, string>();

  // 1. Scan directory
  let entries: string[];
  try {
    const dirents = await readdir(rulesDir, { withFileTypes: true });
    entries = dirents
      .filter((d) => d.isFile() && extname(d.name) === ".json")
      .map((d) => join(rulesDir, d.name));
  } catch {
    warnings.push(`Rules directory '${rulesDir}' not found or empty`);
    entries = [];
  }

  if (entries.length === 0) {
    warnings.push("No rule files found");
  }

  // 2–4. Parse, validate domain, validate paths
  for (const filePath of entries) {
    const filenameStem = basename(filePath, ".json");
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      errors.push(
        new ShallowTypeError({
          path: filenameStem,
          violation: `Failed to parse JSON in '${filePath}'`,
        })
      );
      continue;
    }

    const result = DomainFileSchema.safeParse(raw);
    if (!result.success) {
      errors.push(
        new ShallowTypeError({
          path: filenameStem,
          violation: `Schema validation failed in '${filePath}': ${result.error.issues.map((i) => i.message).join("; ")}`,
        })
      );
      continue;
    }

    const domainFile = result.data;

    // Step 3: domain === filename stem
    if (domainFile.domain !== filenameStem) {
      errors.push(
        new DomainMismatchError({
          declaredDomain: domainFile.domain,
          filenameDomain: filenameStem,
          filePath,
        })
      );
    }

    // Step 4: every rule path starts with domain.
    for (const rule of domainFile.rules) {
      if (!rule.path.startsWith(domainFile.domain + ".")) {
        errors.push(
          new DomainMismatchError({
            declaredDomain: rule.path.split(".")[0],
            filenameDomain: domainFile.domain,
            filePath,
          })
        );
      }
    }

    if (domainFile.rules.length === 0) {
      warnings.push(`Domain file '${filePath}' has no rules`);
    }

    domainFiles.push(domainFile);

    // Step 5: check for duplicate paths
    for (const rule of domainFile.rules) {
      if (pathToFile.has(rule.path)) {
        errors.push(
          new DuplicatePathError({
            path: rule.path,
            files: [pathToFile.get(rule.path)!, filePath],
          })
        );
      } else {
        pathToFile.set(rule.path, filePath);
        allRules.push(rule);
      }
    }
  }

  // Fail early on parse/schema errors before attempting graph operations
  if (errors.length > 0) {
    throw new LoadError({ errors });
  }

  // 5. Build dependency map
  const deps = new Map<string, string[]>();
  for (const rule of allRules) {
    deps.set(rule.path, collectRuleDepsFromRule(rule));
  }

  // 6. Topological sort — detect cycles
  const { order, cycle } = topologicalSort(allRules.map((r) => r.path), deps);
  if (cycle) {
    errors.push(new RuleCycleError({ cycle }));
    throw new LoadError({ errors });
  }

  // 7. Shallow type check
  for (const rule of allRules) {
    for (const c of rule.cases) {
      if (c.when) {
        shallowCheckExpression(c.when, rule, operatorRegistry, functionRegistry, errors);
      }
      shallowCheckExpression(c.then, rule, operatorRegistry, functionRegistry, errors);
    }
  }

  if (errors.length > 0) {
    throw new LoadError({ errors });
  }

  // 8. Build graph and store
  const graph = new DependencyGraphImpl(deps, order);
  const ruleStore = new RuleStoreImpl(allRules, domainFiles, graph);

  return { ruleStore, domainFiles, warnings };
}

// ---------------------------------------------------------------------------
// RuleLoader class
// ---------------------------------------------------------------------------

export class RuleLoader {
  private readonly _options: LoaderOptions;

  constructor(options: LoaderOptions) {
    this._options = options;
  }

  async load(): Promise<LoadResult> {
    return runLoadPipeline(
      this._options.rulesDir,
      this._options.operatorRegistry,
      this._options.functionRegistry
    );
  }

  watch(
    onSuccess: HotReloadSuccessHandler,
    onError: HotReloadErrorHandler
  ): StopWatching {
    if (this._options.env === "production") {
      console.warn("HyperFlux: watch() called in production mode — no-op");
      return () => {};
    }

    let aborted = false;
    const ac = new AbortController();

    const run = async () => {
      try {
        const watcher = fsWatch(this._options.rulesDir, {
          signal: ac.signal,
          recursive: false,
        });
        for await (const _event of watcher) {
          if (aborted) break;
          // Debounce rapid saves
          await new Promise((r) => setTimeout(r, 50));
          try {
            const result = await this.load();
            onSuccess(result);
          } catch (err) {
            if (err instanceof LoadError) {
              onError(err);
            }
          }
        }
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.name === "AbortError" || (err as NodeJS.ErrnoException).code === "ERR_ABORTED")
        ) {
          return;
        }
        if (!aborted) throw err;
      }
    };

    run().catch(() => {});

    return () => {
      aborted = true;
      ac.abort();
    };
  }

  validateFile(file: DomainFile): HyperFluxError[] {
    const errors: HyperFluxError[] = [];
    const filenameStem = file.domain;

    for (const rule of file.rules) {
      if (!rule.path.startsWith(filenameStem + ".")) {
        errors.push(
          new DomainMismatchError({
            declaredDomain: rule.path.split(".")[0],
            filenameDomain: filenameStem,
            filePath: `<memory:${filenameStem}.json>`,
          })
        );
      }
    }

    return errors;
  }
}
