/**
 * @file `useContent` — locale-aware content rule hook.
 * @module @hyperflux/react/useContent
 * @since 0.2.0
 */

import { useContext } from "react";
import { useRule } from "./useRule";
import { ContentContext } from "./context";

/**
 * Evaluates a content rule, automatically injecting the current locale from
 * the nearest {@link ContentProvider}. Falls back to `"en"` when no provider
 * is present.
 *
 * Content rules may declare a `locale` input to return locale-specific values.
 * Rules with no inputs safely ignore the injected locale — the resolver only
 * validates declared inputs, so extra keys are silently discarded.
 *
 * @example
 * ```tsx
 * // Replace: const label = useRule<string>("hiflux.actions.edit_label", {});
 * const label = useContent("hiflux.actions.edit_label");
 * ```
 *
 * @since 0.2.0
 * @public
 */
export function useContent<T = string>(path: string): T {
  const ctx = useContext(ContentContext);
  const locale = ctx?.locale ?? "en";
  return useRule<T>(path, { locale });
}
