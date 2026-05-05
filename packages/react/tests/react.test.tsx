import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { HyperFluxProvider, useRule, useRuleStream } from "../src/index";
import {
  Resolver,
  RequestContext,
  FunctionRegistry,
  OperatorRegistryImpl,
} from "@hyperflux/core";
import { RuleStoreImpl, DependencyGraphImpl } from "../../core/src/rules";
import type { Rule, DomainFile } from "@hyperflux/core";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const opDefs = [
  { op: ">", arity: 2 as const, input_types: ["number", "number"], output_type: "boolean" },
  { op: "==", arity: 2 as const, input_types: ["any", "any"], output_type: "boolean" },
];

function makeResolver(rules: Rule[]): Resolver {
  const deps = new Map(rules.map((r) => [r.path, r.metadata.requires]));
  const graph = new DependencyGraphImpl(deps, rules.map((r) => r.path));
  const store = new RuleStoreImpl(rules, [] as DomainFile[], graph);
  return new Resolver({
    ruleStore: store,
    functionRegistry: new FunctionRegistry(),
    operatorRegistry: new OperatorRegistryImpl(opDefs),
  });
}

const submitLabelRule: Rule = {
  path: "ui.labels.submit",
  kind: "config",
  inputs: [],
  output: { type: "string" },
  cases: [{ then: { kind: "literal", value: "Submit" } }],
  metadata: { version: "1", requires: [], domain: "ui" },
};

const atmFeeRule: Rule = {
  path: "pricing.atm.fee",
  kind: "compute",
  inputs: [{ name: "amount", type: { type: "number" } }],
  output: { type: "number" },
  cases: [
    {
      when: {
        kind: "op", op: ">",
        args: [{ kind: "input", path: ["amount"] }, { kind: "literal", value: 1000 }],
      },
      then: { kind: "literal", value: 0 },
    },
    { then: { kind: "literal", value: 2.5 } },
  ],
  metadata: { version: "1", requires: [], domain: "pricing" },
};

// ---------------------------------------------------------------------------
// HyperFluxProvider
// ---------------------------------------------------------------------------

describe("HyperFluxProvider", () => {
  it("renders children", () => {
    const resolver = makeResolver([submitLabelRule]);
    render(
      <HyperFluxProvider resolver={resolver}>
        <span data-testid="child">hello</span>
      </HyperFluxProvider>
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// useRule
// ---------------------------------------------------------------------------

describe("useRule", () => {
  it("evaluates a config rule", () => {
    const resolver = makeResolver([submitLabelRule]);

    function Comp() {
      const label = useRule<string>("ui.labels.submit", {});
      return <span data-testid="label">{label}</span>;
    }

    render(
      <HyperFluxProvider resolver={resolver}>
        <Comp />
      </HyperFluxProvider>
    );

    expect(screen.getByTestId("label").textContent).toBe("Submit");
  });

  it("evaluates a compute rule with inputs", () => {
    const resolver = makeResolver([atmFeeRule]);

    function Comp({ amount }: { amount: number }) {
      const fee = useRule<number>("pricing.atm.fee", { amount });
      return <span data-testid="fee">{fee}</span>;
    }

    const { rerender } = render(
      <HyperFluxProvider resolver={resolver}>
        <Comp amount={500} />
      </HyperFluxProvider>
    );
    expect(screen.getByTestId("fee").textContent).toBe("2.5");

    rerender(
      <HyperFluxProvider resolver={resolver}>
        <Comp amount={1500} />
      </HyperFluxProvider>
    );
    expect(screen.getByTestId("fee").textContent).toBe("0");
  });

  it("skips re-evaluation when inputs have same canonical value", () => {
    const resolver = makeResolver([atmFeeRule]);
    let evalCount = 0;
    const originalEvaluate = resolver.evaluate.bind(resolver);
    resolver.evaluate = (...args) => {
      evalCount++;
      return originalEvaluate(...args);
    };

    function Comp({ obj }: { obj: Record<string, unknown> }) {
      return <span>{String(useRule("pricing.atm.fee", obj))}</span>;
    }

    const { rerender } = render(
      <HyperFluxProvider resolver={resolver}>
        <Comp obj={{ amount: 500 }} />
      </HyperFluxProvider>
    );
    const before = evalCount;

    // New object reference, same values — should not re-evaluate
    rerender(
      <HyperFluxProvider resolver={resolver}>
        <Comp obj={{ amount: 500 }} />
      </HyperFluxProvider>
    );
    expect(evalCount).toBe(before);
  });

  it("throws when used outside provider", () => {
    function BadComp() {
      useRule("ui.labels.submit", {});
      return null;
    }
    expect(() => render(<BadComp />)).toThrow("HyperFluxProvider");
  });
});

// ---------------------------------------------------------------------------
// useRuleStream
// ---------------------------------------------------------------------------

describe("useRuleStream", () => {
  it("returns value with loading: false and error: undefined on success", () => {
    const resolver = makeResolver([submitLabelRule]);

    function Comp() {
      const { value, loading, error } = useRuleStream<string>("ui.labels.submit", {});
      return (
        <span
          data-testid="result"
          data-loading={String(loading)}
          data-error={String(error)}
        >
          {value}
        </span>
      );
    }

    render(
      <HyperFluxProvider resolver={resolver}>
        <Comp />
      </HyperFluxProvider>
    );

    const el = screen.getByTestId("result");
    expect(el.textContent).toBe("Submit");
    expect(el.getAttribute("data-loading")).toBe("false");
    expect(el.getAttribute("data-error")).toBe("undefined");
  });

  it("returns error when rule throws", () => {
    const resolver = makeResolver([]);

    function Comp() {
      const { value, error } = useRuleStream<string>("missing.rule", {});
      return (
        <span data-testid="result" data-has-error={String(!!error)}>
          {value ?? "none"}
        </span>
      );
    }

    render(
      <HyperFluxProvider resolver={resolver}>
        <Comp />
      </HyperFluxProvider>
    );

    const el = screen.getByTestId("result");
    expect(el.getAttribute("data-has-error")).toBe("true");
    expect(el.textContent).toBe("none");
  });

  it("throws when used outside provider", () => {
    function BadComp() {
      useRuleStream("ui.labels.submit", {});
      return null;
    }
    expect(() => render(<BadComp />)).toThrow("HyperFluxProvider");
  });
});
