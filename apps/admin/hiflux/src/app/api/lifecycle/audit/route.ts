import { NextResponse } from "next/server";
import { getAuditLog } from "../../../../lib/lifecycle-engine";

export async function GET() {
  return NextResponse.json(getAuditLog());
}
