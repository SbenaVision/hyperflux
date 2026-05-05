/**
 * @file Fix engine — computes and applies automated lint fixes.
 * @module @hyperflux/lint/fix-engine
 * @since 0.1.0
 */

import type { LintDiagnostic, LintFix, LintResult } from "./types";
import type { RuleStore } from "@hyperflux/core";

export interface FixEngineOptions {
  ruleStore: RuleStore;
}

export interface FixPlan {
  diagnostic: LintDiagnostic;
  summary: string;
  newRulePath?: string;
  targetDomainFile?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lineColToOffset(source: string, line: number, column: number): number {
  let offset = 0;
  let currentLine = 1;
  for (let i = 0; i < source.length; i++) {
    if (currentLine === line && (i - offset + 1) === column) return i;
    if (source[i] === "\n") { currentLine++; offset = i + 1; }
  }
  return -1;
}

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "value";
}

function domainFromPath(filePath: string): string {
  // Infer domain from file path segments, e.g. src/components/pricing/X.tsx -> pricing
  const parts = filePath.replace(/\\/g, "/").split("/");
  // Walk from end looking for a known segment that's not a filename
  for (let i = parts.length - 2; i >= 0; i--) {
    const seg = parts[i];
    if (seg && seg !== "src" && seg !== "components" && seg !== "pages" && /^[a-z][a-z0-9_]*$/.test(seg)) {
      return seg;
    }
  }
  return "app";
}

// Extract the literal text the fix is targeting from the source at a given line/col
function extractLiteralAt(source: string, line: number, col: number): string | null {
  const offset = lineColToOffset(source, line, col);
  if (offset < 0) return null;

  // JSX text: no quotes — read until '<' or '{'
  if (source[offset] !== '"' && source[offset] !== "'") {
    let end = offset;
    while (end < source.length && source[end] !== "<" && source[end] !== "{") end++;
    return source.slice(offset, end);
  }

  // Quoted string literal
  const quote = source[offset];
  let i = offset + 1;
  let result = "";
  while (i < source.length && source[i] !== quote) {
    if (source[i] === "\\") { result += source[i + 1]; i += 2; }
    else { result += source[i]; i++; }
  }
  return result;
}

// ---------------------------------------------------------------------------
// FixEngine
// ---------------------------------------------------------------------------

export class FixEngine {
  private readonly _ruleStore: RuleStore;

  constructor(options: FixEngineOptions) {
    this._ruleStore = options.ruleStore;
  }

  computeFixes(result: LintResult, sources: Record<string, string>): ReadonlyArray<LintFix> {
    const fixes: LintFix[] = [];

    for (const diag of result.diagnostics) {
      if (!diag.fixable) continue;
      const source = sources[diag.file];
      if (!source) continue;

      const fix = this._buildFix(diag, source);
      if (fix) fixes.push(fix);
    }

    return fixes;
  }

  private _buildFix(diag: LintDiagnostic, source: string): LintFix | null {
    const domain = domainFromPath(diag.file);

    if (diag.ruleId === "no-hardcoded-copy") {
      const offset = lineColToOffset(source, diag.line, diag.column);
      if (offset < 0) return null;

      const isJsxText = source[offset] !== '"' && source[offset] !== "'";

      if (isJsxText) {
        // JsxText node: find the text content
        let end = offset;
        while (end < source.length && source[end] !== "<" && source[end] !== "{") end++;
        const rawText = source.slice(offset, end);
        const trimmed = rawText.trim();
        if (!trimmed) return null;

        const key = slugify(trimmed);
        const rulePath = `copy.${domain}.${key}`;
        const replacement = `{useRule('${rulePath}')}`;

        return {
          diagnostic: diag,
          apply: (src: string): string => {
            const o = lineColToOffset(src, diag.line, diag.column);
            if (o < 0) return src;
            let e = o;
            while (e < src.length && src[e] !== "<" && src[e] !== "{") e++;
            // Preserve leading/trailing whitespace around the replacement
            const before = src.slice(o, o + (src.slice(o).length - src.slice(o).trimStart().length));
            const after = src.slice(e - (src.slice(0, e).length - src.slice(0, e).trimEnd().length), e);
            return src.slice(0, o + before.length) + replacement + src.slice(e - after.length);
          },
        };
      } else {
        // String literal in attribute: replace `"text"` with `{useRule(...)}`
        const quote = source[offset];
        let end = offset + 1;
        while (end < source.length && source[end] !== quote) {
          if (source[end] === "\\") end += 2; else end++;
        }
        end++; // include closing quote
        const rawLiteral = source.slice(offset, end);
        const inner = rawLiteral.slice(1, -1);
        const key = slugify(inner);
        const rulePath = `copy.${domain}.${key}`;
        const replacement = `{useRule('${rulePath}')}`;

        return {
          diagnostic: diag,
          apply: (src: string): string => {
            const o = lineColToOffset(src, diag.line, diag.column);
            if (o < 0) return src;
            const q = src[o];
            let e = o + 1;
            while (e < src.length && src[e] !== q) {
              if (src[e] === "\\") e += 2; else e++;
            }
            e++;
            return src.slice(0, o) + replacement + src.slice(e);
          },
        };
      }
    }

    if (diag.ruleId === "no-magic-numbers") {
      const offset = lineColToOffset(source, diag.line, diag.column);
      if (offset < 0) return null;

      // Read the numeric literal
      let end = offset;
      while (end < source.length && /[0-9.]/.test(source[end])) end++;
      const numText = source.slice(offset, end);
      const key = `threshold_${numText.replace(".", "_")}`;
      const rulePath = `config.${domain}.${key}`;
      const replacement = `useRule('${rulePath}')`;

      return {
        diagnostic: diag,
        apply: (src: string): string => {
          const o = lineColToOffset(src, diag.line, diag.column);
          if (o < 0) return src;
          let e = o;
          while (e < src.length && /[0-9.]/.test(src[e])) e++;
          return src.slice(0, o) + replacement + src.slice(e);
        },
      };
    }

    return null;
  }

  applyFixes(
    fixes: ReadonlyArray<LintFix>,
    sources: Record<string, string>
  ): Record<string, string> {
    // Group fixes by file
    const byFile = new Map<string, LintFix[]>();
    for (const fix of fixes) {
      const file = fix.diagnostic.file;
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file)!.push(fix);
    }

    const updated: Record<string, string> = {};

    for (const [file, fileFixes] of byFile) {
      const source = sources[file];
      if (!source) continue;

      // Sort by line desc, then column desc — apply last-in-document first
      const sorted = [...fileFixes].sort((a, b) => {
        const lineDiff = b.diagnostic.line - a.diagnostic.line;
        return lineDiff !== 0 ? lineDiff : b.diagnostic.column - a.diagnostic.column;
      });

      let current = source;
      for (const fix of sorted) {
        current = fix.apply(current);
      }
      updated[file] = current;
    }

    return updated;
  }

  planFixes(result: LintResult, sources: Record<string, string>): ReadonlyArray<FixPlan> {
    const plans: FixPlan[] = [];

    for (const diag of result.diagnostics) {
      if (!diag.fixable) continue;
      const source = sources[diag.file];
      if (!source) continue;

      const domain = domainFromPath(diag.file);

      if (diag.ruleId === "no-hardcoded-copy") {
        const offset = lineColToOffset(source, diag.line, diag.column);
        if (offset < 0) continue;
        const isJsxText = source[offset] !== '"' && source[offset] !== "'";
        let inner = "";
        if (isJsxText) {
          let end = offset;
          while (end < source.length && source[end] !== "<" && source[end] !== "{") end++;
          inner = source.slice(offset, end).trim();
        } else {
          const q = source[offset];
          let end = offset + 1;
          while (end < source.length && source[end] !== q) {
            if (source[end] === "\\") end += 2; else end++;
          }
          inner = source.slice(offset + 1, end);
        }
        const key = slugify(inner);
        const rulePath = `copy.${domain}.${key}`;
        plans.push({
          diagnostic: diag,
          summary: `Replace "${inner.slice(0, 30)}" with useRule('${rulePath}')`,
          newRulePath: rulePath,
          targetDomainFile: `rules/copy.json`,
        });
      }

      if (diag.ruleId === "no-magic-numbers") {
        const offset = lineColToOffset(source, diag.line, diag.column);
        if (offset < 0) continue;
        let end = offset;
        while (end < source.length && /[0-9.]/.test(source[end])) end++;
        const numText = source.slice(offset, end);
        const key = `threshold_${numText.replace(".", "_")}`;
        const rulePath = `config.${domain}.${key}`;
        plans.push({
          diagnostic: diag,
          summary: `Replace ${numText} with useRule('${rulePath}')`,
          newRulePath: rulePath,
          targetDomainFile: `rules/config.json`,
        });
      }
    }

    return plans;
  }
}
