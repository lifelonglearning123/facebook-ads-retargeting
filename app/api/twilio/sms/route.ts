import { NextResponse } from "next/server";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { searchByTag, type GhlContact } from "@/lib/ghl/client";
import { leadStateFromContact, markEngaged, markStopped, recordAttempt, writeLeadState } from "@/lib/state";
import { APP } from "@/config";

export const runtime = "nodejs";

const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "OPT-OUT"];

/**
 * Twilio inbound SMS webhook. Matches the sender phone against active leads
 * (tag = ai-active) and reacts: STOP keywords → stopped + no further sends;
 * any other reply → engaged + cancels remaining cadence.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const from = String(form.get("From") ?? "");
  const rawBody = String(form.get("Body") ?? "");
  if (!from) return new NextResponse(emptyTwiml(), { headers: { "Content-Type": "text/xml" } });

  const phone = parsePhoneNumberFromString(from);
  if (!phone?.isValid()) return new NextResponse(emptyTwiml(), { headers: { "Content-Type": "text/xml" } });
  const e164 = phone.number;

  const isStop = STOP_KEYWORDS.some((kw) => rawBody.trim().toUpperCase().split(/\s+/).includes(kw));

  // Find the matching active contact by phone
  const actives: GhlContact[] = await searchByTag({ tag: APP.ghl.activeTag, pageLimit: 100 });
  const matches = actives.filter((c) => {
    const p = c.phone ? parsePhoneNumberFromString(c.phone) : null;
    return p?.isValid() && p.number === e164;
  });

  for (const c of matches) {
    const lead = leadStateFromContact(c);
    await recordAttempt(lead.contactId, {
      channel: "sms",
      outcome: isStop ? "received_stop" : "received_reply",
      bodySnapshot: rawBody,
    });
    if (isStop) {
      await writeLeadState(lead.contactId, { smsConsent: false });
      await markStopped(lead.contactId, "sms_stop");
    } else {
      await markEngaged(lead.contactId, "sms_reply");
    }
  }

  return new NextResponse(emptyTwiml(), { headers: { "Content-Type": "text/xml" } });
}

function emptyTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`;
}
