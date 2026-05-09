import { describe, it, expect, beforeEach } from "vitest";
import { RuntimeRuleStore } from "../ruleStore";
import type { RuntimeRule } from "../ruleStore";

function makeRule(path: string, requires: string[] = []): RuntimeRule {
  return {
    path,
    kind: "compute",
    inputs: [],
    output: { type: "string" },
    cases: [{ then: { kind: "literal", value: "test" } }],
    metadata: { version: "1", requires, domain: "hiflux" },
    source: "hiflux",
    status: "active",
    lastUpdated: "2026-01-01T00:00:00.000Z",
    isOverride: false,
  };
}

function makeDomainFile(rules: RuntimeRule[]) {
  return { domain: "hiflux", version: "1", rules } as never;
}

describe("RuntimeRuleStore", () => {
  let store: RuntimeRuleStore;

  beforeEach(() => {
    store = new RuntimeRuleStore();
  });

  it("loads rules from domain files", () => {
    store.load([makeDomainFile([makeRule("hiflux.ui.test")])], "hiflux");
    expect(store.get("hiflux.ui.test")).toBeDefined();
    expect(store.get("hiflux.ui.test")?.source).toBe("hiflux");
  });

  it("override takes precedence over source rule", () => {
    store.load([makeDomainFile([makeRule("hiflux.ui.test")])], "hiflux");
    store.write({ ...makeRule("hiflux.ui.test"), status: "draft" });
    expect(store.get("hiflux.ui.test")?.status).toBe("draft");
    expect(store.get("hiflux.ui.test")?.isOverride).toBe(true);
  });

  it("getAll returns merged source + overrides", () => {
    store.load([makeDomainFile([makeRule("hiflux.a"), makeRule("hiflux.b")])], "hiflux");
    store.write({ ...makeRule("hiflux.c"), status: "draft" });
    expect(store.getAll()).toHaveLength(3);
  });

  it("getAll is sorted by path", () => {
    store.load([makeDomainFile([makeRule("hiflux.z"), makeRule("hiflux.a")])], "hiflux");
    const paths = store.getAll().map((r) => r.path);
    expect(paths).toEqual(["hiflux.a", "hiflux.z"]);
  });

  it("getDependents returns rules that require the given path", () => {
    const dep  = makeRule("hiflux.ui.a", ["hiflux.ui.b"]);
    const base = makeRule("hiflux.ui.b");
    store.load([makeDomainFile([dep, base])], "hiflux");
    expect(store.getDependents("hiflux.ui.b")).toContain("hiflux.ui.a");
  });

  it("getDependents returns empty array for rule with no dependents", () => {
    store.load([makeDomainFile([makeRule("hiflux.ui.solo")])], "hiflux");
    expect(store.getDependents("hiflux.ui.solo")).toEqual([]);
  });

  it("promote moves override to source and clears isOverride flag", () => {
    store.load([makeDomainFile([makeRule("hiflux.ui.test")])], "hiflux");
    store.write({ ...makeRule("hiflux.ui.test"), status: "draft" });
    store.promote("hiflux.ui.test");
    expect(store.get("hiflux.ui.test")?.isOverride).toBe(false);
  });

  it("promote returns undefined for non-override rule", () => {
    store.load([makeDomainFile([makeRule("hiflux.ui.test")])], "hiflux");
    expect(store.promote("hiflux.ui.test")).toBeUndefined();
  });

  it("remove deletes rule from source and overrides", () => {
    store.load([makeDomainFile([makeRule("hiflux.ui.test")])], "hiflux");
    store.remove("hiflux.ui.test");
    expect(store.get("hiflux.ui.test")).toBeUndefined();
  });

  it("get returns undefined for missing path", () => {
    expect(store.get("hiflux.does.not.exist")).toBeUndefined();
  });
});
