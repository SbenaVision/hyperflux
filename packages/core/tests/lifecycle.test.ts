import { describe, it, expect, vi } from "vitest";
import {
  LifecycleEngine,
  LifecycleBlockedError,
  UnknownLifecycleAddressError,
  Resolver,
  FunctionRegistry,
  OperatorRegistryImpl,
  RuleStoreImpl,
  DependencyGraphImpl,
} from "../src";
import type { LifecycleManifest, Rule, DomainFile } from "../src";

// ---------------------------------------------------------------------------
// Inline rule definitions — mirrors lifecycle/delete.json
// ---------------------------------------------------------------------------

const GUARD_RULE: Rule = {
  path: "hiflux.lifecycle.delete.guard_dependents",
  kind: "compute",
  inputs: [{ name: "dependents_count", type: { type: "number" } }],
  output: {
    type: "object",
    shape: { blocked: { type: "boolean" }, reason: { type: "string" } },
  },
  cases: [
    {
      when: {
        kind: "op",
        op: ">",
        args: [
          { kind: "input", path: ["dependents_count"] },
          { kind: "literal", value: 0 },
        ],
      },
      then: {
        kind: "literal",
        value: {
          blocked: true,
          reason: "Rule has active dependents and cannot be deleted.",
        },
      },
    },
    {
      then: { kind: "literal", value: { blocked: false, reason: "" } },
    },
  ],
  metadata: { version: "1", requires: [], domain: "hiflux" },
};

const AUDIT_RULE: Rule = {
  path: "hiflux.lifecycle.delete.audit",
  kind: "compute",
  inputs: [{ name: "path", type: { type: "string" } }],
  output: {
    type: "object",
    shape: { event: { type: "string" }, severity: { type: "string" } },
  },
  cases: [
    {
      then: {
        kind: "literal",
        value: { event: "rule.deleted", severity: "info" },
      },
    },
  ],
  metadata: { version: "1", requires: [], domain: "hiflux" },
};

const MANIFEST: LifecycleManifest = {
  version: "1",
  namespace: "hiflux",
  addresses: {
    "rules.hiflux.delete": {
      before: {
        externalizable: true,
        rules: ["hiflux.lifecycle.delete.guard_dependents"],
      },
      during: { externalizable: false, rules: [] },
      after: {
        externalizable: true,
        rules: ["hiflux.lifecycle.delete.audit"],
        retry_policy: "none",
      },
    },
  },
};

function buildResolver(): Resolver {
  const rules: Rule[] = [GUARD_RULE, AUDIT_RULE];
  const deps = new Map(rules.map((r) => [r.path, r.metadata.requires]));
  const graph = new DependencyGraphImpl(deps, rules.map((r) => r.path));
  const domainFiles: DomainFile[] = [{ domain: "hiflux", version: "1", rules }];
  const store = new RuleStoreImpl(rules, domainFiles, graph);
  return new Resolver({
    ruleStore: store,
    functionRegistry: new FunctionRegistry(),
    operatorRegistry: new OperatorRegistryImpl([
      { op: ">", arity: 2, input_types: ["number", "number"], output_type: "boolean" },
    ]),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LifecycleEngine — before stage", () => {
  it("does not block when dependents_count is 0", async () => {
    const engine = new LifecycleEngine(MANIFEST, buildResolver());
    await expect(
      engine.run("rules.hiflux.delete", "before", { dependents_count: 0 })
    ).resolves.toBeUndefined();
  });

  it("throws LifecycleBlockedError when dependents_count > 0", async () => {
    const engine = new LifecycleEngine(MANIFEST, buildResolver());
    await expect(
      engine.run("rules.hiflux.delete", "before", { dependents_count: 3 })
    ).rejects.toThrow(LifecycleBlockedError);
  });

  it("blocked error carries address, stage, reason, and blockingRule", async () => {
    const engine = new LifecycleEngine(MANIFEST, buildResolver());
    try {
      await engine.run("rules.hiflux.delete", "before", { dependents_count: 1 });
    } catch (err) {
      expect(err).toBeInstanceOf(LifecycleBlockedError);
      const e = err as LifecycleBlockedError;
      expect(e.address).toBe("rules.hiflux.delete");
      expect(e.stage).toBe("before");
      expect(e.reason).toBe(
        "Rule has active dependents and cannot be deleted."
      );
      expect(e.blockingRule).toBe(
        "hiflux.lifecycle.delete.guard_dependents"
      );
    }
  });
});

describe("LifecycleEngine — during stage", () => {
  it("returns inputs unchanged (protected no-op)", async () => {
    const engine = new LifecycleEngine(MANIFEST, buildResolver());
    const inputs = { path: "hiflux.ui.test" };
    const result = await engine.run("rules.hiflux.delete", "during", inputs);
    expect(result).toBe(inputs);
  });
});

describe("LifecycleEngine — after stage", () => {
  it("evaluates audit rule and returns results array", async () => {
    const engine = new LifecycleEngine(MANIFEST, buildResolver());
    const result = await engine.run("rules.hiflux.delete", "after", {
      path: "hiflux.ui.test",
    });
    expect(result).toEqual([{ event: "rule.deleted", severity: "info" }]);
  });

  it("calls auditWriter with a structured entry", async () => {
    const writer = vi.fn();
    const engine = new LifecycleEngine(MANIFEST, buildResolver(), writer);
    await engine.run("rules.hiflux.delete", "after", {
      path: "hiflux.ui.test",
    });
    expect(writer).toHaveBeenCalledOnce();
    const entry = writer.mock.calls[0][0];
    expect(entry.address).toBe("rules.hiflux.delete");
    expect(entry.stage).toBe("after");
    expect(typeof entry.timestamp).toBe("string");
    expect(typeof entry.durationMs).toBe("number");
  });
});

describe("LifecycleEngine — explain (dry-run)", () => {
  it("returns wouldBlock: true for dependents_count > 0", () => {
    const engine = new LifecycleEngine(MANIFEST, buildResolver());
    const result = engine.explain("rules.hiflux.delete", "before", {
      dependents_count: 2,
    });
    expect(result.wouldBlock).toBe(true);
    expect(result.blockingRule).toBe(
      "hiflux.lifecycle.delete.guard_dependents"
    );
    expect(result.blockReason).toBe(
      "Rule has active dependents and cannot be deleted."
    );
  });

  it("returns wouldBlock: false for dependents_count === 0", () => {
    const engine = new LifecycleEngine(MANIFEST, buildResolver());
    const result = engine.explain("rules.hiflux.delete", "before", {
      dependents_count: 0,
    });
    expect(result.wouldBlock).toBe(false);
    expect(result.blockingRule).toBeUndefined();
  });

  it("returns evaluated rules list", () => {
    const engine = new LifecycleEngine(MANIFEST, buildResolver());
    const result = engine.explain("rules.hiflux.delete", "before", {
      dependents_count: 0,
    });
    expect(result.rulesEvaluated).toHaveLength(1);
    expect(result.rulesEvaluated[0].path).toBe(
      "hiflux.lifecycle.delete.guard_dependents"
    );
  });
});

describe("LifecycleEngine — error cases", () => {
  it("throws UnknownLifecycleAddressError for unregistered address", async () => {
    const engine = new LifecycleEngine(MANIFEST, buildResolver());
    await expect(
      engine.run("rules.hiflux.nonexistent", "before", {})
    ).rejects.toThrow(UnknownLifecycleAddressError);
  });

  it("explain throws UnknownLifecycleAddressError for unregistered address", () => {
    const engine = new LifecycleEngine(MANIFEST, buildResolver());
    expect(() =>
      engine.explain("rules.hiflux.nonexistent", "before", {})
    ).toThrow(UnknownLifecycleAddressError);
  });
});
