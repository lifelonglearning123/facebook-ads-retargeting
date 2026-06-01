import { NextResponse } from "next/server";
import { listPipelines } from "@/lib/ghl/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pipelines = await listPipelines();
    return NextResponse.json({ ok: true, pipelines });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
