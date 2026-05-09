/**
 * @file Public API surface for `@hyperflux/core`.
 *
 * Re-exports all public symbols from the core sub-modules. Import from
 * `@hyperflux/core` rather than from sub-module paths; only this barrel
 * is considered stable API.
 *
 * @module @hyperflux/core
 * @since 0.1.0
 */

// Schema and data model — value exports (Zod schemas and runtime values)
export {
  TypeSpec,
  Expression,
  Case,
  RuleInput,
  RuleMetadata,
  Rule,
  DomainFile,
} from "./schema";

// Schema and data model — type-only exports (interfaces with no runtime value)
export type {
  LiteralExpression,
  InputExpression,
  RuleExpression,
  FnExpression,
  OpExpression,
  ConstructExpression,
  MergeExpression,
  MapExpression,
} from "./schema";

// Operator and function registries
export {
  FunctionRegistry,
  OperatorRegistryImpl,
  canonicalJSON,
  buildCacheKey,
} from "./expressions";

export type {
  OperatorArity,
  OperatorDefinition,
  OperatorRegistry,
  FunctionInputDeclaration,
  FunctionDefinition,
} from "./expressions";

// Rule store
export type { DependencyGraph, RuleStore } from "./rules";
export { RuleStoreImpl, DependencyGraphImpl } from "./rules";

// Resolver
export { Resolver, RequestContext } from "./resolver";
export type { ResolverOptions, RequestContextOptions } from "./resolver";

// Loader
export { RuleLoader } from "./loader";
export type {
  LoaderOptions,
  LoadResult,
  HotReloadSuccessHandler,
  HotReloadErrorHandler,
  StopWatching,
} from "./loader";

// Trace
export { formatTrace, filterTrace, traceToJSON, traceFromJSON } from "./trace";
export type { TraceNode, TraceTree, TraceFormatOptions } from "./trace";

// Lifecycle engine (server-side only — no node: deps, safe in barrel)
export {
  LifecycleEngine,
  LifecycleBlockedError,
  UnknownLifecycleAddressError,
  ProtectedLifecycleStageError,
} from "./lifecycle";
export type {
  LifecycleStageConfig,
  LifecycleAddressConfig,
  LifecycleManifest,
  AuditEntry,
  ExplainResult,
} from "./lifecycle";

// SSR prefetch utility
export { prefetchRules } from "./prefetch";
export type { RuleSpec, PrefetchedRules } from "./prefetch";

// Errors
export {
  HyperFluxErrorCode,
  HyperFluxError,
  RuleNotFoundError,
  InputTypeError,
  OutputTypeError,
  NoMatchingCaseError,
  FunctionNotRegisteredError,
  RuleCycleError,
  DomainMismatchError,
  DuplicatePathError,
  ShallowTypeError,
  LoadError,
} from "./errors";

export type {
  RuleNotFoundContext,
  InputTypeContext,
  OutputTypeContext,
  NoMatchingCaseContext,
  FunctionNotRegisteredContext,
  RuleCycleContext,
  DomainMismatchContext,
  DuplicatePathContext,
  ShallowTypeContext,
  LoadErrorContext,
} from "./errors";
