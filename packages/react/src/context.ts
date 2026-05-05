/**
 * @file React context and provider for the HyperFlux resolver.
 * @module @hyperflux/react/context
 * @since 0.1.0
 */

import {
  createContext,
  useContext,
  createElement,
  type ReactNode,
  type Context,
} from "react";
import type { Resolver } from "@hyperflux/core";
import type { HyperFluxContextValue } from "./types";

/**
 * The React context object that holds the shared {@link HyperFluxContextValue}.
 * @since 0.1.0
 * @public
 */
export const HyperFluxContext: Context<HyperFluxContextValue | null> =
  createContext<HyperFluxContextValue | null>(null);

/**
 * Internal hook — throws a descriptive error when used outside a provider.
 * @since 0.1.0
 * @internal
 */
export function useHyperFluxContext(): HyperFluxContextValue {
  const ctx = useContext(HyperFluxContext);
  if (!ctx) {
    throw new Error(
      "useRule / useRuleStream must be used inside a <HyperFluxProvider>. " +
        "Wrap your app (or the relevant subtree) with <HyperFluxProvider resolver={resolver}>."
    );
  }
  return ctx;
}

/**
 * Props for {@link HyperFluxProvider}.
 * @since 0.1.0
 * @public
 */
export interface HyperFluxProviderProps {
  resolver: Resolver;
  children: ReactNode;
}

/**
 * React context provider that makes a `Resolver` available to all descendant hooks.
 * @since 0.1.0
 * @public
 */
export function HyperFluxProvider(props: HyperFluxProviderProps): ReactNode {
  const value: HyperFluxContextValue = { resolver: props.resolver };
  return createElement(HyperFluxContext.Provider, { value }, props.children);
}
