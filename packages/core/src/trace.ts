/**
 * @file Trace tree types and formatting utilities.
 * @module @hyperflux/core/trace
 * @since 0.1.0
 */

// ---------------------------------------------------------------------------
// TraceNode
// ---------------------------------------------------------------------------

/**
 * A single node in a rule evaluation trace tree.
 * @since 0.1.0
 * @public
 */
export interface TraceNode {
  path: string;
  inputs: Record<string, unknown>;
  output: unknown;
  caseIndex: number;
  timeMs: number;
  cached: boolean;
  children: TraceNode[];
}

// ---------------------------------------------------------------------------
// TraceTree
// ---------------------------------------------------------------------------

/**
 * The complete trace produced by a single call to `Resolver.evaluate`.
 * @since 0.1.0
 * @public
 */
export interface TraceTree {
  root: TraceNode;
  totalTimeMs: number;
  evaluationCount: number;
  cacheHitCount: number;
}

// ---------------------------------------------------------------------------
// Formatting options
// ---------------------------------------------------------------------------

/**
 * Options for {@link formatTrace}.
 * @since 0.1.0
 * @public
 */
export interface TraceFormatOptions {
  depth?: number;
  grep?: string | RegExp;
  slowThresholdMs?: number;
  verbose?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countNodes(node: TraceNode): number {
  return 1 + node.children.reduce((s, c) => s + countNodes(c), 0);
}

function countCacheHits(node: TraceNode): number {
  return (
    (node.cached ? 1 : 0) +
    node.children.reduce((s, c) => s + countCacheHits(c), 0)
  );
}

function sumTime(node: TraceNode): number {
  return (
    node.timeMs + node.children.reduce((s, c) => s + sumTime(c), 0)
  );
}

function nodeMatchesGrep(
  node: TraceNode,
  pattern: string | RegExp
): boolean {
  const re = typeof pattern === "string" ? new RegExp(pattern) : pattern;
  return re.test(node.path);
}

function hasMatchingDescendant(
  node: TraceNode,
  pattern: string | RegExp
): boolean {
  if (nodeMatchesGrep(node, pattern)) return true;
  return node.children.some((c) => hasMatchingDescendant(c, pattern));
}

function formatNode(
  node: TraceNode,
  options: TraceFormatOptions,
  indent: number,
  currentDepth: number
): string {
  const { depth, grep, slowThresholdMs, verbose } = options;

  if (depth !== undefined && currentDepth > depth) return "";
  if (grep && !hasMatchingDescendant(node, grep)) return "";

  const prefix = "  ".repeat(indent);
  const slow =
    slowThresholdMs !== undefined && node.timeMs > slowThresholdMs
      ? " ⚠ SLOW"
      : "";
  const cached = node.cached ? " [cached]" : "";
  const time = `${node.timeMs.toFixed(2)}ms`;

  let line = `${prefix}${node.path} (${time})${cached}${slow}\n`;

  if (verbose) {
    line += `${prefix}  inputs:  ${JSON.stringify(node.inputs)}\n`;
    line += `${prefix}  output:  ${JSON.stringify(node.output)}\n`;
    line += `${prefix}  case:    ${node.caseIndex}\n`;
  }

  for (const child of node.children) {
    line += formatNode(child, options, indent + 1, currentDepth + 1);
  }

  return line;
}

function filterNode(
  node: TraceNode,
  predicate: (n: TraceNode) => boolean
): TraceNode | null {
  const filteredChildren: TraceNode[] = [];
  for (const child of node.children) {
    const fc = filterNode(child, predicate);
    if (fc) filteredChildren.push(fc);
  }
  if (!predicate(node) && filteredChildren.length === 0) return null;
  return { ...node, children: filteredChildren };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Renders a {@link TraceTree} as a human-readable tree string.
 * @since 0.1.0
 * @public
 */
export function formatTrace(
  tree: TraceTree,
  options: TraceFormatOptions = {}
): string {
  const header =
    `HyperFlux Trace\n` +
    `  evaluations: ${tree.evaluationCount}  cache hits: ${tree.cacheHitCount}  total: ${tree.totalTimeMs.toFixed(2)}ms\n\n`;
  return header + formatNode(tree.root, options, 0, 0);
}

/**
 * Returns a filtered trace tree containing only nodes that satisfy `predicate`.
 * @since 0.1.0
 * @public
 */
export function filterTrace(
  tree: TraceTree,
  predicate: (node: TraceNode) => boolean
): TraceTree | null {
  const root = filterNode(tree.root, predicate);
  if (!root) return null;
  return {
    root,
    totalTimeMs: sumTime(root),
    evaluationCount: countNodes(root),
    cacheHitCount: countCacheHits(root),
  };
}

/**
 * Serializes a `TraceTree` to JSON.
 * @since 0.1.0
 * @public
 */
export function traceToJSON(tree: TraceTree): string {
  return JSON.stringify(tree);
}

/**
 * Deserializes a `TraceTree` from JSON produced by {@link traceToJSON}.
 * @since 0.1.0
 * @public
 */
export function traceFromJSON(json: string): TraceTree {
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("root" in parsed) ||
    !("totalTimeMs" in parsed)
  ) {
    throw new Error("Invalid trace JSON");
  }
  return parsed as TraceTree;
}
