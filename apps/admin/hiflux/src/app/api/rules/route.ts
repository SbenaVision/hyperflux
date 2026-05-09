import { NextResponse } from "next/server";
import { ruleStore, ensureOverridesLoaded } from "../../../lib/init-store";
import { toTableRow } from "../../../lib/viewmodel";
import { createLifecycleEngine } from "../../../lib/lifecycle-engine";
import { persistRule } from "../../../lib/overridePersistence";
import { readConfigString, readConfigArray } from "../../../lib/server-resolver";
import { incrementEditCount } from "../../../lib/statsStore";
import { LifecycleBlockedError } from "@hyperflux/core";
import type { TypeSpec, Case } from "@hyperflux/core";

export async function GET() {
  await ensureOverridesLoaded();
  const rules = ruleStore.getAll();
  const contentNs = readConfigArray<string>("hiflux.config.content_namespaces", []);
  const logicNs   = readConfigArray<string>("hiflux.config.logic_namespaces",   []);
  const rows = rules.map((rule) =>
    toTableRow(rule, ruleStore.getDependents(rule.path), contentNs, logicNs)
  );
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  await ensureOverridesLoaded();
  const body = await request.json() as {
    path?: string;
    kind?: string;
    output?: unknown;
    inputs?: unknown[];
    cases?: unknown[];
    status?: string;
  };

  if (!body.path || !body.kind || !body.output || !body.cases) {
    return NextResponse.json({ error: readConfigString("hiflux.messages.api_missing_fields", "Missing required fields: path, kind, output, cases") }, { status: 400 });
  }
  if (ruleStore.get(body.path)) {
    return NextResponse.json({ error: readConfigString("hiflux.messages.api_rule_exists", "Rule path already exists") }, { status: 409 });
  }

  const createAddress   = readConfigString("hiflux.config.lifecycle_address_create", "rules.hiflux.create");
  const defaultStatus   = readConfigString("hiflux.config.default_rule_status", "draft");
  const engine = createLifecycleEngine();

  try {
    await engine.run(createAddress, "before", { path: body.path });
  } catch (err) {
    if (err instanceof LifecycleBlockedError) {
      return NextResponse.json({ error: err.reason }, { status: 422 });
    }
    throw err;
  }

  ruleStore.write({
    path: body.path,
    kind: body.kind as "compute",
    inputs: (body.inputs ?? []) as [],
    output: body.output as TypeSpec,
    cases: body.cases as [Case, ...Case[]],
    metadata: { version: "1", requires: [], domain: "hiflux" },
    source: "hiflux",
    status: (body.status ?? defaultStatus) as "draft" | "active" | "archived",
  });

  await engine.run(createAddress, "after", { path: body.path });

  const saved = ruleStore.get(body.path)!;
  await persistRule(saved);
  incrementEditCount();

  return NextResponse.json(saved, { status: 201 });
}
