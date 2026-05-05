/**
 * @file Public API surface for `@hyperflux/lint`.
 *
 * Re-exports all public symbols from the lint sub-modules. Import from
 * `@hyperflux/lint`; sub-module paths are not considered stable API.
 *
 * @module @hyperflux/lint
 * @since 0.1.0
 */

// Analyzer
export { Analyzer } from "./analyzer";
export type { AnalyzerOptions } from "./analyzer";

// Fix engine
export { FixEngine } from "./fix-engine";
export type { FixEngineOptions, FixPlan } from "./fix-engine";

// Shared types
export type {
  LintSeverity,
  LintScope,
  LintPattern,
  LintRuleDefinition,
  LintConfig,
  LintDiagnostic,
  LintFix,
  LintResult,
} from "./types";
