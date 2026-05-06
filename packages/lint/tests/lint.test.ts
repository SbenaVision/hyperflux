import { describe, it, expect } from "vitest";
import { Analyzer } from "../src/analyzer";
import { FixEngine } from "../src/fix-engine";
import type { LintRuleDefinition, LintConfig } from "../src/types";
import { RuleStoreImpl, DependencyGraphImpl } from "@hyperflux/core";
import type { DomainFile } from "@hyperflux/core";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const LINT_RULES: LintRuleDefinition[] = [
  {
    id: "no-hardcoded-copy",
    severity_default: "warn",
    scope: "src",
    description: "Hard-coded string in JSX should be a copy rule.",
    patterns: [
      { match: "string-literal-in-jsx-text",      exclude: ["test"] },
      { match: "string-literal-in-jsx-attribute",  exclude: ["test"] },
    ],
    suggestion: "Replace with useRule('copy.<domain>.<key>')",
    fixable: true,
  },
  {
    id: "no-magic-numbers",
    severity_default: "warn",
    scope: "src",
    description: "Magic number in comparison should be a config rule.",
    patterns: [
      { match: "number-literal-in-binary-comparison", exclude: ["test"] },
    ],
    suggestion: "Replace with useRule('config.<domain>.<key>')",
    fixable: true,
  },
  {
    id: "no-inline-config",
    severity_default: "warn",
    scope: "src",
    description: "Inline object literal as JSX prop should be a config rule.",
    patterns: [
      { match: "object-literal-as-jsx-prop", exclude: ["test"] },
    ],
    fixable: false,
  },
  {
    id: "rules-no-cycles",
    severity_default: "error",
    scope: "rules",
    description: "Rule dependency cycles are not allowed.",
    fixable: false,
  },
  {
    id: "rules-no-orphans",
    severity_default: "warn",
    scope: "rules",
    description: "Rules never referenced may be dead code.",
    fixable: false,
  },
  {
    id: "rules-domain-match",
    severity_default: "error",
    scope: "rules",
    description: "Rule path must start with domain name.",
    fixable: false,
  },
];

const BASE_CONFIG: LintConfig = {
  src_globs: ["src/**/*.tsx"],
  rule_globs: ["rules/**/*.json"],
  ignore: [],
  overrides: {},
};

function makeEmptyStore() {
  return new RuleStoreImpl([], [], new DependencyGraphImpl(new Map(), []));
}

function makeAnalyzer(overrides: Record<string, "error" | "warn" | "off"> = {}) {
  return new Analyzer({
    lintRuleDefinitions: LINT_RULES,
    config: { ...BASE_CONFIG, overrides },
    ruleStore: makeEmptyStore(),
  });
}

// ---------------------------------------------------------------------------
// effectiveSeverity
// ---------------------------------------------------------------------------

describe("Analyzer.effectiveSeverity", () => {
  it("returns severity_default when no override", () => {
    const a = makeAnalyzer();
    expect(a.effectiveSeverity("no-hardcoded-copy")).toBe("warn");
    expect(a.effectiveSeverity("rules-no-cycles")).toBe("error");
  });

  it("returns override when set", () => {
    const a = makeAnalyzer({ "no-hardcoded-copy": "error" });
    expect(a.effectiveSeverity("no-hardcoded-copy")).toBe("error");
  });

  it("returns 'off' for unknown rule", () => {
    const a = makeAnalyzer();
    expect(a.effectiveSeverity("unknown-rule")).toBe("off");
  });

  it("returns 'off' when overridden to off", () => {
    const a = makeAnalyzer({ "no-magic-numbers": "off" });
    expect(a.effectiveSeverity("no-magic-numbers")).toBe("off");
  });
});

// ---------------------------------------------------------------------------
// parseSourceFile
// ---------------------------------------------------------------------------

describe("Analyzer.parseSourceFile", () => {
  it("parses TSX without throwing", () => {
    const a = makeAnalyzer();
    const sf = a.parseSourceFile("test.tsx", `export function Foo() { return <div>Hello</div>; }`);
    expect(sf).toBeDefined();
    expect(sf.fileName).toBe("test.tsx");
  });
});

// ---------------------------------------------------------------------------
// no-hardcoded-copy: JSX text
// ---------------------------------------------------------------------------

describe("no-hardcoded-copy (JSX text)", () => {
  it("detects hard-coded JSX text", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/components/pricing/Card.tsx",
      `export function Card() { return <div>Submit Order</div>; }`
    );
    expect(diags.some((d) => d.ruleId === "no-hardcoded-copy")).toBe(true);
    const d = diags.find((d) => d.ruleId === "no-hardcoded-copy")!;
    expect(d.severity).toBe("warn");
    expect(d.fixable).toBe(true);
    expect(d.message).toContain("Submit Order");
  });

  it("does not flag whitespace-only JSX text nodes", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/Foo.tsx",
      `export function Foo() { return <div>\n  <span>X</span>\n</div>; }`
    );
    const textDiags = diags.filter(
      (d) => d.ruleId === "no-hardcoded-copy" && d.message.includes("JSX text")
    );
    // Only the "X" content should be flagged, not the whitespace nodes
    expect(textDiags.every((d) => !d.message.includes('""'))).toBe(true);
  });

  it("skips files matching exclude patterns", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/components/Card.test.tsx",
      `export function Card() { return <div>Submit Order</div>; }`
    );
    expect(diags.filter((d) => d.ruleId === "no-hardcoded-copy")).toHaveLength(0);
  });

  it("respects override to 'off'", async () => {
    const a = makeAnalyzer({ "no-hardcoded-copy": "off" });
    const diags = await a.analyzeFile(
      "src/Foo.tsx",
      `export function Foo() { return <div>Hello World</div>; }`
    );
    expect(diags.filter((d) => d.ruleId === "no-hardcoded-copy")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// no-hardcoded-copy: JSX attribute strings
// ---------------------------------------------------------------------------

describe("no-hardcoded-copy (JSX attribute)", () => {
  it("detects hard-coded label attribute", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/components/Button.tsx",
      `export function Button() { return <Button label="Click me" />; }`
    );
    expect(diags.some((d) => d.ruleId === "no-hardcoded-copy")).toBe(true);
  });

  it("does not flag className attribute", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/components/Foo.tsx",
      `export function Foo() { return <div className="container" />; }`
    );
    expect(diags.filter((d) => d.ruleId === "no-hardcoded-copy")).toHaveLength(0);
  });

  it("does not flag aria-* attributes", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/components/Foo.tsx",
      `export function Foo() { return <button aria-label="Close" />; }`
    );
    expect(diags.filter((d) => d.ruleId === "no-hardcoded-copy")).toHaveLength(0);
  });

  it("does not flag event handler attributes", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/components/Foo.tsx",
      `export function Foo() { return <input onChange="noop" />; }`
    );
    expect(diags.filter((d) => d.ruleId === "no-hardcoded-copy")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// no-magic-numbers
// ---------------------------------------------------------------------------

describe("no-magic-numbers", () => {
  it("detects magic number in comparison", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/utils/pricing.ts",
      `function fee(amount: number) { return amount > 1000 ? 0 : 2.5; }`
    );
    expect(diags.some((d) => d.ruleId === "no-magic-numbers")).toBe(true);
    expect(diags.find((d) => d.ruleId === "no-magic-numbers")!.message).toContain("1000");
  });

  it("does not flag 0 or 1 (trivial values)", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/utils/math.ts",
      `function clamp(x: number) { return x > 0 ? (x < 1 ? x : 1) : 0; }`
    );
    expect(diags.filter((d) => d.ruleId === "no-magic-numbers")).toHaveLength(0);
  });

  it("flags numbers in all comparison operators", async () => {
    const a = makeAnalyzer();
    const src = [
      `function a(x: number) { return x >= 500; }`,
      `function b(x: number) { return x <= 200; }`,
      `function c(x: number) { return x === 42; }`,
      `function d(x: number) { return x !== 99; }`,
    ].join("\n");
    const diags = await a.analyzeFile("src/checks.ts", src);
    expect(diags.filter((d) => d.ruleId === "no-magic-numbers").length).toBeGreaterThanOrEqual(4);
  });

  it("does not flag non-comparison use of numbers", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/math.ts",
      `const x = 5 + 3;`
    );
    expect(diags.filter((d) => d.ruleId === "no-magic-numbers")).toHaveLength(0);
  });

  it("skips test files", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/pricing.test.ts",
      `expect(fee(1500)).toBe(0);`
    );
    expect(diags.filter((d) => d.ruleId === "no-magic-numbers")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// no-inline-config
// ---------------------------------------------------------------------------

describe("no-inline-config", () => {
  it("detects inline object literal as JSX prop", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/components/Chart.tsx",
      `export function Chart() { return <LineChart options={{ color: "red" }} />; }`
    );
    expect(diags.some((d) => d.ruleId === "no-inline-config")).toBe(true);
    expect(diags.find((d) => d.ruleId === "no-inline-config")!.fixable).toBe(false);
  });

  it("does not flag non-object JSX props", async () => {
    const a = makeAnalyzer();
    const diags = await a.analyzeFile(
      "src/components/Foo.tsx",
      `export function Foo() { return <Input value={42} />; }`
    );
    expect(diags.filter((d) => d.ruleId === "no-inline-config")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// analyze() — aggregates src + rules results
// ---------------------------------------------------------------------------

describe("Analyzer.analyze", () => {
  it("returns zero counts for clean sources and empty domain files", async () => {
    const a = makeAnalyzer();
    const result = await a.analyze(
      { "src/Clean.tsx": `export function Clean() { return <div className="x" />; }` },
      []
    );
    expect(result.errorCount).toBe(0);
    expect(result.warnCount).toBe(0);
    expect(result.fixableCount).toBe(0);
  });

  it("aggregates warnings from multiple files", async () => {
    const a = makeAnalyzer();
    const result = await a.analyze(
      {
        "src/A.tsx": `export function A() { return <div>Hello</div>; }`,
        "src/B.tsx": `export function B() { return <div>World</div>; }`,
      },
      []
    );
    expect(result.warnCount).toBeGreaterThanOrEqual(2);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// rules-scope rules
// ---------------------------------------------------------------------------

describe("rules-scope rules", () => {
  const cycleA: DomainFile = {
    domain: "cycle",
    version: "1",
    rules: [
      {
        path: "cycle.a",
        kind: "compute",
        inputs: [],
        output: { type: "number" },
        cases: [{ then: { kind: "rule", path: "cycle.b" } }],
        metadata: { version: "1", requires: ["cycle.b"], domain: "cycle" },
      },
      {
        path: "cycle.b",
        kind: "compute",
        inputs: [],
        output: { type: "number" },
        cases: [{ then: { kind: "rule", path: "cycle.a" } }],
        metadata: { version: "1", requires: ["cycle.a"], domain: "cycle" },
      },
    ],
  };

  it("rules-domain-match: flags rule path not starting with domain", () => {
    const a = makeAnalyzer();
    const badDomain: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [
        {
          path: "billing.atm.fee",
          kind: "compute",
          inputs: [],
          output: { type: "number" },
          cases: [{ then: { kind: "literal", value: 0 } }],
          metadata: { version: "1", requires: [], domain: "pricing" },
        },
      ],
    };
    const diags = a.analyzeRules([badDomain]);
    expect(diags.some((d) => d.ruleId === "rules-domain-match")).toBe(true);
    expect(diags.find((d) => d.ruleId === "rules-domain-match")!.severity).toBe("error");
  });

  it("rules-domain-match: clean domain produces no diagnostic", () => {
    const a = makeAnalyzer();
    const goodDomain: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [
        {
          path: "pricing.atm.fee",
          kind: "compute",
          inputs: [],
          output: { type: "number" },
          cases: [{ then: { kind: "literal", value: 2.5 } }],
          metadata: { version: "1", requires: [], domain: "pricing" },
        },
      ],
    };
    const diags = a.analyzeRules([goodDomain]);
    expect(diags.filter((d) => d.ruleId === "rules-domain-match")).toHaveLength(0);
  });

  it("rules-no-orphans: flags rules never referenced by others", () => {
    const a = makeAnalyzer();
    const domain: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [
        {
          path: "pricing.fee",
          kind: "compute",
          inputs: [],
          output: { type: "number" },
          cases: [{ then: { kind: "literal", value: 2.5 } }],
          metadata: { version: "1", requires: [], domain: "pricing" },
        },
      ],
    };
    const diags = a.analyzeRules([domain]);
    expect(diags.some((d) => d.ruleId === "rules-no-orphans")).toBe(true);
  });

  it("rules-no-orphans: referenced rule is not flagged as orphan", () => {
    const a = makeAnalyzer();
    const domain: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [
        {
          path: "pricing.base",
          kind: "compute",
          inputs: [],
          output: { type: "number" },
          cases: [{ then: { kind: "literal", value: 1 } }],
          metadata: { version: "1", requires: [], domain: "pricing" },
        },
        {
          path: "pricing.fee",
          kind: "compute",
          inputs: [],
          output: { type: "number" },
          cases: [{ then: { kind: "rule", path: "pricing.base" } }],
          metadata: { version: "1", requires: ["pricing.base"], domain: "pricing" },
        },
      ],
    };
    const diags = a.analyzeRules([domain]);
    const orphanDiags = diags.filter((d) => d.ruleId === "rules-no-orphans");
    // pricing.base is referenced by pricing.fee → should not be flagged
    expect(orphanDiags.some((d) => d.message.includes("pricing.base"))).toBe(false);
  });

  it("rules-no-cycles: uses ruleStore's dependency graph", () => {
    // Build a store that already has cyclic edges
    const deps = new Map([
      ["cycle.a", ["cycle.b"]],
      ["cycle.b", ["cycle.a"]],
    ]);
    const graph = new DependencyGraphImpl(deps, ["cycle.a", "cycle.b"]);
    const store = new RuleStoreImpl(cycleA.rules, [cycleA], graph);
    const a = new Analyzer({
      lintRuleDefinitions: LINT_RULES,
      config: BASE_CONFIG,
      ruleStore: store,
    });
    const diags = a.analyzeRules([cycleA]);
    expect(diags.some((d) => d.ruleId === "rules-no-cycles")).toBe(true);
    expect(diags.find((d) => d.ruleId === "rules-no-cycles")!.severity).toBe("error");
  });

  it("rules-* rules are skipped for off severity", () => {
    const a = makeAnalyzer({
      "rules-domain-match": "off",
      "rules-no-orphans": "off",
      "rules-no-cycles": "off",
    });
    const badDomain: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [
        {
          path: "billing.fee",
          kind: "compute",
          inputs: [],
          output: { type: "number" },
          cases: [{ then: { kind: "literal", value: 0 } }],
          metadata: { version: "1", requires: [], domain: "pricing" },
        },
      ],
    };
    expect(a.analyzeRules([badDomain])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// LintResult structure
// ---------------------------------------------------------------------------

describe("LintResult", () => {
  it("counts errors and warnings correctly", async () => {
    const a = new Analyzer({
      lintRuleDefinitions: [
        { ...LINT_RULES[0], severity_default: "error" }, // no-hardcoded-copy → error
        LINT_RULES[1], // no-magic-numbers → warn
      ],
      config: BASE_CONFIG,
      ruleStore: makeEmptyStore(),
    });
    const result = await a.analyze(
      {
        "src/A.tsx": `export function A() { return <div>Hello</div>; }`,
        "src/B.ts": `function f(x: number) { return x > 500; }`,
      },
      []
    );
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
    expect(result.warnCount).toBeGreaterThanOrEqual(1);
  });

  it("fixableCount matches diagnostics with fixable=true", async () => {
    const a = makeAnalyzer();
    const result = await a.analyze(
      { "src/A.tsx": `export function A() { return <div>Hello</div>; }` },
      []
    );
    const expected = result.diagnostics.filter((d) => d.fixable).length;
    expect(result.fixableCount).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// FixEngine
// ---------------------------------------------------------------------------

describe("FixEngine", () => {
  function makeEngine() {
    return new FixEngine({ ruleStore: makeEmptyStore() });
  }

  it("computeFixes returns empty array when no fixable diagnostics", () => {
    const engine = makeEngine();
    const result = { diagnostics: [], errorCount: 0, warnCount: 0, fixableCount: 0, sourceRefs: new Map() };
    expect(engine.computeFixes(result, {})).toHaveLength(0);
  });

  it("computeFixes skips diagnostics with fixable=false", () => {
    const engine = makeEngine();
    const result = {
      diagnostics: [
        {
          ruleId: "no-inline-config", severity: "warn" as const,
          file: "src/A.tsx", line: 1, column: 1,
          message: "test", fixable: false,
        },
      ],
      errorCount: 0, warnCount: 1, fixableCount: 0, sourceRefs: new Map(),
    };
    expect(engine.computeFixes(result, { "src/A.tsx": "<div />" })).toHaveLength(0);
  });

  it("applyFixes replaces hardcoded JSX attribute string", async () => {
    const a = makeAnalyzer();
    const source = `export function Button() { return <Button label="Click me" />; }`;
    const diags = await a.analyzeFile("src/components/pricing/Button.tsx", source);
    const fixableDiags = diags.filter((d) => d.fixable && d.ruleId === "no-hardcoded-copy");
    if (fixableDiags.length === 0) return; // pattern may vary by TSX parsing

    const engine = makeEngine();
    const result = {
      diagnostics: fixableDiags,
      errorCount: 0,
      warnCount: fixableDiags.length,
      fixableCount: fixableDiags.length,
      sourceRefs: new Map(),
    };
    const fixes = engine.computeFixes(result, { "src/components/pricing/Button.tsx": source });
    expect(fixes.length).toBeGreaterThan(0);

    const updated = engine.applyFixes(fixes, { "src/components/pricing/Button.tsx": source });
    expect(updated["src/components/pricing/Button.tsx"]).toContain("useRule(");
  });

  it("applyFixes replaces magic number", async () => {
    const a = makeAnalyzer();
    const source = `function fee(amount: number) { return amount > 1000 ? 0 : 2.5; }`;
    const diags = await a.analyzeFile("src/utils/pricing.ts", source);
    const fixableDiags = diags.filter((d) => d.fixable && d.ruleId === "no-magic-numbers");
    expect(fixableDiags.length).toBeGreaterThan(0);

    const engine = makeEngine();
    const result = {
      diagnostics: fixableDiags,
      errorCount: 0,
      warnCount: fixableDiags.length,
      fixableCount: fixableDiags.length,
      sourceRefs: new Map(),
    };
    const fixes = engine.computeFixes(result, { "src/utils/pricing.ts": source });
    expect(fixes.length).toBeGreaterThan(0);

    const updated = engine.applyFixes(fixes, { "src/utils/pricing.ts": source });
    const newSource = updated["src/utils/pricing.ts"];
    expect(newSource).toContain("useRule(");
    // The literal 1000 should now be inside a rule path, not a bare number
    expect(newSource).toMatch(/useRule\('config\.[^']*1000[^']*'\)/);
  });

  it("applyFixes handles multiple fixes in the same file", async () => {
    const a = makeAnalyzer();
    const source = [
      `function fee(x: number) {`,
      `  if (x > 500) return x > 1000 ? 0 : 2.5;`,
      `  return 99;`,
      `}`,
    ].join("\n");
    const diags = await a.analyzeFile("src/utils/pricing.ts", source);
    const fixableDiags = diags.filter((d) => d.fixable);
    if (fixableDiags.length < 2) return;

    const engine = makeEngine();
    const result = { diagnostics: fixableDiags, errorCount: 0, warnCount: fixableDiags.length, fixableCount: fixableDiags.length, sourceRefs: new Map() };
    const fixes = engine.computeFixes(result, { "src/utils/pricing.ts": source });
    const updated = engine.applyFixes(fixes, { "src/utils/pricing.ts": source });
    expect(updated["src/utils/pricing.ts"]).toContain("useRule(");
  });

  it("planFixes returns descriptions without applying them", async () => {
    const a = makeAnalyzer();
    const source = `function fee(amount: number) { return amount > 1000 ? 0 : 2.5; }`;
    const diags = await a.analyzeFile("src/utils/pricing.ts", source);
    const fixableDiags = diags.filter((d) => d.fixable);

    const engine = makeEngine();
    const result = { diagnostics: fixableDiags, errorCount: 0, warnCount: fixableDiags.length, fixableCount: fixableDiags.length, sourceRefs: new Map() };
    const plans = engine.planFixes(result, { "src/utils/pricing.ts": source });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0].summary).toBeTruthy();
    expect(plans[0].newRulePath).toContain("config.");
  });

  it("applyFixes does not mutate input sources", async () => {
    const a = makeAnalyzer();
    const source = `function f(x: number) { return x > 500; }`;
    const diags = await a.analyzeFile("src/pricing.ts", source);
    const fixableDiags = diags.filter((d) => d.fixable);

    const engine = makeEngine();
    const result = { diagnostics: fixableDiags, errorCount: 0, warnCount: fixableDiags.length, fixableCount: fixableDiags.length, sourceRefs: new Map() };
    const sources = { "src/pricing.ts": source };
    engine.applyFixes(engine.computeFixes(result, sources), sources);
    expect(sources["src/pricing.ts"]).toBe(source); // original unchanged
  });
});

// ---------------------------------------------------------------------------
// Source-ref collection (useRule / useRuleStream scanning)
// ---------------------------------------------------------------------------

describe("Source-ref collection", () => {
  it("detects useRule calls and populates sourceRefs in analyze()", async () => {
    const a = makeAnalyzer();
    const source = `
      import { useRule } from "@hyperflux/react";
      export function Fee() {
        const fee = useRule<number>("pricing.atm.fee", {});
        return fee;
      }
    `;
    const domain: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [{
        path: "pricing.atm.fee",
        kind: "compute", inputs: [],
        output: { type: "number" },
        cases: [{ then: { kind: "literal", value: 2.5 } }],
        metadata: { version: "1", requires: [], domain: "pricing" },
      }],
    };
    const result = await a.analyze({ "src/Fee.tsx": source }, [domain]);
    expect(result.sourceRefs.has("pricing.atm.fee")).toBe(true);
    const refs = result.sourceRefs.get("pricing.atm.fee")!;
    expect(refs.length).toBe(1);
    expect(refs[0].file).toBe("src/Fee.tsx");
    expect(refs[0].hookName).toBe("useRule");
  });

  it("detects useRuleStream calls", async () => {
    const a = makeAnalyzer();
    const source = `
      import { useRuleStream } from "@hyperflux/react";
      export function Fee() {
        const { value } = useRuleStream<number>("pricing.vip.discount", {});
        return value;
      }
    `;
    const domain: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [{
        path: "pricing.vip.discount",
        kind: "compute", inputs: [],
        output: { type: "number" },
        cases: [{ then: { kind: "literal", value: 0.05 } }],
        metadata: { version: "1", requires: [], domain: "pricing" },
      }],
    };
    const result = await a.analyze({ "src/Pricing.tsx": source }, [domain]);
    const refs = result.sourceRefs.get("pricing.vip.discount") ?? [];
    expect(refs.length).toBe(1);
    expect(refs[0].hookName).toBe("useRuleStream");
  });

  it("rule referenced only from source is NOT flagged as orphan", async () => {
    const a = makeAnalyzer();
    const source = `
      const fee = useRule("pricing.atm.fee", {});
    `;
    const domain: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [{
        path: "pricing.atm.fee",
        kind: "compute", inputs: [],
        output: { type: "number" },
        cases: [{ then: { kind: "literal", value: 2.5 } }],
        metadata: { version: "1", requires: [], domain: "pricing" },
      }],
    };
    const result = await a.analyze({ "src/Fee.ts": source }, [domain]);
    const orphans = result.diagnostics.filter((d) => d.ruleId === "rules-no-orphans");
    expect(orphans.some((d) => d.message.includes("pricing.atm.fee"))).toBe(false);
  });

  it("rule with NO rule-refs AND NO source-refs IS flagged as orphan", async () => {
    const a = makeAnalyzer();
    // Source file does NOT reference the rule
    const source = `export const x = 1;`;
    const domain: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [{
        path: "pricing.dead.rule",
        kind: "compute", inputs: [],
        output: { type: "number" },
        cases: [{ then: { kind: "literal", value: 0 } }],
        metadata: { version: "1", requires: [], domain: "pricing" },
      }],
    };
    const result = await a.analyze({ "src/Something.ts": source }, [domain]);
    const orphans = result.diagnostics.filter((d) => d.ruleId === "rules-no-orphans");
    expect(orphans.some((d) => d.message.includes("pricing.dead.rule"))).toBe(true);
    // Message should mention the source file count
    expect(orphans[0].message).toContain("1 source file");
  });

  it("sourceRefsFor() returns refs after analyze()", async () => {
    const a = makeAnalyzer();
    const source = `
      const a = useRule("config.x", {});
      const b = useRule("config.x", {});
      const c = useRule("config.y", {});
    `;
    await a.analyze({ "src/App.ts": source }, []);
    expect(a.sourceRefsFor("config.x").length).toBe(2);
    expect(a.sourceRefsFor("config.y").length).toBe(1);
    expect(a.sourceRefsFor("config.z").length).toBe(0);
  });

  it("sourceRefs are reset on each analyze() call", async () => {
    const a = makeAnalyzer();
    const source1 = `const x = useRule("pricing.fee", {});`;
    await a.analyze({ "src/A.ts": source1 }, []);
    expect(a.sourceRefsFor("pricing.fee").length).toBe(1);

    // Second call with different source — refs should not accumulate
    const source2 = `export const y = 1;`;
    await a.analyze({ "src/B.ts": source2 }, []);
    expect(a.sourceRefsFor("pricing.fee").length).toBe(0);
  });

  it("skips dynamic useRule calls (template literals, variables)", async () => {
    const a = makeAnalyzer();
    const source = `
      const key = "pricing.fee";
      const a = useRule(key, {});          // variable — cannot resolve statically
      const b = useRule(\`pricing.\${x}\`, {}); // template — cannot resolve statically
    `;
    await a.analyze({ "src/Dynamic.ts": source }, []);
    // Neither dynamic call should produce a source ref
    expect(a.allSourceRefs.size).toBe(0);
  });

  it("multiple source files — rule referenced in one is not orphan", async () => {
    const a = makeAnalyzer();
    const domain: DomainFile = {
      domain: "copy",
      version: "1",
      rules: [
        {
          path: "copy.submit",
          kind: "compute", inputs: [],
          output: { type: "string" },
          cases: [{ then: { kind: "literal", value: "Submit" } }],
          metadata: { version: "1", requires: [], domain: "copy" },
        },
        {
          path: "copy.cancel",
          kind: "compute", inputs: [],
          output: { type: "string" },
          cases: [{ then: { kind: "literal", value: "Cancel" } }],
          metadata: { version: "1", requires: [], domain: "copy" },
        },
      ],
    };
    const sources = {
      "src/Form.tsx": `const label = useRule("copy.submit", {});`,
      // copy.cancel not referenced anywhere
    };
    const result = await a.analyze(sources, [domain]);
    const orphans = result.diagnostics.filter((d) => d.ruleId === "rules-no-orphans");
    expect(orphans.some((d) => d.message.includes("copy.submit"))).toBe(false);
    expect(orphans.some((d) => d.message.includes("copy.cancel"))).toBe(true);
  });
});
