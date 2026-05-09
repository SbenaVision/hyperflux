/**
 * @file prefetchRules — server-side batch rule evaluation for SSR hydration.
 * @module @hyperflux/core/prefetch
 * @since 0.2.0
 */

import type { Resolver } from "./resolver";
import { RequestContext } from "./resolver";
import { buildCacheKey } from "./expressions";

export interface RuleSpec {
  path: string;
  inputs: Record<string, unknown>;
}

/** Keyed by buildCacheKey(path, inputs) → evaluated output. */
export type PrefetchedRules = Record<string, unknown>;

/**
 * Evaluates a batch of rules server-side and returns a serializable map
 * keyed by cache key. Pass the result to HyperFluxProvider as `initialValues`
 * to hydrate the client without a round-trip.
 *
 * Rules that throw (e.g. RuleNotFoundError) are silently skipped so a
 * partial prefetch never breaks a page render.
 */
export function prefetchRules(
  resolver: Resolver,
  specs: RuleSpec[]
): PrefetchedRules {
  const ctx = new RequestContext();
  const out: PrefetchedRules = {};
  for (const { path, inputs } of specs) {
    try {
      out[buildCacheKey(path, inputs)] = resolver.evaluate(path, inputs, ctx);
    } catch {
      // skip — rule missing or erroring
    }
  }
  return out;
}
