// hf:allow-hardcoded reason="read-only batch eval endpoint — no state mutation, lifecycle guards not applicable"
import { NextResponse } from "next/server";
import { buildServerResolver, readConfigString } from "../../../../lib/server-resolver";
import { RequestContext } from "@hyperflux/core";
import "../../../../lib/init-store";

interface BatchSpec {
  path: string;
  inputs: Record<string, unknown>;
}

export async function POST(request: Request) {
  const body = await request.json() as { specs?: BatchSpec[] };
  if (!Array.isArray(body.specs)) {
    return NextResponse.json({ error: readConfigString("hiflux.messages.api_specs_required", "specs array required") }, { status: 400 });
  }

  const resolver = buildServerResolver();
  const ctx = new RequestContext();
  const results: unknown[] = [];

  for (const spec of body.specs) {
    try {
      results.push(resolver.evaluate(spec.path, spec.inputs ?? {}, ctx));
    } catch {
      results.push(null);
    }
  }

  return NextResponse.json({ results });
}
