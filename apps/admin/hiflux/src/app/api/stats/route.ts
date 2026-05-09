import { NextResponse } from "next/server";
import { getEditCount } from "../../../lib/statsStore";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ editCount: getEditCount() });
}
