/**
 * Browser-safe subset of @hyperflux/core — excludes RuleLoader (node:fs).
 * Use this entry point in client components; use the main barrel in server/Node.js code.
 */

export {
  TypeSpec,
  Expression,
  Case,
  RuleInput,
  RuleMetadata,
  Rule,
  DomainFile,
} from "./schema";

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

export type { DependencyGraph, RuleStore } from "./rules";
export { RuleStoreImpl, DependencyGraphImpl } from "./rules";

export { Resolver, RequestContext } from "./resolver";
export type { ResolverOptions, RequestContextOptions } from "./resolver";

// Lifecycle types only — LifecycleEngine (needs Resolver) stays in the main barrel
export type {
  LifecycleStageConfig,
  LifecycleAddressConfig,
  LifecycleManifest,
  AuditEntry,
  ExplainResult,
} from "./lifecycle";

export { formatTrace, filterTrace, traceToJSON, traceFromJSON } from "./trace";
export type { TraceNode, TraceTree, TraceFormatOptions } from "./trace";

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
