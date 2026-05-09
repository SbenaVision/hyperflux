// hf:allow-hardcoded reason="lint diagnostic truncation — internal report formatting, not user-configurable product behavior"
/**
 * @file Lint analyzer — AST traversal and rule application engine.
 * @module @hyperflux/lint/analyzer
 * @since 0.1.0
 */

import * as ts from "typescript";
import type { DomainFile } from "@hyperflux/core";
import type { RuleStore } from "@hyperflux/core";
import type {
  LintConfig,
  LintDiagnostic,
  LintResult,
  LintRuleDefinition,
  LintSeverity,
  SourceRef,
} from "./types";

// ---------------------------------------------------------------------------
// AnalyzerOptions
// ---------------------------------------------------------------------------

export interface AnalyzerOptions {
  lintRuleDefinitions: ReadonlyArray<LintRuleDefinition>;
  config: LintConfig;
  ruleStore: RuleStore;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Attributes that are never user-facing copy (skip for no-hardcoded-copy)
const SKIP_ATTRS = new Set([
  "classname", "class", "key", "href", "src", "alt", "id", "type", "role",
  "for", "htmlfor", "tabindex", "target", "rel", "style", "ref", "name",
  "value", "defaultvalue", "placeholder",
]);

function isSkipAttr(attrName: string): boolean {
  const lower = attrName.toLowerCase();
  return (
    SKIP_ATTRS.has(lower) ||
    lower.startsWith("aria-") ||
    lower.startsWith("data-") ||
    lower.startsWith("on")
  );
}

const COMPARISON_OPS = new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

const TRIVIAL_NUMBERS = new Set(["0", "1", "2", "-1", "100"]);

/** Hook names that constitute a source reference to a rule path. */
const RULE_HOOK_NAMES = new Set(["useRule", "useRuleStream"]);

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

export class Analyzer {
  private readonly _rules: ReadonlyArray<LintRuleDefinition>;
  private readonly _config: LintConfig;
  private readonly _ruleStore: RuleStore;

  /**
   * Source references collected during the most recent `analyze()` run.
   * Maps rule path → array of locations where useRule/useRuleStream call it.
   * Reset at the start of each `analyze()` call.
   */
  private _sourceRefs = new Map<string, SourceRef[]>();

  /** Count of source files scanned in the most recent `analyze()` call. */
  private _scannedSourceFileCount = 0;

  constructor(options: AnalyzerOptions) {
    this._rules = options.lintRuleDefinitions;
    this._config = options.config;
    this._ruleStore = options.ruleStore;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  effectiveSeverity(ruleId: string): LintSeverity | "off" {
    const override = this._config.overrides[ruleId];
    if (override !== undefined) return override as LintSeverity | "off";
    const def = this._rules.find((r) => r.id === ruleId);
    return def?.severity_default ?? "off";
  }

  parseSourceFile(filePath: string, source: string): ts.SourceFile {
    return ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  }

  /**
   * Returns all source references to a given rule path collected during the
   * last `analyze()` call. Used by the admin UI to display "used in source"
   * locations and by the orphan check.
   */
  sourceRefsFor(rulePath: string): ReadonlyArray<SourceRef> {
    return this._sourceRefs.get(rulePath) ?? [];
  }

  /**
   * Returns the full source-refs map from the last `analyze()` call.
   * Keys are rule paths; values are where that rule is called from source.
   */
  get allSourceRefs(): ReadonlyMap<string, ReadonlyArray<SourceRef>> {
    return this._sourceRefs;
  }

  async analyzeFile(filePath: string, source: string): Promise<LintDiagnostic[]> {
    const diags: LintDiagnostic[] = [];
    const sf = this.parseSourceFile(filePath, source);

    // Collect useRule / useRuleStream references — populates _sourceRefs
    this._collectSourceRefs(filePath, sf);

    // Apply src-scope lint rules
    for (const rule of this._rules) {
      if (rule.scope !== "src") continue;
      const severity = this.effectiveSeverity(rule.id);
      if (severity === "off") continue;
      if (!rule.patterns || rule.patterns.length === 0) continue;

      for (const pattern of rule.patterns) {
        const excluded = pattern.exclude?.some((ex) =>
          filePath.toLowerCase().includes(ex.toLowerCase())
        ) ?? false;
        if (excluded) continue;

        const nodes = this._findPatternMatches(pattern.match, sf);
        for (const node of nodes) {
          const pos = node.getStart(sf);
          const lc = sf.getLineAndCharacterOfPosition(pos);
          diags.push({
            ruleId: rule.id,
            severity: severity as LintSeverity,
            file: filePath,
            line: lc.line + 1,
            column: lc.character + 1,
            message: this._buildMessage(rule.id, node, sf),
            suggestion: rule.suggestion,
            fixable: rule.fixable ?? false,
          });
        }
      }
    }

    return diags;
  }

  analyzeRules(domainFiles: ReadonlyArray<DomainFile>): LintDiagnostic[] {
    const diags: LintDiagnostic[] = [];

    for (const rule of this._rules) {
      if (rule.scope !== "rules") continue;
      const severity = this.effectiveSeverity(rule.id);
      if (severity === "off") continue;

      diags.push(...this._checkRulesScope(rule.id, severity as LintSeverity, domainFiles));
    }

    return diags;
  }

  async analyze(
    sources: Record<string, string>,
    domainFiles: ReadonlyArray<DomainFile>
  ): Promise<LintResult> {
    // Reset source refs for this run
    this._sourceRefs.clear();
    this._scannedSourceFileCount = Object.keys(sources).length;

    // Analyze all source files — this also populates _sourceRefs via _collectSourceRefs
    const srcResults = await Promise.all(
      Object.entries(sources).map(([file, src]) => this.analyzeFile(file, src))
    );

    // Now _sourceRefs is fully populated; analyze rule files using it
    const ruleDiags = this.analyzeRules(domainFiles);
    const all: LintDiagnostic[] = [...srcResults.flat(), ...ruleDiags];

    return {
      diagnostics: all,
      errorCount: all.filter((d) => d.severity === "error").length,
      warnCount: all.filter((d) => d.severity === "warn").length,
      fixableCount: all.filter((d) => d.fixable).length,
      sourceRefs: new Map(this._sourceRefs),
    };
  }

  // ---------------------------------------------------------------------------
  // Source-ref collection
  // ---------------------------------------------------------------------------

  /**
   * Walks the AST of a source file and records every static `useRule()` /
   * `useRuleStream()` call whose first argument is a string literal.
   *
   * Dynamic paths (template literals, variables) are intentionally skipped —
   * they cannot be statically resolved without type inference.
   */
  private _collectSourceRefs(filePath: string, sf: ts.SourceFile): void {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;

        // Matches: useRule('path') and useRuleStream('path')
        // Also matches: hooks.useRule('path') via property access
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null;

        if (name && RULE_HOOK_NAMES.has(name) && node.arguments.length >= 1) {
          const firstArg = node.arguments[0];
          if (ts.isStringLiteral(firstArg)) {
            const rulePath = firstArg.text;
            const pos = node.getStart(sf);
            const lc = sf.getLineAndCharacterOfPosition(pos);

            if (!this._sourceRefs.has(rulePath)) {
              this._sourceRefs.set(rulePath, []);
            }
            this._sourceRefs.get(rulePath)!.push({
              file: filePath,
              line: lc.line + 1,
              column: lc.character + 1,
              hookName: name as "useRule" | "useRuleStream",
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sf, visit);
  }

  // ---------------------------------------------------------------------------
  // Pattern matching
  // ---------------------------------------------------------------------------

  private _findPatternMatches(matchKind: string, sf: ts.SourceFile): ts.Node[] {
    const results: ts.Node[] = [];

    const visit = (node: ts.Node): void => {
      switch (matchKind) {
        case "string-literal-in-jsx-text":
          if (ts.isJsxText(node) && !node.containsOnlyTriviaWhiteSpaces) {
            const trimmed = node.text.trim();
            if (trimmed.length > 0) results.push(node);
          }
          break;

        case "string-literal-in-jsx-attribute":
          if (ts.isJsxAttribute(node)) {
            const init = node.initializer;
            if (init && ts.isStringLiteral(init)) {
              const attrName = node.name.getText(sf);
              if (!isSkipAttr(attrName) && init.text.trim().length > 0) {
                results.push(init);
              }
            }
          }
          break;

        case "number-literal-in-binary-comparison":
          if (ts.isNumericLiteral(node) && !TRIVIAL_NUMBERS.has(node.text)) {
            const parent = node.parent;
            if (parent && ts.isBinaryExpression(parent)) {
              if (COMPARISON_OPS.has(parent.operatorToken.kind)) {
                results.push(node);
              }
            }
          }
          break;

        case "object-literal-as-jsx-prop":
          if (ts.isJsxAttribute(node)) {
            const init = node.initializer;
            if (
              init &&
              ts.isJsxExpression(init) &&
              init.expression &&
              ts.isObjectLiteralExpression(init.expression)
            ) {
              results.push(init.expression);
            }
          }
          break;
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sf, visit);
    return results;
  }

  // ---------------------------------------------------------------------------
  // Rules-scope checks
  // ---------------------------------------------------------------------------

  private _buildMessage(ruleId: string, node: ts.Node, sf: ts.SourceFile): string {
    if (ruleId === "no-hardcoded-copy") {
      if (ts.isJsxText(node)) {
        const t = node.text.trim().slice(0, 50);
        return `Hard-coded JSX text "${t}" should be a copy rule.`;
      }
      if (ts.isStringLiteral(node)) {
        return `Hard-coded string "${node.text.slice(0, 50)}" should be a copy rule.`;
      }
    }
    if (ruleId === "no-magic-numbers") {
      return `Magic number ${(node as ts.NumericLiteral).text} in comparison should be a config rule.`;
    }
    if (ruleId === "no-inline-config") {
      return `Inline object literal as JSX prop should be a config rule.`;
    }
    const def = this._rules.find((r) => r.id === ruleId);
    return def?.description ?? ruleId;
  }

  private _checkRulesScope(
    ruleId: string,
    severity: LintSeverity,
    domainFiles: ReadonlyArray<DomainFile>
  ): LintDiagnostic[] {
    const diags: LintDiagnostic[] = [];

    if (ruleId === "rules-no-cycles") {
      const graph = this._ruleStore.dependencyGraph;
      const seen = new Set<string>();
      for (const df of domainFiles) {
        for (const rule of df.rules) {
          if (seen.has(rule.path)) continue;
          seen.add(rule.path);
          if (graph.hasTransitiveDependency(rule.path, rule.path)) {
            diags.push({
              ruleId,
              severity,
              file: `rules/${df.domain}.json`,
              line: 1,
              column: 1,
              message: `Rule "${rule.path}" is part of a dependency cycle.`,
              fixable: false,
            });
          }
        }
      }
    }

    if (ruleId === "rules-no-orphans") {
      // Build the set of rules referenced by OTHER rules (rule-to-rule)
      const referencedByRules = new Set<string>();
      for (const df of domainFiles) {
        for (const rule of df.rules) {
          for (const req of rule.metadata.requires) {
            referencedByRules.add(req);
          }
        }
      }

      for (const df of domainFiles) {
        for (const rule of df.rules) {
          const hasRuleRef = referencedByRules.has(rule.path);
          const hasSourceRef = (this._sourceRefs.get(rule.path)?.length ?? 0) > 0;

          if (!hasRuleRef && !hasSourceRef) {
            // Build a helpful message indicating BOTH reference paths were checked
            const n = this._scannedSourceFileCount;
            const suffix = n > 0
              ? ` (checked ${n} source file${n !== 1 ? "s" : ""} for useRule/useRuleStream calls)`
              : " (no source files were analyzed — run hf lint with src_globs to check source references)";

            diags.push({
              ruleId,
              severity,
              file: `rules/${df.domain}.json`,
              line: 1,
              column: 1,
              message: `Rule "${rule.path}" is never referenced by any rule or source file.${suffix}`,
              fixable: false,
            });
          }
        }
      }
    }

    if (ruleId === "rules-domain-match") {
      for (const df of domainFiles) {
        for (const rule of df.rules) {
          if (!rule.path.startsWith(df.domain + ".")) {
            diags.push({
              ruleId,
              severity,
              file: `rules/${df.domain}.json`,
              line: 1,
              column: 1,
              message: `Rule path "${rule.path}" does not start with domain "${df.domain}".`,
              fixable: false,
            });
          }
        }
      }
    }

    return diags;
  }
}
