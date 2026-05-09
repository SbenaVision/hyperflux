/**
 * @file `useRules` — batch rule evaluation hook.
 * @module @hyperflux/react/useRules
 * @since 0.2.0
 */

import { useRef } from "react";
import { RequestContext, buildCacheKey } from "@hyperflux/core/client";
import type { Resolver } from "@hyperflux/core/client";
import { useHyperFluxContext } from "./context";

type RuleSpec = { path: string; inputs: Record<string, unknown> };

/**
 * Evaluates a named map of rules in a single shared RequestContext.
 * Results are memoized by the combined spec key — re-evaluation only occurs
 * when any path or inputs value changes.
 *
 * @example
 * ```tsx
 * const { editLabel, deleteLabel } = useRules({
 *   editLabel:   { path: "hiflux.actions.edit_label",   inputs: {} },
 *   deleteLabel: { path: "hiflux.actions.delete_label", inputs: {} },
 * });
 * ```
 *
 * @since 0.2.0
 * @public
 */
export function useRules<T extends Record<string, unknown>>(
  specs: { [K in keyof T]: RuleSpec }
): T {
  const { resolver, initialValues } = useHyperFluxContext();

  const specsKeyRef  = useRef<string | undefined>(undefined);
  const resolverRef  = useRef<Resolver | undefined>(undefined);
  const resultRef    = useRef<T | undefined>(undefined);

  const currentKey = buildCacheKey("__batch__", specs as Record<string, unknown>);

  if (currentKey !== specsKeyRef.current || resolver !== resolverRef.current) {
    const ctx = new RequestContext();
    const out = {} as T;
    for (const [name, spec] of Object.entries(specs) as [keyof T, RuleSpec][]) {
      const ck = buildCacheKey(spec.path, spec.inputs);
      if (initialValues && ck in initialValues) {
        out[name] = initialValues[ck] as T[keyof T];
      } else {
        out[name] = resolver.evaluate(spec.path, spec.inputs, ctx) as T[keyof T];
      }
    }
    resultRef.current  = out;
    specsKeyRef.current = currentKey;
    resolverRef.current = resolver;
  }

  return resultRef.current!;
}
