/**
 * @file `useRuleStream` — rule evaluation hook with loading and error states.
 *
 * In v0.1 all registered functions are synchronous, so `useRuleStream` behaves
 * identically to `useRule` but wraps the result in a `{ value, loading, error }`
 * envelope. True async streaming (for rules that call async functions) is
 * deferred to v0.2.
 *
 * @module @hyperflux/react/useRuleStream
 * @since 0.1.0
 */

import type { RuleStreamResult } from "./types";

/**
 * Evaluates a HyperFlux rule and returns a `{ value, loading, error }` result
 * object, providing a React-idiomatic way to handle rules that may eventually
 * involve async operations.
 *
 * In v0.1 this hook resolves synchronously (all registered functions are pure
 * and synchronous), so `loading` is always `false` after the initial render
 * and `error` is only set if evaluation throws. The envelope API ensures that
 * components written today will not need to be refactored when async function
 * support lands in v0.2.
 *
 * The hook reads the `Resolver` from the nearest `HyperFluxProvider`. Results
 * are memoized across renders; re-evaluation only occurs when `path` or
 * `inputs` changes.
 *
 * @typeParam T - The expected output type of the rule.
 * @param path - Fully-qualified rule path, e.g. `"pricing.atm.fee"`.
 * @param inputs - Plain JSON-serializable inputs record matching the rule's declared inputs.
 * @returns A `RuleStreamResult<T>` with `value`, `loading`, and `error` fields.
 * @throws {Error} If called outside a `HyperFluxProvider` subtree.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```tsx
 * import { useRuleStream } from "@hyperflux/react";
 *
 * function AtmFeeDisplay({ amount }: { amount: number }) {
 *   const { value: fee, loading, error } = useRuleStream<number>(
 *     "pricing.atm.fee",
 *     { amount }
 *   );
 *
 *   if (loading) return <span>Calculating…</span>;
 *   if (error) return <span>Error: {error.message}</span>;
 *   return <span>Fee: ${fee?.toFixed(2)}</span>;
 * }
 * ```
 *
 * @see {@link useRule} for a simpler synchronous variant.
 * @see {@link RuleStreamResult} for the return type shape.
 * @see {@link HyperFluxProvider} for context setup.
 */
export function useRuleStream<T = unknown>(
  path: string,
  inputs: Record<string, unknown>
): RuleStreamResult<T> {
  throw new Error("Not implemented");
}
