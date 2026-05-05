/**
 * @file `useRule` — synchronous rule evaluation hook.
 * @module @hyperflux/react/useRule
 * @since 0.1.0
 */

import { useRef } from "react";
import { RequestContext, buildCacheKey } from "@hyperflux/core";
import { useHyperFluxContext } from "./context";

/**
 * Synchronously evaluates a HyperFlux rule and returns its output.
 *
 * Results are memoized by canonical cache key — re-evaluation only occurs
 * when `path` or the content of `inputs` changes (deep equality via
 * canonical JSON, not object reference).
 *
 * @since 0.1.0
 * @public
 */
export function useRule<T = unknown>(
  path: string,
  inputs: Record<string, unknown>
): T {
  const { resolver } = useHyperFluxContext();

  const cacheKeyRef = useRef<string | undefined>(undefined);
  const resultRef = useRef<T | undefined>(undefined);

  const currentKey = buildCacheKey(path, inputs);

  if (currentKey !== cacheKeyRef.current) {
    const ctx = new RequestContext();
    resultRef.current = resolver.evaluate<T>(path, inputs, ctx);
    cacheKeyRef.current = currentKey;
  }

  return resultRef.current as T;
}
