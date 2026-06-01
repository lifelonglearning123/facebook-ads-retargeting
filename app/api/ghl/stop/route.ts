import { NextResponse } from "next/server";
import { GhlStopPayloadSchema } from "@/lib/ghl/webhook";
import { markStopped, recordAttempt } from "@/lib/state";
import { getCampaign } from "@/lib/runtime-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = GhlStopPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  // If the payload carries a stage_id, this came from the generic "stage
  // changed" workflow — only stop when the stage is on the agency's list.
  if (p.stage_id) {
    const campaign = await getCampaign();
    if (!campaign.stopStageIds.includes(p.stage_id)) {
      return NextResponse.json({
        ok: true,
        contact_id: p.contact_id,
        stopped: false,
        reason: "stage_not_in_stop_list",
      });
    }
  }

  const reason = p.reason
    ?? (p.pipeline_name && p.stage_name ? `pipeline:${p.pipeline_name} → ${p.stage_name}` : null)
    ?? (p.stage_id ? `stage:${p.stage_id}` : "ghl_workflow");

  await markStopped(p.contact_id, reason);
  await recordAttempt(p.contact_id, {
    channel: "voice",
    outcome: `stopped:${reason}`,
  });

  return NextResponse.json({ ok: true, contact_id: p.contact_id, stopped: true, reason });
}
