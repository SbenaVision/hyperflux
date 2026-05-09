import { NextResponse } from "next/server";
import { ruleStore, ensureOverridesLoaded } from "../../../lib/init-store";
import { toDetail } from "../../../lib/viewmodel";
import { createLifecycleEngine } from "../../../lib/lifecycle-engine";
import { persistRule, deletePersistedRule } from "../../../lib/overridePersistence";
import { readConfigString } from "../../../lib/server-resolver";
import { incrementEditCount } from "../../../lib/statsStore";
import { LifecycleBlockedError } from "@hyperflux/core";

export async function GET(request: Request) {
  await ensureOverridesLoaded();
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: readConfigString("hiflux.messages.api_path_required", "path param required") }, { status: 400 });

  const rule = ruleStore.get(path);
  if (!rule) return NextResponse.json({ error: readConfigString("hiflux.messages.api_not_found", "Not found") }, { status: 404 });

  const dependents = ruleStore.getDependents(path);
  return NextResponse.json(toDetail(rule, dependents));
}

export async function PUT(request: Request) {
  await ensureOverridesLoaded();
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: readConfigString("hiflux.messages.api_path_required", "path param required") }, { status: 400 });

  const existing = ruleStore.get(path);
  if (!existing) return NextResponse.json({ error: readConfigString("hiflux.messages.api_not_found", "Not found") }, { status: 404 });

  const body = await request.json() as Partial<typeof existing>;
  const editAddress = readConfigString("hiflux.config.lifecycle_address_edit", "rules.hiflux.edit");
  const engine = createLifecycleEngine();

  try {
    await engine.run(editAddress, "before", { path });
  } catch (err) {
    if (err instanceof LifecycleBlockedError) {
      return NextResponse.json({ error: err.reason }, { status: 422 });
    }
    throw err;
  }

  ruleStore.write({ ...existing, ...body, path, source: "hiflux" });
  await engine.run(editAddress, "after", { path });

  const saved = ruleStore.get(path)!;
  await persistRule(saved);
  incrementEditCount();

  return NextResponse.json(saved);
}

export async function DELETE(request: Request) {
  await ensureOverridesLoaded();
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: readConfigString("hiflux.messages.api_path_required", "path param required") }, { status: 400 });

  if (!ruleStore.get(path)) return NextResponse.json({ error: readConfigString("hiflux.messages.api_not_found", "Not found") }, { status: 404 });

  const deleteAddress = readConfigString("hiflux.config.lifecycle_address_delete", "rules.hiflux.delete");
  const engine = createLifecycleEngine();
  const dependents = ruleStore.getDependents(path);

  try {
    await engine.run(deleteAddress, "before", { dependents_count: dependents.length });
  } catch (err) {
    if (err instanceof LifecycleBlockedError) {
      return NextResponse.json({ error: err.reason, dependents }, { status: 409 });
    }
    throw err;
  }

  ruleStore.remove(path);
  await engine.run(deleteAddress, "after", { path });
  await deletePersistedRule(path);
  incrementEditCount();

  return NextResponse.json({ deleted: path });
}
