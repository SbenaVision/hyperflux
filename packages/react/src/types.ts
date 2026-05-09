/**
 * @file Shared TypeScript types for the HyperFlux React adapter.
 *
 * These types are consumed by `useRule`, `useRuleStream`, and the
 * `HyperFluxProvider` component. They are separate from the context module
 * to avoid circular imports.
 *
 * @module @hyperflux/react/types
 * @since 0.1.0
 */

import type { Resolver } from "@hyperflux/core/client";

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

/**
 * The value stored in the React context provided by `HyperFluxProvider`.
 *
 * Hooks (`useRule`, `useRuleStream`) read this value to access the
 * shared `Resolver` instance. Applications should not access this context
 * directly; use the hooks instead.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link HyperFluxProvider}
 * @see {@link useRule}
 * @see {@link useRuleStream}
 */
export interface HyperFluxContextValue {
  /**
   * The HyperFlux resolver instance shared across all hooks in this subtree.
   * Swapping this reference (e.g., after a hot reload) causes all hooks to
   * re-evaluate on their next render.
   */
  resolver: Resolver;

  /**
   * Pre-evaluated rule values keyed by buildCacheKey(path, inputs).
   * When present, useRule and useRules return these values on first access
   * without calling resolver.evaluate — enables zero-waterfall SSR hydration.
   */
  initialValues?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Hook result types
// ---------------------------------------------------------------------------

/**
 * Result object returned by {@link useRuleStream}.
 *
 * Mirrors a promise state: initial render has `loading: true` and `value:
 * undefined`; once the registered function resolves, `loading` becomes
 * `false` and `value` is populated. If evaluation throws, `error` is set.
 *
 * In v0.1 the minimal synchronous version returns `loading: false` immediately
 * since all registered functions are synchronous. True async streaming is
 * deferred to v0.2.
 *
 * @typeParam T - The expected output type of the evaluated rule.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```tsx
 * const { value, loading, error } = useRuleStream<string>("ui.welcome_message", { userId });
 * if (loading) return <Spinner />;
 * if (error) return <ErrorBanner message={error.message} />;
 * return <h1>{value}</h1>;
 * ```
 *
 * @see {@link useRuleStream}
 */
export interface RuleStreamResult<T> {
  /**
   * The evaluated rule output, or `undefined` while loading or on error.
   */
  value: T | undefined;

  /**
   * `true` while evaluation is in progress.
   * In v0.1 this is always `false` after the first synchronous render.
   */
  loading: boolean;

  /**
   * Set if evaluation threw an error; `undefined` otherwise.
   * Inspect `error.cause` for the underlying `HyperFluxError`.
   */
  error: Error | undefined;
}
