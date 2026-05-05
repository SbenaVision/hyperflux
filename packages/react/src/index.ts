/**
 * @file Public API surface for `@hyperflux/react`.
 *
 * Re-exports all public symbols from the React adapter sub-modules. Import
 * from `@hyperflux/react`; sub-module paths are not considered stable API.
 *
 * @module @hyperflux/react
 * @since 0.1.0
 */

// Hooks
export { useRule } from "./useRule";
export { useRuleStream } from "./useRuleStream";

// Provider and context
export { HyperFluxProvider, HyperFluxContext } from "./context";
export type { HyperFluxProviderProps } from "./context";

// Shared types
export type { HyperFluxContextValue, RuleStreamResult } from "./types";
