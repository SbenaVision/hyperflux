/**
 * @file Lint types: rule definitions, diagnostics, fixes, and configuration.
 *
 * The lint system has two inputs: a set of `LintRuleDefinition` objects loaded
 * from `defaults/lint-rules.json`, and a `LintConfig` drawn from the project's
 * `.hyperfluxrc.json`. Together they drive the `Analyzer` and `FixEngine`.
 *
 * @module @hyperflux/lint/types
 * @since 0.1.0
 */

// ---------------------------------------------------------------------------
// Severity and scope
// ---------------------------------------------------------------------------

/**
 * The severity level for a lint finding or rule override.
 *
 * - `"error"` — must be fixed before commit; `hf lint` exits non-zero.
 * - `"warn"` — informational; `hf lint` exits zero.
 * - `"off"` — the rule is disabled entirely.
 *
 * @since 0.1.0
 * @public
 */
export type LintSeverity = "error" | "warn" | "off";

/**
 * The domain of source files that a lint rule applies to.
 *
 * - `"src"` — TypeScript / TSX source files matched by `LintConfig.src_globs`.
 * - `"rules"` — HyperFlux rule JSON files matched by `LintConfig.rule_globs`.
 *
 * @since 0.1.0
 * @public
 */
export type LintScope = "src" | "rules";

// ---------------------------------------------------------------------------
// LintPattern
// ---------------------------------------------------------------------------

/**
 * An AST pattern descriptor used by `"src"`-scoped lint rules.
 *
 * Each pattern is a named match kind (e.g. `"string-literal-in-jsx-text"`)
 * with an optional exclusion list. The analyzer resolves `match` strings
 * against its internal pattern registry, which is populated from
 * `defaults/lint-rules.json`.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const pattern: LintPattern = {
 *   match: "string-literal-in-jsx-text",
 *   exclude: ["test", "story"],
 * };
 * ```
 */
export interface LintPattern {
  /**
   * Named match kind. Must correspond to a key recognized by the analyzer's
   * internal pattern registry (defined in `defaults/lint-rules.json`).
   */
  match: string;

  /**
   * Filename fragments that cause this pattern to be skipped when present in
   * the file path. Matched as substrings, case-insensitively.
   * E.g. `["test", "story"]` skips `*.test.tsx` and `*.stories.tsx` files.
   */
  exclude?: string[];
}

// ---------------------------------------------------------------------------
// LintRuleDefinition
// ---------------------------------------------------------------------------

/**
 * A single lint rule definition as it appears in `defaults/lint-rules.json`.
 *
 * Lint rule definitions are data — they describe what to look for, not how to
 * look. The `Analyzer` interprets them. Modifying
 * `defaults/lint-rules.json` changes which patterns are checked without
 * touching source code (REQ-401, REQ-703).
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const rule: LintRuleDefinition = {
 *   id: "no-magic-numbers",
 *   severity_default: "warn",
 *   scope: "src",
 *   description: "Numeric literals in conditional expressions should be config rules.",
 *   patterns: [{ match: "number-literal-in-binary-comparison", exclude: ["0", "1", "-1"] }],
 *   suggestion: "Move to a config rule: useRule('config.<domain>.<key>')",
 * };
 * ```
 */
export interface LintRuleDefinition {
  /**
   * Unique identifier for this rule.
   * Used in `.hyperfluxrc.json` overrides and in diagnostic output.
   */
  id: string;

  /** Severity applied when not overridden by project config. */
  severity_default: LintSeverity;

  /** Whether this rule analyses TypeScript source or rule JSON files. */
  scope: LintScope;

  /** Human-readable description shown in diagnostic output. */
  description: string;

  /**
   * AST patterns to match. Only present for `scope === "src"` rules.
   * `scope === "rules"` rules implement their logic purely in the analyzer.
   */
  patterns?: LintPattern[];

  /**
   * Suggested fix shown in diagnostic output.
   * May contain `<placeholder>` tokens for human replacement.
   */
  suggestion?: string;

  /**
   * When `true`, `FixEngine` can produce an unambiguous automated fix for
   * this rule's findings.
   * @defaultValue `false`
   */
  fixable?: boolean;
}

// ---------------------------------------------------------------------------
// LintConfig
// ---------------------------------------------------------------------------

/**
 * Project-level lint configuration, drawn from `.hyperfluxrc.json`'s `lint`
 * section. Missing fields fall back to the defaults in
 * `defaults/lint-rules.json`.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const config: LintConfig = {
 *   src_globs: ["src/**\/*.ts", "src/**\/*.tsx"],
 *   rule_globs: ["rules/**\/*.json"],
 *   ignore: ["src/legacy/**"],
 *   overrides: { "no-magic-numbers": "off" },
 * };
 * ```
 */
export interface LintConfig {
  /** Glob patterns selecting TypeScript source files to analyze. */
  src_globs: string[];

  /** Glob patterns selecting rule JSON files to analyze. */
  rule_globs: string[];

  /**
   * Glob patterns for files to exclude from analysis entirely.
   * Matched against absolute file paths.
   */
  ignore: string[];

  /**
   * Per-rule severity overrides keyed by rule `id`.
   * `"off"` disables the rule; `"warn"` / `"error"` override `severity_default`.
   */
  overrides: Record<string, LintSeverity | "off">;
}

// ---------------------------------------------------------------------------
// LintDiagnostic
// ---------------------------------------------------------------------------

/**
 * A single lint finding produced by the `Analyzer`.
 *
 * Diagnostics are the output of `Analyzer.analyze()` and the input to
 * `FixEngine.computeFixes()`. They are also rendered directly to stdout by
 * `hf lint`.
 *
 * @since 0.1.0
 * @public
 *
 * @example
 * ```ts
 * const diag: LintDiagnostic = {
 *   ruleId: "no-magic-numbers",
 *   severity: "warn",
 *   file: "src/components/UserList.tsx",
 *   line: 42,
 *   column: 16,
 *   message: "Numeric literal '5' in conditional. Move to config rule.",
 *   suggestion: "Try: useRule('config.users.high_value_threshold')",
 *   fixable: false,
 * };
 * ```
 */
export interface LintDiagnostic {
  /** The `id` of the `LintRuleDefinition` that produced this diagnostic. */
  ruleId: string;

  /** Effective severity after applying project-level overrides. */
  severity: LintSeverity;

  /** Absolute or CWD-relative path to the file containing the finding. */
  file: string;

  /** 1-based line number of the finding. */
  line: number;

  /** 1-based column number of the finding. */
  column: number;

  /** Human-readable description of the specific violation. */
  message: string;

  /** Optional suggested fix text to display alongside the diagnostic. */
  suggestion?: string;

  /**
   * `true` if `FixEngine` can produce an automated fix for this specific
   * diagnostic; `false` if the fix is ambiguous or not implemented.
   */
  fixable: boolean;
}

// ---------------------------------------------------------------------------
// LintFix
// ---------------------------------------------------------------------------

/**
 * An automated fix for a single `LintDiagnostic`.
 *
 * Produced by `FixEngine.computeFixes()` and applied by
 * `FixEngine.applyFixes()`. Each fix carries the original diagnostic and an
 * `apply` function that transforms the source text.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link FixEngine}
 */
export interface LintFix {
  /** The diagnostic this fix resolves. */
  diagnostic: LintDiagnostic;

  /**
   * Pure function that transforms the source text of `diagnostic.file`.
   *
   * @param source - Current full source text of the file.
   * @returns Updated source text with the fix applied.
   */
  apply: (source: string) => string;
}

// ---------------------------------------------------------------------------
// LintResult
// ---------------------------------------------------------------------------

/**
 * Aggregate result of a full `Analyzer.analyze()` run.
 *
 * Used by `hf lint` to determine exit code (non-zero when `errorCount > 0`)
 * and to drive the fix engine.
 *
 * @since 0.1.0
 * @public
 *
 * @see {@link Analyzer}
 */
export interface LintResult {
  /** All diagnostics produced across all analyzed files and rule files. */
  diagnostics: ReadonlyArray<LintDiagnostic>;

  /** Number of diagnostics with `severity === "error"`. */
  errorCount: number;

  /** Number of diagnostics with `severity === "warn"`. */
  warnCount: number;

  /** Number of diagnostics where `fixable === true`. */
  fixableCount: number;
}
