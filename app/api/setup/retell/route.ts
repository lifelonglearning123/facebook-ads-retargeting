import { NextResponse } from "next/server";
import { configureRetellAgent } from "@/lib/retell/setup";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  try {
    const result = await configureRetellAgent();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
