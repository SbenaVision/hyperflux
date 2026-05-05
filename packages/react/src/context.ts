/**
 * @file React context and provider for the HyperFlux resolver.
 *
 * Wrap your application (or the subtree that uses HyperFlux rules) with
 * `HyperFluxProvider`, passing the `Resolver` instance. All `useRule` and
 * `useRuleStream` calls within that subtree will share this resolver.
 *
 * @module @hyperflux/react/context
 * @since 0.1.0
 */

import {
  createContext,
  useContext,
  type ReactNode,
  type Context,
} from "react";
import type { Resolver } from "@hyperflux/core";
import type { HyperFluxContextValue } from "./types";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * The React context object that holds the shared {@link HyperFluxContextValue}.
 *
 * Do not read this directly in application code. Use `useRule` or
 * `useRuleStream` instead. The default value is `null`; attempting to use
 * hooks outside a `HyperFluxProvider` will throw a helpful error.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link HyperFluxProvider}
 */
export const HyperFluxContext: Context<HyperFluxContextValue | null> =
  createContext<HyperFluxContextValue | null>(null);

// ---------------------------------------------------------------------------
// useHyperFluxContext (internal helper)
// ---------------------------------------------------------------------------

/**
 * Internal hook that reads the context value and throws a descriptive error
 * if the hook is used outside a `HyperFluxProvider`.
 *
 * @returns The current `HyperFluxContextValue`.
 * @throws {Error} If called outside a `HyperFluxProvider` subtree.
 * @since 0.1.0
 * @internal
 */
export function useHyperFluxContext(): HyperFluxContextValue {
  throw new Error("Not implemented");
}

// ---------------------------------------------------------------------------
// HyperFluxProvider props
// ---------------------------------------------------------------------------

/**
 * Props for {@link HyperFluxProvider}.
 *
 * @since 0.1.0
 * @public
 */
export interface HyperFluxProviderProps {
  /**
   * The `Resolver` instance to expose to all hooks in this subtree.
   * Typically constructed once at application startup and passed here.
   * On hot reload, swap the resolver's internal store via
   * `resolver.swapRuleStore(newStore)` rather than replacing the provider
   * to avoid React context re-renders.
   */
  resolver: Resolver;

  /** React children that can access the provided resolver via hooks. */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// HyperFluxProvider
// ---------------------------------------------------------------------------

/**
 * React context provider that makes a `Resolver` available to all descendant
 * `useRule` and `useRuleStream` hooks.
 *
 * Place this near the root of your React tree. A single provider per
 * application is sufficient and recommended.
 *
 * @param props - Provider props including the `resolver` and `children`.
 * @returns A React element wrapping `children` with the HyperFlux context.
 * @since 0.1.0
 * @public
 *
 * @example
 * ```tsx
 * import { HyperFluxProvider } from "@hyperflux/react";
 * import { resolver } from "./hyperflux.config";
 *
 * export function App() {
 *   return (
 *     <HyperFluxProvider resolver={resolver}>
 *       <Router />
 *     </HyperFluxProvider>
 *   );
 * }
 * ```
 *
 * @see {@link useRule}
 * @see {@link useRuleStream}
 */
export function HyperFluxProvider(props: HyperFluxProviderProps): ReactNode {
  throw new Error("Not implemented");
}
