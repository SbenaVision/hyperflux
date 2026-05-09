import { NextResponse } from "next/server";
import { buildServerResolver } from "../../../../lib/server-resolver";
import { prefetchRules } from "@hyperflux/core";
import "../../../../lib/init-store";

/**
 * GET /api/rules/hydrate?paths=a,b,c
 *
 * Evaluates a comma-separated list of zero-input rule paths server-side
 * and returns a PrefetchedRules map (keyed by buildCacheKey) suitable for
 * passing to HyperFluxProvider as initialValues.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("paths") ?? "";
  const paths = raw.split(",").map((p) => p.trim()).filter(Boolean);

  if (paths.length === 0) {
    return NextResponse.json({});
  }

  const resolver = buildServerResolver();
  const specs = paths.map((path) => ({ path, inputs: {} }));
  const values = prefetchRules(resolver, specs);

  return NextResponse.json(values);
}
