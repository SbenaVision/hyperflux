/**
 * Boot smoke test — validates that every no-input rule in the HiFlux store
 * can be evaluated end-to-end without throwing.
 *
 * This is check 7 of hf:data-validate. It catches expression bugs (unknown
 * operators, bad literal types, broken rule references) that static JSON
 * validation cannot detect.
 */
import { describe, it, expect, beforeAll } from "vitest";

// Importing init-store populates the singleton ruleStore as a side effect
import "../init-store";
import { ruleStore } from "../ruleStore";
import { buildServerResolver } from "../server-resolver";

describe("HiFlux boot smoke test", () => {
  let resolver: ReturnType<typeof buildServerResolver>;
  let noInputRules: Array<{ path: string }>;

  beforeAll(() => {
    resolver = buildServerResolver();
    noInputRules = ruleStore.getAll().filter((r) => r.inputs.length === 0);
  });

  it("store has rules loaded", () => {
    expect(ruleStore.getAll().length).toBeGreaterThan(0);
  });

  it("all no-input rules evaluate without throwing", () => {
    const failures: string[] = [];

    for (const rule of noInputRules) {
      try {
        resolver.evaluate(rule.path, {});
      } catch (e) {
        failures.push(`${rule.path}: ${(e as Error).message}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} rule(s) threw during evaluation:\n${failures.join("\n")}`
      );
    }
  });
});
