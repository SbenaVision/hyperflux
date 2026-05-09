import { NextResponse } from "next/server";
import { ruleStore, ensureOverridesLoaded } from "../../../../lib/init-store";
import { createLifecycleEngine } from "../../../../lib/lifecycle-engine";
import { deletePersistedRule } from "../../../../lib/overridePersistence";
import { readConfigString } from "../../../../lib/server-resolver";
import { incrementEditCount } from "../../../../lib/statsStore";
import { LifecycleBlockedError } from "@hyperflux/core";

export async function POST(request: Request) {
  await ensureOverridesLoaded();
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: readConfigString("hiflux.messages.api_path_required", "path param required") }, { status: 400 });

  const rule = ruleStore.get(path);
  if (!rule) return NextResponse.json({ error: readConfigString("hiflux.messages.api_not_found", "Not found") }, { status: 404 });

  const promoteAddress = readConfigString("hiflux.config.lifecycle_address_promote", "rules.hiflux.promote");
  const engine = createLifecycleEngine();

  try {
    await engine.run(promoteAddress, "before", { is_override: rule.isOverride });
  } catch (err) {
    if (err instanceof LifecycleBlockedError) {
      return NextResponse.json({ error: err.reason }, { status: 409 });
    }
    throw err;
  }

  const promoted = ruleStore.promote(path);
  await engine.run(promoteAddress, "after", { path });
  // Promoted rules move into source — remove the override entry from the store
  await deletePersistedRule(path);
  incrementEditCount();

  return NextResponse.json(promoted);
}
