/**
 * @file Trace tree types and formatting utilities.
 *
 * When `RequestContext` is constructed with `{ recordTrace: true }`, the
 * resolver records every rule evaluation as a {@link TraceNode}. The
 * resulting {@link TraceTree} can be formatted for CLI display or serialized
 * to JSON for later inspection.
 *
 * @module @hyperflux/core/trace
 * @since 0.1.0
 */

// ---------------------------------------------------------------------------
// TraceNode
// ---------------------------------------------------------------------------

/**
 * A single node in a rule evaluation trace tree.
 *
 * Produced by the resolver for every rule evaluation when tracing is enabled.
 * Nodes are nested: a rule that calls other rules (via `rule` expressions)
 * has those evaluations as `children`.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const node: TraceNode = {
 *   path: "pricing.atm.fee",
 *   inputs: { amount: 500 },
 *   output: 2.5,
 *   caseIndex: 1,
 *   timeMs: 0.34,
 *   cached: false,
 *   children: [],
 * };
 * ```
 */
export interface TraceNode {
  /** Fully-qualified rule path that was evaluated. */
  path: string;
  /** Inputs record that was passed to this evaluation. */
  inputs: Record<string, unknown>;
  /** The value produced by the matched case's `then` expression. */
  output: unknown;
  /** Zero-based index of the case that matched. */
  caseIndex: number;
  /** Wall-clock milliseconds for this evaluation (excludes children). */
  timeMs: number;
  /** `true` if this result was served from the request cache. */
  cached: boolean;
  /** Nested evaluations triggered by `rule` expressions within this rule's cases. */
  children: TraceNode[];
}

// ---------------------------------------------------------------------------
// TraceTree
// ---------------------------------------------------------------------------

/**
 * The complete trace produced by a single call to `Resolver.evaluate`.
 *
 * Contains the root `TraceNode` (the top-level rule that was evaluated) and
 * aggregate statistics across the entire evaluation tree.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link RequestContext}
 * @see {@link formatTrace}
 */
export interface TraceTree {
  /** The root evaluation node. All other nodes are its direct or transitive children. */
  root: TraceNode;
  /** Sum of all `timeMs` values in the tree (inclusive of children, de-duplicated). */
  totalTimeMs: number;
  /** Total number of rule evaluations recorded (cached + uncached). */
  evaluationCount: number;
  /** Number of evaluations that were served from the per-request cache. */
  cacheHitCount: number;
}

// ---------------------------------------------------------------------------
// Formatting options
// ---------------------------------------------------------------------------

/**
 * Options for {@link formatTrace}.
 *
 * All fields are optional; defaults are loaded from `defaults/cli-commands.json`
 * (the `trace` command's default option values).
 *
 * @since 0.1.0
 * @public
 */
export interface TraceFormatOptions {
  /**
   * Maximum tree depth to render. Deeper nodes are collapsed with a count.
   * `undefined` renders the full tree.
   * @defaultValue `undefined` (full tree)
   */
  depth?: number;

  /**
   * Only include nodes whose `path` matches this pattern.
   * Applied recursively; a non-matching parent is still shown if a child matches.
   */
  grep?: string | RegExp;

  /**
   * Highlight nodes whose `timeMs` exceeds this threshold.
   * `undefined` disables slow-highlighting.
   */
  slowThresholdMs?: number;

  /**
   * When `true`, include the full `inputs` and `output` values for each node
   * in addition to the path and timing summary.
   * @defaultValue `false`
   */
  verbose?: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Renders a {@link TraceTree} as a human-readable tree string suitable for
 * terminal output.
 *
 * The format mirrors the `hf-trace` CLI output. Each node is indented by
 * depth, annotated with timing, and optionally with inputs/outputs when
 * `verbose` is true.
 *
 * @param tree - The trace tree to format.
 * @param options - Optional rendering options.
 * @returns A multi-line string ready to print to stdout.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const ctx = new RequestContext({ recordTrace: true });
 * resolver.evaluate("pricing.total", { amount: 200 }, ctx);
 * const tree = ctx.getTrace()!;
 * console.log(formatTrace(tree, { verbose: true, slowThresholdMs: 1 }));
 * ```
 *
 * @see {@link TraceTree}
 * @see {@link TraceFormatOptions}
 */
export function formatTrace(
  tree: TraceTree,
  options?: TraceFormatOptions
): string {
  throw new Error("Not implemented");
}

/**
 * Returns a new `TraceTree` containing only nodes that satisfy `predicate`,
 * preserving tree structure. Returns `null` if the root node itself does not
 * satisfy the predicate and has no matching descendants.
 *
 * @param tree - The source trace tree.
 * @param predicate - Function called for each node; return `true` to include it.
 * @returns A filtered trace tree, or `null` if no nodes matched.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const slowNodes = filterTrace(tree, node => node.timeMs > 2);
 * ```
 */
export function filterTrace(
  tree: TraceTree,
  predicate: (node: TraceNode) => boolean
): TraceTree | null {
  throw new Error("Not implemented");
}

/**
 * Serializes a `TraceTree` to a JSON string that can be saved to disk and
 * later restored with {@link traceFromJSON}.
 *
 * The format is a single JSON object; the exact schema is internal and may
 * change between patch versions.
 *
 * @param tree - The trace tree to serialize.
 * @returns A JSON string representation of the tree.
 * @since 0.1.0
 * @public
 *
 * @see {@link traceFromJSON}
 */
export function traceToJSON(tree: TraceTree): string {
  throw new Error("Not implemented");
}

/**
 * Deserializes a `TraceTree` that was previously produced by {@link traceToJSON}.
 *
 * @param json - A JSON string previously produced by `traceToJSON`.
 * @returns The deserialized trace tree.
 * @throws {SyntaxError} If `json` is not valid JSON.
 * @throws {Error} If `json` does not conform to the expected trace schema.
 * @since 0.1.0
 * @public
 *
 * @see {@link traceToJSON}
 */
export function traceFromJSON(json: string): TraceTree {
  throw new Error("Not implemented");
}
