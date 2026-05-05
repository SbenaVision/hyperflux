/**
 * @file `useRule` — synchronous rule evaluation hook.
 *
 * @module @hyperflux/react/useRule
 * @since 0.1.0
 */

import { useContext, useMemo } from "react";
import { RequestContext } from "@hyperflux/core";
import { HyperFluxContext } from "./context";

/**
 * Synchronously evaluates a HyperFlux rule and returns its output.
 *
 * The hook reads the `Resolver` from the nearest `HyperFluxProvider`, creates
 * a per-render `RequestContext` (providing request-scoped memoization), and
 * calls `resolver.evaluate(path, inputs)`. The result is memoized by React
 * across renders using `useMemo`; re-evaluation only occurs when `path` or
 * any value in `inputs` changes (by reference equality on the inputs object,
 * so pass a stable object or use `useMemo` on the caller side).
 *
 * @typeParam T - The expected output type of the rule. No additional runtime
 *   assertion is performed beyond the resolver's built-in output type check.
 * @param path - Fully-qualified rule path, e.g. `"ui.labels.submit_button"`.
 * @param inputs - Plain JSON-serializable inputs record matching the rule's declared inputs.
 * @returns The evaluated rule output cast to `T`.
 * @throws {RuleNotFoundError} If `path` does not exist in the loaded rule store (HF001).
 * @throws {InputTypeError} If an input value type mismatches the rule's declaration (HF002).
 * @throws {OutputTypeError} If the matched case output violates the rule's declared output type (HF003).
 * @throws {NoMatchingCaseError} If no case matches and there is no default case (HF004).
 * @throws {Error} If called outside a `HyperFluxProvider` subtree.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```tsx
 * import { useRule } from "@hyperflux/react";
 *
 * function SubmitButton() {
 *   const label = useRule<string>("ui.labels.submit_button", {});
 *   return <button type="submit">{label}</button>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * function UserBadge({ userId, revenue }: { userId: string; revenue: number }) {
 *   const isHighValue = useRule<boolean>("users.is_high_value", { revenue });
 *   return isHighValue ? <Badge label="High Value" /> : null;
 * }
 * ```
 *
 * @see {@link useRuleStream} for an async variant with loading/error states.
 * @see {@link HyperFluxProvider} for context setup.
 */
export function useRule<T = unknown>(
  path: string,
  inputs: Record<string, unknown>
): T {
  throw new Error("Not implemented");
}
