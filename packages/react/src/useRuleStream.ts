/**
 * @file `useRuleStream` — rule evaluation hook with loading and error states.
 * @module @hyperflux/react/useRuleStream
 * @since 0.1.0
 */

import { useRef } from "react";
import { RequestContext, buildCacheKey } from "@hyperflux/core/client";
import type { Resolver } from "@hyperflux/core/client";
import { useHyperFluxContext } from "./context";
import type { RuleStreamResult } from "./types";

/**
 * Evaluates a HyperFlux rule and returns a `{ value, loading, error }` envelope.
 *
 * In v0.1 all registered functions are synchronous, so `loading` is always
 * `false` and the value is available immediately. The envelope API ensures
 * components need no refactoring when async function support lands in v0.2.
 *
 * @since 0.1.0
 * @public
 */
export function useRuleStream<T = unknown>(
  path: string,
  inputs: Record<string, unknown>
): RuleStreamResult<T> {
  const { resolver } = useHyperFluxContext();

  const resolverRef = useRef<Resolver | undefined>(undefined);
  const cacheKeyRef = useRef<string | undefined>(undefined);
  const resultRef   = useRef<RuleStreamResult<T>>({
    value: undefined,
    loading: false,
    error: undefined,
  });

  const currentKey = buildCacheKey(path, inputs);

  if (currentKey !== cacheKeyRef.current || resolver !== resolverRef.current) {
    try {
      const ctx = new RequestContext();
      const value = resolver.evaluate<T>(path, inputs, ctx);
      resultRef.current = { value, loading: false, error: undefined };
    } catch (err) {
      resultRef.current = {
        value: undefined,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
    cacheKeyRef.current  = currentKey;
    resolverRef.current  = resolver;
  }

  return resultRef.current;
}
