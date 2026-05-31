import { NextResponse } from "next/server";
import { resolveByStopToken } from "@/lib/tenant/resolve";
import { GhlStopPayloadSchema } from "@/lib/ghl/webhook";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;

  const found = await resolveByStopToken(token);
  if (!found) {
    return NextResponse.json({ ok: false, error: "campaign_not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = GhlStopPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  const db = supabaseAdmin();

  const { data: lead } = await db
    .from("leads")
    .select("id")
    .eq("campaign_id", found.id)
    .eq("ghl_contact_id", p.contact_id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ ok: true, cancelled: 0, note: "lead_not_found" });
  }

  const [calls, msgs] = await Promise.all([
    db.from("scheduled_calls").update({ status: "cancelled" }).eq("lead_id", lead.id).eq("status", "queued").select("id"),
    db.from("scheduled_messages").update({ status: "cancelled" }).eq("lead_id", lead.id).eq("status", "queued").select("id"),
  ]);

  await db.from("leads").update({ status: "stopped", last_outcome: `stop:${p.reason ?? "ghl"}` }).eq("id", lead.id);

  const cancelled = (calls.data?.length ?? 0) + (msgs.data?.length ?? 0);

  return NextResponse.json({ ok: true, lead_id: lead.id, cancelled });
}
