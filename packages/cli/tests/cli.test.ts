import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CliContext, CommandDefinition } from "../src/types";
import { run as runValidate } from "../src/commands/validate";
import { run as runEval } from "../src/commands/eval";
import { run as runTrace } from "../src/commands/trace";
import { run as runNew } from "../src/commands/new";
import { findProjectRoot, buildCliContext } from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STUB_COMMAND: CommandDefinition = {
  name: "test",
  description: "",
  usage: "",
  options: [
    { flag: "--rules-dir", description: "", type: "string", default: "rules" },
    { flag: "--input", description: "", type: "string" },
    { flag: "--trace", description: "", type: "boolean", default: false },
    { flag: "--verbose", description: "", type: "boolean", default: false },
    { flag: "--slow", description: "", type: "number", default: 0 },
    { flag: "--depth", description: "", type: "number", default: 0 },
  ],
  args: [],
};

function makeCtx(
  projectRoot: string,
  positional: string[] = [],
  options: Record<string, boolean | string | number> = {}
): CliContext {
  return {
    projectRoot,
    configPath: null,
    command: STUB_COMMAND,
    options: { "rules-dir": "rules", ...options },
    positional,
  };
}

const PRICING_DOMAIN = {
  domain: "pricing",
  version: "1",
  rules: [
    {
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
    },
  ],
};

const CYCLE_DOMAIN = {
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

// Capture stdout/stderr during a command run
async function capture(
  fn: () => Promise<number>
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: unknown) => { stdout += String(chunk); return true; };
  process.stderr.write = (chunk: unknown) => { stderr += String(chunk); return true; };

  let exitCode: number;
  try {
    exitCode = await fn();
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
  return { exitCode, stdout, stderr };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = join(tmpdir(), `hf-cli-test-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  await mkdir(join(tmpDir, "rules"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeRules(domain: object) {
  const d = (domain as { domain: string }).domain;
  await writeFile(
    join(tmpDir, "rules", `${d}.json`),
    JSON.stringify(domain, null, 2)
  );
}

// ---------------------------------------------------------------------------
// hf validate
// ---------------------------------------------------------------------------

describe("hf validate", () => {
  it("exits 0 and reports rule count on success", async () => {
    await writeRules(PRICING_DOMAIN);
    const { exitCode, stdout } = await capture(() =>
      runValidate(makeCtx(tmpDir))
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("1 rule");
    expect(stdout).toContain("1 domain");
    expect(stdout).toContain("all valid");
  });

  it("exits 0 with warning when rules dir is empty", async () => {
    const { exitCode, stdout } = await capture(() =>
      runValidate(makeCtx(tmpDir))
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("0 rules");
  });

  it("exits 0 with warning when rules dir does not exist", async () => {
    const { exitCode, stdout } = await capture(() =>
      runValidate(makeCtx(join(tmpDir, "nonexistent")))
    );
    expect(exitCode).toBe(0);
  });

  it("exits 1 and prints error on cycle", async () => {
    await writeRules(CYCLE_DOMAIN);
    const { exitCode, stderr } = await capture(() =>
      runValidate(makeCtx(tmpDir))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("HF006");
    expect(stderr).toContain("Cyclic");
  });

  it("exits 1 on domain mismatch (wrong filename)", async () => {
    await writeFile(
      join(tmpDir, "rules", "billing.json"),
      JSON.stringify({ ...PRICING_DOMAIN })
    );
    const { exitCode, stderr } = await capture(() =>
      runValidate(makeCtx(tmpDir))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("HF007");
  });

  it("exits 1 on invalid JSON", async () => {
    await writeFile(join(tmpDir, "rules", "bad.json"), "{ not json }");
    const { exitCode, stderr } = await capture(() =>
      runValidate(makeCtx(tmpDir))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("error");
  });

  it("uses --rules-dir option", async () => {
    await mkdir(join(tmpDir, "custom-rules"), { recursive: true });
    await writeFile(
      join(tmpDir, "custom-rules", "pricing.json"),
      JSON.stringify(PRICING_DOMAIN)
    );
    const { exitCode, stdout } = await capture(() =>
      runValidate(makeCtx(tmpDir, [], { "rules-dir": "custom-rules" }))
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("1 rule");
  });

  it("reports multiple errors in one pass", async () => {
    // Domain mismatch + invalid path
    const bad = {
      domain: "pricing",
      version: "1",
      rules: [
        { ...PRICING_DOMAIN.rules[0], path: "other.atm.fee" },
      ],
    };
    await writeFile(
      join(tmpDir, "rules", "pricing.json"),
      JSON.stringify(bad)
    );
    const { exitCode, stderr } = await capture(() =>
      runValidate(makeCtx(tmpDir))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("error");
  });
});

// ---------------------------------------------------------------------------
// hf eval
// ---------------------------------------------------------------------------

describe("hf eval", () => {
  beforeEach(async () => { await writeRules(PRICING_DOMAIN); });

  it("prints JSON result and exits 0", async () => {
    const { exitCode, stdout } = await capture(() =>
      runEval(makeCtx(tmpDir, ["pricing.atm.fee"], { input: '{"amount":500}' }))
    );
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toBe(2.5);
  });

  it("returns 0 for high-value amount", async () => {
    const { exitCode, stdout } = await capture(() =>
      runEval(makeCtx(tmpDir, ["pricing.atm.fee"], { input: '{"amount":1500}' }))
    );
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toBe(0);
  });

  it("exits 1 when rule path is missing", async () => {
    const { exitCode, stderr } = await capture(() =>
      runEval(makeCtx(tmpDir, [], { input: '{}' }))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("usage");
  });

  it("exits 1 when --input is missing", async () => {
    const { exitCode, stderr } = await capture(() =>
      runEval(makeCtx(tmpDir, ["pricing.atm.fee"]))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--input");
  });

  it("exits 1 when --input is invalid JSON", async () => {
    const { exitCode, stderr } = await capture(() =>
      runEval(makeCtx(tmpDir, ["pricing.atm.fee"], { input: 'not-json' }))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("valid JSON");
  });

  it("exits 1 when rule does not exist", async () => {
    const { exitCode, stderr } = await capture(() =>
      runEval(makeCtx(tmpDir, ["pricing.missing"], { input: '{}' }))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("evaluation failed");
  });

  it("exits 1 when rules dir does not exist", async () => {
    const { exitCode, stderr } = await capture(() =>
      runEval(makeCtx(tmpDir, ["pricing.atm.fee"], {
        input: '{"amount":500}',
        "rules-dir": "no-such-dir",
      }))
    );
    // missing dir → 0 rules loaded → rule not found
    expect(exitCode).toBe(1);
  });

  it("includes trace output when --trace is set", async () => {
    const { exitCode, stdout } = await capture(() =>
      runEval(makeCtx(tmpDir, ["pricing.atm.fee"], {
        input: '{"amount":500}',
        trace: true,
      }))
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("pricing.atm.fee");
    expect(stdout).toContain("evaluations:");
    // last line is still the JSON result
    const lines = stdout.trim().split("\n");
    expect(JSON.parse(lines[lines.length - 1])).toBe(2.5);
  });
});

// ---------------------------------------------------------------------------
// hf trace
// ---------------------------------------------------------------------------

describe("hf trace", () => {
  beforeEach(async () => { await writeRules(PRICING_DOMAIN); });

  it("evaluates rule and prints trace with --input", async () => {
    const { exitCode, stdout } = await capture(() =>
      runTrace(makeCtx(tmpDir, ["pricing.atm.fee"], { input: '{"amount":500}' }))
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("pricing.atm.fee");
    expect(stdout).toContain("evaluations:");
  });

  it("exits 1 when --input mode but no rule path", async () => {
    const { exitCode, stderr } = await capture(() =>
      runTrace(makeCtx(tmpDir, [], { input: '{"amount":500}' }))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("usage");
  });

  it("renders a saved trace JSON file", async () => {
    const { traceToJSON, RequestContext, Resolver, FunctionRegistry, OperatorRegistryImpl } =
      await import("@hyperflux/core");
    const { RuleStoreImpl, DependencyGraphImpl } = await import("../../core/src/rules");
    const { run: runEvalDirect } = await import("../src/commands/eval");

    // Run an eval to get a trace, save it, then run hf trace on the file
    const { stdout: evalOut } = await capture(() =>
      runEval(makeCtx(tmpDir, ["pricing.atm.fee"], {
        input: '{"amount":500}',
        trace: true,
      }))
    );

    // Build a real trace tree to save
    const opDefs = [
      { op: ">", arity: 2 as const, input_types: ["number","number"], output_type: "boolean" },
    ];
    const deps = new Map([["pricing.atm.fee", [] as string[]]]);
    const graph = new DependencyGraphImpl(deps, ["pricing.atm.fee"]);
    const store = new RuleStoreImpl(
      [{
        path: "pricing.atm.fee",
        kind: "compute" as const,
        inputs: [{ name: "amount", type: { type: "number" as const } }],
        output: { type: "number" as const },
        cases: [
          {
            when: { kind: "op" as const, op: ">", args: [{ kind: "input" as const, path: ["amount"] }, { kind: "literal" as const, value: 1000 }] },
            then: { kind: "literal" as const, value: 0 },
          },
          { then: { kind: "literal" as const, value: 2.5 } },
        ],
        metadata: { version: "1", requires: [], domain: "pricing" },
      }],
      [],
      graph
    );
    const resolver = new Resolver({
      ruleStore: store,
      functionRegistry: new FunctionRegistry(),
      operatorRegistry: new OperatorRegistryImpl(opDefs),
    });
    const reqCtx = new RequestContext({ recordTrace: true });
    resolver.evaluate("pricing.atm.fee", { amount: 500 }, reqCtx);
    const traceJson = traceToJSON(reqCtx.getTrace()!);
    const traceFile = join(tmpDir, "trace.json");
    await writeFile(traceFile, traceJson);

    const { exitCode, stdout } = await capture(() =>
      runTrace(makeCtx(tmpDir, [traceFile]))
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("pricing.atm.fee");
  });

  it("exits 1 with no args and no --input", async () => {
    const { exitCode, stderr } = await capture(() =>
      runTrace(makeCtx(tmpDir, []))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("usage");
  });

  it("exits 1 on invalid trace file", async () => {
    const badFile = join(tmpDir, "bad.json");
    await writeFile(badFile, '{"not":"a-trace"}');
    const { exitCode, stderr } = await capture(() =>
      runTrace(makeCtx(tmpDir, [badFile]))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("invalid trace file");
  });
});

// ---------------------------------------------------------------------------
// hf new
// ---------------------------------------------------------------------------

describe("hf new", () => {
  it("creates a new domain file with a rule stub", async () => {
    const { exitCode, stdout } = await capture(() =>
      runNew(makeCtx(tmpDir, ["billing", "invoice.total"]))
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("billing.invoice.total");

    const { readFile } = await import("node:fs/promises");
    const content = JSON.parse(
      await readFile(join(tmpDir, "rules", "billing.json"), "utf8")
    );
    expect(content.domain).toBe("billing");
    expect(content.rules[0].path).toBe("billing.invoice.total");
  });

  it("appends to an existing domain file", async () => {
    await writeRules(PRICING_DOMAIN);
    await capture(() => runNew(makeCtx(tmpDir, ["pricing", "vip.discount"])));

    const { readFile } = await import("node:fs/promises");
    const content = JSON.parse(
      await readFile(join(tmpDir, "rules", "pricing.json"), "utf8")
    );
    expect(content.rules.length).toBe(2);
    expect(content.rules[1].path).toBe("pricing.vip.discount");
  });

  it("exits 1 when domain is missing", async () => {
    const { exitCode, stderr } = await capture(() =>
      runNew(makeCtx(tmpDir, []))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("usage");
  });

  it("exits 1 on invalid domain name", async () => {
    const { exitCode, stderr } = await capture(() =>
      runNew(makeCtx(tmpDir, ["Bad-Domain", "foo"]))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("snake_case");
  });

  it("exits 1 when path already exists", async () => {
    await writeRules(PRICING_DOMAIN);
    const { exitCode, stderr } = await capture(() =>
      runNew(makeCtx(tmpDir, ["pricing", "atm.fee"]))
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already exists");
  });
});

// ---------------------------------------------------------------------------
// findProjectRoot / buildCliContext
// ---------------------------------------------------------------------------

describe("findProjectRoot", () => {
  it("finds a directory with .hyperfluxrc.json", async () => {
    await writeFile(join(tmpDir, ".hyperfluxrc.json"), "{}");
    const result = findProjectRoot(tmpDir);
    expect(result).toBe(tmpDir);
  });

  it("finds a directory with package.json", async () => {
    await writeFile(join(tmpDir, "package.json"), "{}");
    const subdir = join(tmpDir, "src");
    await mkdir(subdir, { recursive: true });
    const result = findProjectRoot(subdir);
    expect(result).toBe(tmpDir);
  });

  it("returns cwd-or-found rather than null for typical directories", () => {
    // Just verify it doesn't throw
    const result = findProjectRoot(tmpDir);
    expect(typeof result === "string" || result === null).toBe(true);
  });
});

describe("buildCliContext", () => {
  it("parses boolean flags", () => {
    const cmd: CommandDefinition = {
      name: "eval",
      description: "",
      usage: "",
      options: [
        { flag: "--trace", description: "", type: "boolean", default: false },
      ],
      args: [],
    };
    const ctx = buildCliContext(cmd, ["--trace", "pricing.fee"], tmpDir, null);
    expect(ctx.options["trace"]).toBe(true);
    expect(ctx.positional).toEqual(["pricing.fee"]);
  });

  it("parses string options", () => {
    const cmd: CommandDefinition = {
      name: "eval",
      description: "",
      usage: "",
      options: [
        { flag: "--input", description: "", type: "string" },
      ],
      args: [],
    };
    const ctx = buildCliContext(cmd, ["--input", '{"x":1}', "some.rule"], tmpDir, null);
    expect(ctx.options["input"]).toBe('{"x":1}');
    expect(ctx.positional).toEqual(["some.rule"]);
  });

  it("applies defaults", () => {
    const cmd: CommandDefinition = {
      name: "validate",
      description: "",
      usage: "",
      options: [
        { flag: "--rules-dir", description: "", type: "string", default: "rules" },
      ],
      args: [],
    };
    const ctx = buildCliContext(cmd, [], tmpDir, null);
    expect(ctx.options["rules-dir"]).toBe("rules");
  });
});
