import { NextResponse } from "next/server";
import { ruleStore } from "../../../../lib/init-store";
import { createLifecycleEngine } from "../../../../lib/lifecycle-engine";
import { readConfigString } from "../../../../lib/server-resolver";
import { UnknownLifecycleAddressError } from "@hyperflux/core";
import manifestJson from "../../../../../lifecycle/manifest.json";
import type { LifecycleManifest } from "@hyperflux/core";

const VALID_STAGES = new Set(["before", "during", "after"]);

function buildInputs(
  address: string,
  stage: string,
  path: string,
  dependentsCount: number
): Record<string, unknown> {
  if (address === "rules.hiflux.delete") {
    if (stage === "before") return { dependents_count: dependentsCount };
    if (stage === "after")  return { path };
  }
  return {};
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const stage   = searchParams.get("stage");
  const path    = searchParams.get("path");

  if (!address || !stage || !path) {
    return NextResponse.json(
      { error: readConfigString("hiflux.messages.api_params_required", "address, stage, and path are required") },
      { status: 400 }
    );
  }
  if (!VALID_STAGES.has(stage)) {
    return NextResponse.json({ error: readConfigString("hiflux.messages.api_invalid_stage", "stage must be before, during, or after") }, { status: 400 });
  }
  const manifest = manifestJson as unknown as LifecycleManifest;
  if (!(address in manifest.addresses)) {
    return NextResponse.json({ error: `Unknown lifecycle address: ${address}` }, { status: 404 });
  }

  const dependentsCount = ruleStore.getDependents(path).length;
  const inputs = buildInputs(address, stage, path, dependentsCount);

  try {
    const engine = createLifecycleEngine();
    const result = engine.explain(address, stage as "before" | "during" | "after", inputs);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnknownLifecycleAddressError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
