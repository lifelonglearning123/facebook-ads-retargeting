import { NextResponse } from "next/server";
import { GhlStopPayloadSchema } from "@/lib/ghl/webhook";
import { markStopped, recordAttempt } from "@/lib/state";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = GhlStopPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  await markStopped(p.contact_id, p.reason ?? "ghl_workflow");
  await recordAttempt(p.contact_id, {
    channel: "voice",
    outcome: `stopped:${p.reason ?? "ghl_workflow"}`,
  });

  return NextResponse.json({ ok: true, contact_id: p.contact_id, stopped: true });
}
