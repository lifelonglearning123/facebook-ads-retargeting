import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export const runtime = "nodejs";

const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "OPT-OUT"];

/**
 * Inbound SMS webhook. Twilio form-encodes the payload. We detect STOP-like
 * keywords and cancel queued retries for the matching lead.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const from = String(form.get("From") ?? "");
  const bodyRaw = String(form.get("Body") ?? "").trim().toUpperCase();
  if (!from) return new NextResponse(emptyTwiml(), { headers: { "Content-Type": "text/xml" } });

  const phone = parsePhoneNumberFromString(from);
  if (!phone?.isValid()) return new NextResponse(emptyTwiml(), { headers: { "Content-Type": "text/xml" } });
  const e164 = phone.number;

  const db = supabaseAdmin();

  const { data: leads } = await db
    .from("leads")
    .select("id, agency_id, campaign_id")
    .eq("phone_e164", e164)
    .in("status", ["queued", "in_progress"]);

  if (!leads || leads.length === 0) {
    return new NextResponse(emptyTwiml(), { headers: { "Content-Type": "text/xml" } });
  }

  const isStop = STOP_KEYWORDS.some((kw) => bodyRaw.split(/\s+/).includes(kw));

  for (const lead of leads) {
    await db.from("message_attempts").insert({
      agency_id: lead.agency_id,
      lead_id: lead.id,
      channel: "sms",
      outcome: isStop ? "unsubscribed" : "replied",
      body_snapshot: String(form.get("Body") ?? ""),
    });

    await db.from("digest_events").insert({
      agency_id: lead.agency_id,
      lead_id: lead.id,
      type: isStop ? "sms.unsubscribed" : "sms.replied",
      payload: { body: String(form.get("Body") ?? "") },
    });

    if (isStop) {
      await db.from("scheduled_calls").update({ status: "cancelled" }).eq("lead_id", lead.id).eq("status", "queued");
      await db.from("scheduled_messages").update({ status: "cancelled" }).eq("lead_id", lead.id).eq("status", "queued");
      await db.from("leads").update({ status: "stopped", last_outcome: "sms_stop", sms_consent: false }).eq("id", lead.id);
    } else {
      // Treat replies as engagement — cancel further retries.
      await db.from("scheduled_calls").update({ status: "cancelled" }).eq("lead_id", lead.id).eq("status", "queued");
      await db.from("scheduled_messages").update({ status: "cancelled" }).eq("lead_id", lead.id).eq("status", "queued");
      await db.from("leads").update({ status: "engaged", last_outcome: "sms_reply" }).eq("id", lead.id);
    }
  }

  return new NextResponse(emptyTwiml(), { headers: { "Content-Type": "text/xml" } });
}

function emptyTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`;
}
