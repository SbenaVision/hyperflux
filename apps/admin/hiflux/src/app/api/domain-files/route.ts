import { NextResponse } from "next/server";
import { ruleStore } from "../../../lib/init-store";

export async function GET() {
  const rules = ruleStore.getAll();
  // Group rules back into domain-file shaped objects by the first path segment
  const byDomain = new Map<string, typeof rules>();
  for (const rule of rules) {
    const domain = rule.path.split(".")[0];
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(rule);
  }
  const domainFiles = Array.from(byDomain.entries()).map(([domain, domainRules]) => ({
    domain,
    version: "1",
    rules: domainRules.map((r) => ({
      path: r.path,
      kind: r.kind,
      inputs: r.inputs,
      output: r.output,
      cases: r.cases,
      metadata: r.metadata,
    })),
  }));
  return NextResponse.json(domainFiles);
}
