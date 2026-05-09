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
import type { Resolver } from "@hyperflux/core/client";
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
  /** Pre-evaluated rule values from prefetchRules(). Hydrates useRule on first render. */
  initialValues?: Record<string, unknown>;
  children: ReactNode;
}

/**
 * React context provider that makes a `Resolver` available to all descendant hooks.
 * @since 0.1.0
 * @public
 */
export function HyperFluxProvider(props: HyperFluxProviderProps): ReactNode {
  const value: HyperFluxContextValue = {
    resolver: props.resolver,
    initialValues: props.initialValues,
  };
  return createElement(HyperFluxContext.Provider, { value }, props.children);
}

// ---------------------------------------------------------------------------
// ContentContext — locale for useContent
// ---------------------------------------------------------------------------

export interface ContentContextValue {
  locale: string;
}

export const ContentContext: Context<ContentContextValue | null> =
  createContext<ContentContextValue | null>(null);

export interface ContentProviderProps {
  locale?: string;
  children: ReactNode;
}

/**
 * Provides locale context to {@link useContent}. Wrap your app (or any
 * subtree that renders content rules) with this provider.
 * Defaults to `"en"` when omitted.
 * @since 0.2.0
 * @public
 */
export function ContentProvider(props: ContentProviderProps): ReactNode {
  return createElement(
    ContentContext.Provider,
    { value: { locale: props.locale ?? "en" } },
    props.children
  );
}
