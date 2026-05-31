import { DateTime } from "luxon";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/channels/email";

interface AgencyForDigest {
  id: string;
  name: string;
  timezone: string;
  brand_name: string | null;
  brand_logo_url: string | null;
}

/**
 * Build the per-agency digest for the previous 24h and email it.
 * Returns the count of events digested.
 */
export async function sendDailyDigest(agency: AgencyForDigest, recipientEmail: string): Promise<number> {
  const db = supabaseAdmin();

  const since = DateTime.now().setZone(agency.timezone).minus({ hours: 24 }).toUTC().toISO();
  const { data: events } = await db
    .from("digest_events")
    .select("type, lead_id, payload, created_at")
    .eq("agency_id", agency.id)
    .eq("digested", false)
    .gte("created_at", since ?? "");

  if (!events || events.length === 0) return 0;

  const counts: Record<string, number> = {};
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;

  const niceLabels: Record<string, string> = {
    "call.engaged": "Calls answered (engaged)",
    "call.answered": "Calls answered (brief)",
    "call.no_answer": "Calls missed",
    "call.voicemail": "Voicemails left",
    "call.busy": "Busy lines",
    "call.failed": "Call failures",
    "sms.replied": "SMS replies",
    "sms.unsubscribed": "SMS unsubscribes",
    "sms.failed": "SMS failures",
    "email.unsubscribed": "Email unsubscribes",
    "email.failed": "Email failures",
    "lead.exhausted": "Leads exhausted (max attempts)",
  };

  const rows = Object.entries(counts)
    .map(([t, n]) => `<tr><td style="padding:6px 12px">${niceLabels[t] ?? t}</td><td style="padding:6px 12px;text-align:right"><b>${n}</b></td></tr>`)
    .join("");

  const dateStr = DateTime.now().setZone(agency.timezone).toFormat("cccc d LLL yyyy");
  const brandName = agency.brand_name ?? agency.name;
  const logo = agency.brand_logo_url ? `<img src="${agency.brand_logo_url}" alt="${brandName}" style="max-height:32px;margin-bottom:16px"/>` : "";

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      ${logo}
      <h1 style="font-size:20px;margin:0 0 4px 0">Daily AI retargeting summary</h1>
      <p style="color:#666;margin:0 0 24px 0">${dateStr} — last 24 hours</p>
      <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:8px">
        ${rows}
      </table>
      <p style="color:#888;font-size:12px;margin-top:24px">${brandName} · AI Retargeting</p>
    </div>
  `;

  await sendEmail({
    apiKey: process.env.RESEND_API_KEY ?? "",
    from: `${process.env.RESEND_FROM_NAME ?? brandName} <${process.env.RESEND_FROM_EMAIL ?? ""}>`,
    to: recipientEmail,
    subject: `AI Retargeting — ${dateStr}`,
    html,
  });

  await db
    .from("digest_events")
    .update({ digested: true })
    .in("id", events.map((e) => (e as { id?: string }).id).filter(Boolean) as string[]);

  return events.length;
}
