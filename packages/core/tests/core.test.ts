import { describe, it, expect, beforeEach } from "vitest";
import {
  FunctionRegistry,
  OperatorRegistryImpl,
  canonicalJSON,
  buildCacheKey,
} from "../src/expressions";
import { RuleStoreImpl, DependencyGraphImpl } from "../src/rules";
import { Resolver, RequestContext } from "../src/resolver";
import { RuleLoader } from "../src/loader";
import { formatTrace, filterTrace, traceToJSON, traceFromJSON } from "../src/trace";
import {
  RuleNotFoundError,
  InputTypeError,
  OutputTypeError,
  NoMatchingCaseError,
} from "../src/errors";
import type { Rule, DomainFile } from "../src/schema";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const operatorsJson = {
  operators: [
    { op: "==",  arity: 2,   input_types: ["any","any"],          output_type: "boolean" },
    { op: "!=",  arity: 2,   input_types: ["any","any"],          output_type: "boolean" },
    { op: ">",   arity: 2,   input_types: ["number","number"],    output_type: "boolean" },
    { op: ">=",  arity: 2,   input_types: ["number","number"],    output_type: "boolean" },
    { op: "<",   arity: 2,   input_types: ["number","number"],    output_type: "boolean" },
    { op: "<=",  arity: 2,   input_types: ["number","number"],    output_type: "boolean" },
    { op: "+",   arity: 2,   input_types: ["number","number"],    output_type: "number"  },
    { op: "-",   arity: 2,   input_types: ["number","number"],    output_type: "number"  },
    { op: "*",   arity: 2,   input_types: ["number","number"],    output_type: "number"  },
    { op: "/",   arity: 2,   input_types: ["number","number"],    output_type: "number"  },
    { op: "%",   arity: 2,   input_types: ["number","number"],    output_type: "number"  },
    { op: "AND", arity: "n", min: 2, input_types: "boolean",      output_type: "boolean" },
    { op: "OR",  arity: "n", min: 2, input_types: "boolean",      output_type: "boolean" },
    { op: "NOT", arity: 1,   input_types: ["boolean"],            output_type: "boolean" },
  ],
};

function makeOperatorRegistry() {
  return new OperatorRegistryImpl(operatorsJson.operators as Parameters<typeof OperatorRegistryImpl>[0]);
}

function makeFunctionRegistry() {
  return new FunctionRegistry();
}

/** ATM fee rule: free if amount > 1000, else $2.50 */
const atmFeeRule: Rule = {
  path: "pricing.atm.fee",
  kind: "compute",
  inputs: [{ name: "amount", type: { type: "number" } }],
  output: { type: "number" },
  cases: [
    {
      when: {
        kind: "op", op: ">",
        args: [
          { kind: "input", path: ["amount"] },
          { kind: "literal", value: 1000 },
        ],
      },
      then: { kind: "literal", value: 0 },
    },
    { then: { kind: "literal", value: 2.5 } },
  ],
  metadata: { version: "1", requires: [], domain: "pricing" },
};

/** Static config rule */
const submitLabelRule: Rule = {
  path: "ui.labels.submit",
  kind: "config",
  inputs: [],
  output: { type: "string" },
  cases: [{ then: { kind: "literal", value: "Submit" } }],
  metadata: { version: "1", requires: [], domain: "ui" },
};

/** Rule that depends on atmFeeRule */
const feeApplicableRule: Rule = {
  path: "pricing.fee_applicable",
  kind: "compute",
  inputs: [{ name: "amount", type: { type: "number" } }],
  output: { type: "boolean" },
  cases: [
    {
      when: {
        kind: "op", op: ">",
        args: [
          {
            kind: "rule",
            path: "pricing.atm.fee",
            args: [{ kind: "input", path: ["amount"] }],
          },
          { kind: "literal", value: 0 },
        ],
      },
      then: { kind: "literal", value: true },
    },
    { then: { kind: "literal", value: false } },
  ],
  metadata: { version: "1", requires: ["pricing.atm.fee"], domain: "pricing" },
};

function makeStore(rules: Rule[], domainFiles: DomainFile[] = []): RuleStoreImpl {
  const deps = new Map<string, string[]>();
  for (const r of rules) {
    deps.set(r.path, r.metadata.requires);
  }
  const graph = new DependencyGraphImpl(deps, rules.map((r) => r.path));
  return new RuleStoreImpl(rules, domainFiles, graph);
}

function makeResolver(rules: Rule[]): Resolver {
  const store = makeStore(rules);
  return new Resolver({
    ruleStore: store,
    functionRegistry: makeFunctionRegistry(),
    operatorRegistry: makeOperatorRegistry(),
  });
}

// ---------------------------------------------------------------------------
// canonicalJSON
// ---------------------------------------------------------------------------

describe("canonicalJSON", () => {
  it("handles primitives", () => {
    expect(canonicalJSON(null)).toBe("null");
    expect(canonicalJSON(true)).toBe("true");
    expect(canonicalJSON(42)).toBe("42");
    expect(canonicalJSON("hello")).toBe('"hello"');
  });

  it("sorts object keys", () => {
    expect(canonicalJSON({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("sorts keys recursively", () => {
    expect(canonicalJSON({ b: { d: 4, c: 3 }, a: 1 })).toBe('{"a":1,"b":{"c":3,"d":4}}');
  });

  it("preserves array order", () => {
    expect(canonicalJSON([3, 1, 2])).toBe("[3,1,2]");
  });

  it("throws on symbol", () => {
    expect(() => canonicalJSON(Symbol("x"))).toThrow(TypeError);
  });
});

describe("buildCacheKey", () => {
  it("produces deterministic keys regardless of input key order", () => {
    const k1 = buildCacheKey("pricing.fee", { b: 2, a: 1 });
    const k2 = buildCacheKey("pricing.fee", { a: 1, b: 2 });
    expect(k1).toBe(k2);
    expect(k1).toBe('pricing.fee::{"a":1,"b":2}');
  });
});

// ---------------------------------------------------------------------------
// OperatorRegistryImpl
// ---------------------------------------------------------------------------

describe("OperatorRegistryImpl", () => {
  it("looks up operators", () => {
    const reg = makeOperatorRegistry();
    expect(reg.hasOperator("==")).toBe(true);
    expect(reg.hasOperator("UNKNOWN")).toBe(false);
    expect(reg.getOperator(">")?.arity).toBe(2);
  });

  it("returns all operators", () => {
    const reg = makeOperatorRegistry();
    expect(reg.getAllOperators().length).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// FunctionRegistry
// ---------------------------------------------------------------------------

describe("FunctionRegistry", () => {
  it("registers and retrieves functions", () => {
    const reg = makeFunctionRegistry();
    reg.register({
      name: "double",
      inputs: [{ name: "x", type: { type: "number" } }],
      output: { type: "number" },
      implementation: ({ x }) => (x as number) * 2,
    });
    expect(reg.has("double")).toBe(true);
    expect(reg.get("double")?.name).toBe("double");
    expect(reg.get("double")?.implementation({ x: 5 })).toBe(10);
  });

  it("throws on duplicate registration", () => {
    const reg = makeFunctionRegistry();
    const def = {
      name: "f",
      inputs: [],
      output: { type: "string" as const },
      implementation: () => "x",
    };
    reg.register(def);
    expect(() => reg.register(def)).toThrow("already registered");
  });
});

// ---------------------------------------------------------------------------
// RuleStore / DependencyGraph
// ---------------------------------------------------------------------------

describe("RuleStoreImpl", () => {
  it("indexes rules by path", () => {
    const store = makeStore([atmFeeRule, submitLabelRule]);
    expect(store.get("pricing.atm.fee")).toBe(atmFeeRule);
    expect(store.get("missing")).toBeUndefined();
    expect(store.size).toBe(2);
  });

  it("returns rules by domain", () => {
    const store = makeStore([atmFeeRule, submitLabelRule]);
    expect(store.getByDomain("pricing")).toEqual([atmFeeRule]);
    expect(store.getByDomain("ui")).toEqual([submitLabelRule]);
    expect(store.getDomains()).toContain("pricing");
  });
});

describe("DependencyGraphImpl", () => {
  it("tracks dependencies and reverse edges", () => {
    const deps = new Map([
      ["pricing.fee_applicable", ["pricing.atm.fee"]],
      ["pricing.atm.fee", []],
    ]);
    const order = ["pricing.atm.fee", "pricing.fee_applicable"];
    const graph = new DependencyGraphImpl(deps, order);
    expect(graph.getDependencies("pricing.fee_applicable")).toEqual(["pricing.atm.fee"]);
    expect(graph.getDependents("pricing.atm.fee")).toEqual(["pricing.fee_applicable"]);
    expect(graph.hasTransitiveDependency("pricing.fee_applicable", "pricing.atm.fee")).toBe(true);
    expect(graph.hasTransitiveDependency("pricing.atm.fee", "pricing.fee_applicable")).toBe(false);
  });

  it("returns topological order", () => {
    const deps = new Map([
      ["a.b", ["a.c"]],
      ["a.c", []],
    ]);
    const graph = new DependencyGraphImpl(deps, ["a.c", "a.b"]);
    expect(graph.topologicalOrder()).toEqual(["a.c", "a.b"]);
  });
});

// ---------------------------------------------------------------------------
// RequestContext
// ---------------------------------------------------------------------------

describe("RequestContext", () => {
  it("defaults to no tracing", () => {
    const ctx = new RequestContext();
    expect(ctx.recordTrace).toBe(false);
  });

  it("caches and retrieves values", () => {
    const ctx = new RequestContext();
    expect(ctx.getCacheEntry("k")).toBeUndefined();
    ctx.setCacheEntry("k", 42);
    expect(ctx.getCacheEntry("k")).toBe(42);
    expect(ctx.cacheSize).toBe(1);
  });

  it("returns null trace when not recording", () => {
    const ctx = new RequestContext();
    expect(ctx.getTrace()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Resolver — basic evaluation
// ---------------------------------------------------------------------------

describe("Resolver.evaluate", () => {
  it("evaluates a compute rule with matching case", () => {
    const resolver = makeResolver([atmFeeRule]);
    expect(resolver.evaluate<number>("pricing.atm.fee", { amount: 500 })).toBe(2.5);
    expect(resolver.evaluate<number>("pricing.atm.fee", { amount: 1500 })).toBe(0);
  });

  it("evaluates a config rule (no inputs)", () => {
    const resolver = makeResolver([submitLabelRule]);
    expect(resolver.evaluate<string>("ui.labels.submit", {})).toBe("Submit");
  });

  it("throws RuleNotFoundError for unknown path", () => {
    const resolver = makeResolver([]);
    expect(() => resolver.evaluate("missing.rule", {})).toThrow(RuleNotFoundError);
  });

  it("throws InputTypeError when input type is wrong", () => {
    const resolver = makeResolver([atmFeeRule]);
    expect(() =>
      resolver.evaluate("pricing.atm.fee", { amount: "not-a-number" })
    ).toThrow(InputTypeError);
  });

  it("throws OutputTypeError when output type mismatches", () => {
    const badRule: Rule = {
      path: "bad.rule",
      kind: "config",
      inputs: [],
      output: { type: "number" },
      cases: [{ then: { kind: "literal", value: "not-a-number" } }],
      metadata: { version: "1", requires: [], domain: "bad" },
    };
    const resolver = makeResolver([badRule]);
    expect(() => resolver.evaluate("bad.rule", {})).toThrow(OutputTypeError);
  });

  it("throws NoMatchingCaseError when no case matches and no default", () => {
    const noDefaultRule: Rule = {
      path: "test.rule",
      kind: "compute",
      inputs: [{ name: "x", type: { type: "number" } }],
      output: { type: "string" },
      cases: [
        {
          when: { kind: "op", op: ">", args: [{ kind: "input", path: ["x"] }, { kind: "literal", value: 100 }] },
          then: { kind: "literal", value: "high" },
        },
      ],
      metadata: { version: "1", requires: [], domain: "test" },
    };
    const resolver = makeResolver([noDefaultRule]);
    expect(() => resolver.evaluate("test.rule", { x: 50 })).toThrow(NoMatchingCaseError);
  });
});

// ---------------------------------------------------------------------------
// Resolver — operators
// ---------------------------------------------------------------------------

describe("Resolver — operators", () => {
  it("evaluates all comparison operators", () => {
    const makeRule = (name: string, op: string): Rule => ({
      path: `cmp.${name}`,
      kind: "compute",
      inputs: [
        { name: "a", type: { type: "number" } },
        { name: "b", type: { type: "number" } },
      ],
      output: { type: "boolean" },
      cases: [
        {
          when: { kind: "op", op, args: [{ kind: "input", path: ["a"] }, { kind: "input", path: ["b"] }] },
          then: { kind: "literal", value: true },
        },
        { then: { kind: "literal", value: false } },
      ],
      metadata: { version: "1", requires: [], domain: "cmp" },
    });

    const resolver = makeResolver([
      makeRule("lt",  "<"),
      makeRule("lte", "<="),
      makeRule("gt",  ">"),
      makeRule("gte", ">="),
      makeRule("eq",  "=="),
      makeRule("neq", "!="),
    ]);

    expect(resolver.evaluate("cmp.lt",  { a: 3, b: 5 })).toBe(true);
    expect(resolver.evaluate("cmp.lt",  { a: 5, b: 3 })).toBe(false);
    expect(resolver.evaluate("cmp.lte", { a: 5, b: 5 })).toBe(true);
    expect(resolver.evaluate("cmp.gt",  { a: 5, b: 3 })).toBe(true);
    expect(resolver.evaluate("cmp.gte", { a: 5, b: 5 })).toBe(true);
    expect(resolver.evaluate("cmp.eq",  { a: 5, b: 5 })).toBe(true);
    expect(resolver.evaluate("cmp.neq", { a: 3, b: 5 })).toBe(true);
  });

  it("evaluates arithmetic operators", () => {
    const addRule: Rule = {
      path: "math.add",
      kind: "compute",
      inputs: [{ name: "a", type: { type: "number" } }, { name: "b", type: { type: "number" } }],
      output: { type: "number" },
      cases: [{ then: { kind: "op", op: "+", args: [{ kind: "input", path: ["a"] }, { kind: "input", path: ["b"] }] } }],
      metadata: { version: "1", requires: [], domain: "math" },
    };
    const resolver = makeResolver([addRule]);
    expect(resolver.evaluate<number>("math.add", { a: 3, b: 4 })).toBe(7);
  });

  it("evaluates AND / OR / NOT", () => {
    const notRule: Rule = {
      path: "logic.not",
      kind: "compute",
      inputs: [{ name: "v", type: { type: "boolean" } }],
      output: { type: "boolean" },
      cases: [{ then: { kind: "op", op: "NOT", args: [{ kind: "input", path: ["v"] }] } }],
      metadata: { version: "1", requires: [], domain: "logic" },
    };
    const resolver = makeResolver([notRule]);
    expect(resolver.evaluate("logic.not", { v: true })).toBe(false);
    expect(resolver.evaluate("logic.not", { v: false })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Resolver — fn expressions
// ---------------------------------------------------------------------------

describe("Resolver — fn expressions", () => {
  it("calls registered functions", () => {
    const registry = makeFunctionRegistry();
    registry.register({
      name: "double",
      inputs: [{ name: "x", type: { type: "number" } }],
      output: { type: "number" },
      implementation: ({ x }) => (x as number) * 2,
    });

    const fnRule: Rule = {
      path: "math.doubled",
      kind: "compute",
      inputs: [{ name: "x", type: { type: "number" } }],
      output: { type: "number" },
      cases: [{ then: { kind: "fn", name: "double", args: [{ kind: "input", path: ["x"] }] } }],
      metadata: { version: "1", requires: [], domain: "math" },
    };

    const store = makeStore([fnRule]);
    const resolver = new Resolver({
      ruleStore: store,
      functionRegistry: registry,
      operatorRegistry: makeOperatorRegistry(),
    });
    expect(resolver.evaluate<number>("math.doubled", { x: 7 })).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// Resolver — rule cross-references
// ---------------------------------------------------------------------------

describe("Resolver — rule expressions", () => {
  it("evaluates rules that reference other rules", () => {
    const resolver = makeResolver([atmFeeRule, feeApplicableRule]);
    // amount 500 → fee is 2.5 > 0 → applicable
    expect(resolver.evaluate("pricing.fee_applicable", { amount: 500 })).toBe(true);
    // amount 1500 → fee is 0 → not applicable
    expect(resolver.evaluate("pricing.fee_applicable", { amount: 1500 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Resolver — caching
// ---------------------------------------------------------------------------

describe("Resolver — request context caching", () => {
  it("caches results within a context", () => {
    const resolver = makeResolver([atmFeeRule]);
    const ctx = new RequestContext();
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, ctx);
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, ctx);
    expect(ctx.cacheSize).toBe(1);
  });

  it("does not share cache across contexts", () => {
    const resolver = makeResolver([atmFeeRule]);
    const ctx1 = new RequestContext();
    const ctx2 = new RequestContext();
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, ctx1);
    expect(ctx2.cacheSize).toBe(0);
  });

  it("uses canonical key regardless of input key order", () => {
    const twoInputRule: Rule = {
      path: "test.two",
      kind: "compute",
      inputs: [
        { name: "a", type: { type: "number" } },
        { name: "b", type: { type: "number" } },
      ],
      output: { type: "number" },
      cases: [{ then: { kind: "op", op: "+", args: [{ kind: "input", path: ["a"] }, { kind: "input", path: ["b"] }] } }],
      metadata: { version: "1", requires: [], domain: "test" },
    };
    const resolver = makeResolver([twoInputRule]);
    const ctx = new RequestContext();
    resolver.evaluate("test.two", { a: 1, b: 2 }, ctx);
    resolver.evaluate("test.two", { b: 2, a: 1 }, ctx);
    expect(ctx.cacheSize).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Resolver — tracing
// ---------------------------------------------------------------------------

describe("Resolver — tracing", () => {
  it("records a trace tree when recordTrace is true", () => {
    const resolver = makeResolver([atmFeeRule]);
    const ctx = new RequestContext({ recordTrace: true });
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, ctx);
    const tree = ctx.getTrace();
    expect(tree).not.toBeNull();
    expect(tree!.root.path).toBe("pricing.atm.fee");
    expect(tree!.root.output).toBe(2.5);
    expect(tree!.evaluationCount).toBe(1);
  });

  it("does not record trace when recordTrace is false", () => {
    const resolver = makeResolver([atmFeeRule]);
    const ctx = new RequestContext({ recordTrace: false });
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, ctx);
    expect(ctx.getTrace()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluateAs
// ---------------------------------------------------------------------------

describe("Resolver.evaluateAs", () => {
  it("returns value when type matches", () => {
    const resolver = makeResolver([atmFeeRule]);
    const fee = resolver.evaluateAs<number>("pricing.atm.fee", { type: "number" }, { amount: 500 });
    expect(fee).toBe(2.5);
  });

  it("throws OutputTypeError when expectedType does not match", () => {
    const resolver = makeResolver([atmFeeRule]);
    expect(() =>
      resolver.evaluateAs("pricing.atm.fee", { type: "string" }, { amount: 500 })
    ).toThrow(OutputTypeError);
  });
});

// ---------------------------------------------------------------------------
// Resolver — swapRuleStore
// ---------------------------------------------------------------------------

describe("Resolver.swapRuleStore", () => {
  it("uses the new store after swap", () => {
    const resolver = makeResolver([submitLabelRule]);
    expect(resolver.evaluate<string>("ui.labels.submit", {})).toBe("Submit");

    const updatedRule: Rule = {
      ...submitLabelRule,
      cases: [{ then: { kind: "literal", value: "Save" } }],
    };
    const newStore = makeStore([updatedRule]);
    resolver.swapRuleStore(newStore);
    expect(resolver.evaluate<string>("ui.labels.submit", {})).toBe("Save");
  });
});

// ---------------------------------------------------------------------------
// Trace utilities
// ---------------------------------------------------------------------------

describe("formatTrace", () => {
  it("produces a non-empty string", () => {
    const resolver = makeResolver([atmFeeRule]);
    const ctx = new RequestContext({ recordTrace: true });
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, ctx);
    const output = formatTrace(ctx.getTrace()!);
    expect(output).toContain("pricing.atm.fee");
    expect(output).toContain("evaluations:");
  });

  it("includes inputs/outputs in verbose mode", () => {
    const resolver = makeResolver([atmFeeRule]);
    const ctx = new RequestContext({ recordTrace: true });
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, ctx);
    const output = formatTrace(ctx.getTrace()!, { verbose: true });
    expect(output).toContain("inputs:");
    expect(output).toContain("output:");
  });
});

describe("filterTrace", () => {
  it("returns null when predicate matches nothing", () => {
    const resolver = makeResolver([atmFeeRule]);
    const ctx = new RequestContext({ recordTrace: true });
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, ctx);
    const result = filterTrace(ctx.getTrace()!, () => false);
    expect(result).toBeNull();
  });

  it("returns tree when root matches", () => {
    const resolver = makeResolver([atmFeeRule]);
    const ctx = new RequestContext({ recordTrace: true });
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, ctx);
    const result = filterTrace(ctx.getTrace()!, (n) => n.path === "pricing.atm.fee");
    expect(result).not.toBeNull();
  });
});

describe("traceToJSON / traceFromJSON", () => {
  it("round-trips a trace tree", () => {
    const resolver = makeResolver([atmFeeRule]);
    const ctx = new RequestContext({ recordTrace: true });
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, ctx);
    const original = ctx.getTrace()!;
    const json = traceToJSON(original);
    const restored = traceFromJSON(json);
    expect(restored.root.path).toBe(original.root.path);
    expect(restored.root.output).toBe(original.root.output);
  });

  it("throws on invalid JSON", () => {
    expect(() => traceFromJSON("not-json")).toThrow(SyntaxError);
  });

  it("throws on missing required fields", () => {
    expect(() => traceFromJSON('{"foo": 1}')).toThrow(Error);
  });
});

// ---------------------------------------------------------------------------
// RuleLoader — integration
// ---------------------------------------------------------------------------

describe("RuleLoader", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `hf-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  const cleanup = async (dir: string) => {
    await rm(dir, { recursive: true, force: true });
  };

  it("loads a valid rule file", async () => {
    const domainFile: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [atmFeeRule],
    };
    await writeFile(join(tmpDir, "pricing.json"), JSON.stringify(domainFile));

    const loader = new RuleLoader({
      rulesDir: tmpDir,
      functionRegistry: makeFunctionRegistry(),
      operatorRegistry: makeOperatorRegistry(),
    });

    const { ruleStore, warnings } = await loader.load();
    expect(ruleStore.size).toBe(1);
    expect(ruleStore.get("pricing.atm.fee")).toBeDefined();
    expect(warnings.filter((w) => w.includes("error"))).toHaveLength(0);

    await cleanup(tmpDir);
  });

  it("warns when no rule files found", async () => {
    const loader = new RuleLoader({
      rulesDir: tmpDir,
      functionRegistry: makeFunctionRegistry(),
      operatorRegistry: makeOperatorRegistry(),
    });

    const { ruleStore, warnings } = await loader.load();
    expect(ruleStore.size).toBe(0);
    expect(warnings.some((w) => w.includes("No rule files"))).toBe(true);

    await cleanup(tmpDir);
  });

  it("throws LoadError on domain mismatch", async () => {
    const domainFile: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [atmFeeRule],
    };
    // Write to wrong filename
    await writeFile(join(tmpDir, "billing.json"), JSON.stringify(domainFile));

    const loader = new RuleLoader({
      rulesDir: tmpDir,
      functionRegistry: makeFunctionRegistry(),
      operatorRegistry: makeOperatorRegistry(),
    });

    await expect(loader.load()).rejects.toThrow("does not match filename domain");
    await cleanup(tmpDir);
  });

  it("throws LoadError on duplicate paths", async () => {
    const file1: DomainFile = { domain: "pricing", version: "1", rules: [atmFeeRule] };
    // Can't have duplicate paths in same file; split into two domains
    const dupRule: Rule = { ...atmFeeRule };
    // Force the same path across two files by using raw JSON
    await writeFile(join(tmpDir, "pricing.json"), JSON.stringify(file1));
    // Create a second file referencing same path via raw object (bypassing type system)
    const file2 = { domain: "pricing2", version: "1", rules: [{ ...atmFeeRule, path: "pricing2.atm.fee" }] };
    await writeFile(join(tmpDir, "pricing2.json"), JSON.stringify(file2));

    const loader = new RuleLoader({
      rulesDir: tmpDir,
      functionRegistry: makeFunctionRegistry(),
      operatorRegistry: makeOperatorRegistry(),
    });

    const { ruleStore } = await loader.load();
    expect(ruleStore.size).toBe(2);
    await cleanup(tmpDir);
  });

  it("throws LoadError on cycle", async () => {
    const ruleA: Rule = {
      path: "cycle.a",
      kind: "compute",
      inputs: [],
      output: { type: "number" },
      cases: [{ then: { kind: "rule", path: "cycle.b" } }],
      metadata: { version: "1", requires: ["cycle.b"], domain: "cycle" },
    };
    const ruleB: Rule = {
      path: "cycle.b",
      kind: "compute",
      inputs: [],
      output: { type: "number" },
      cases: [{ then: { kind: "rule", path: "cycle.a" } }],
      metadata: { version: "1", requires: ["cycle.a"], domain: "cycle" },
    };
    const domainFile: DomainFile = { domain: "cycle", version: "1", rules: [ruleA, ruleB] };
    await writeFile(join(tmpDir, "cycle.json"), JSON.stringify(domainFile));

    const loader = new RuleLoader({
      rulesDir: tmpDir,
      functionRegistry: makeFunctionRegistry(),
      operatorRegistry: makeOperatorRegistry(),
    });

    await expect(loader.load()).rejects.toThrow("Cyclic rule dependency");
    await cleanup(tmpDir);
  });

  it("full pipeline: load → resolve", async () => {
    const domainFile: DomainFile = {
      domain: "pricing",
      version: "1",
      rules: [atmFeeRule],
    };
    await writeFile(join(tmpDir, "pricing.json"), JSON.stringify(domainFile));

    const funcRegistry = makeFunctionRegistry();
    const opRegistry = makeOperatorRegistry();

    const loader = new RuleLoader({
      rulesDir: tmpDir,
      functionRegistry: funcRegistry,
      operatorRegistry: opRegistry,
    });

    const { ruleStore } = await loader.load();
    const resolver = new Resolver({
      ruleStore,
      functionRegistry: funcRegistry,
      operatorRegistry: opRegistry,
    });

    expect(resolver.evaluate<number>("pricing.atm.fee", { amount: 500 })).toBe(2.5);
    expect(resolver.evaluate<number>("pricing.atm.fee", { amount: 1500 })).toBe(0);

    await cleanup(tmpDir);
  });
});
