import { NextResponse } from "next/server";
import { saveRuntimeOverride } from "@/lib/runtime-config";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const result = await saveRuntimeOverride(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
