import { describe, it, expect } from "vitest";
import { toTableRow, toDetail } from "../viewmodel";
import type { RuntimeRule } from "../ruleStore";

function makeRule(path: string, overrides: Partial<RuntimeRule> = {}): RuntimeRule {
  return {
    path,
    kind: "compute",
    inputs: [],
    output: { type: "string" },
    cases: [] as unknown as [import("../ruleStore").RuntimeRule["cases"][0], ...import("../ruleStore").RuntimeRule["cases"]],
    metadata: { version: "1", requires: ["hiflux.other.rule"], domain: "hiflux" },
    source: "hiflux",
    status: "active",
    lastUpdated: "2026-01-01T00:00:00.000Z",
    isOverride: false,
    ...overrides,
  };
}

describe("toTableRow", () => {
  it("maps rule to table row with correct fields", () => {
    const row = toTableRow(makeRule("hiflux.ui.test"), ["hiflux.consumer"]);
    expect(row.path).toBe("hiflux.ui.test");
    expect(row.status).toBe("active");
    expect(row.dependencyCount).toBe(1);
    expect(row.source).toBe("hiflux");
    expect(row.isOverride).toBe(false);
  });

  it("reflects isOverride flag", () => {
    const row = toTableRow(makeRule("hiflux.ui.test", { isOverride: true }), []);
    expect(row.isOverride).toBe(true);
  });

  it("dependencyCount reflects metadata.requires length", () => {
    const rule = makeRule("hiflux.ui.test", {
      metadata: { version: "1", requires: ["hiflux.a", "hiflux.b"], domain: "hiflux" },
    });
    expect(toTableRow(rule, []).dependencyCount).toBe(2);
  });
});

describe("toDetail", () => {
  it("maps rule to detail view including usedBy", () => {
    const detail = toDetail(makeRule("hiflux.ui.test"), ["hiflux.consumer"]);
    expect(detail.path).toBe("hiflux.ui.test");
    expect(detail.requires).toEqual(["hiflux.other.rule"]);
    expect(detail.usedBy).toEqual(["hiflux.consumer"]);
    expect(detail.source).toBe("hiflux");
  });

  it("maps draft status correctly", () => {
    const detail = toDetail(makeRule("hiflux.ui.test", { status: "draft" }), []);
    expect(detail.status).toBe("draft");
  });
});
