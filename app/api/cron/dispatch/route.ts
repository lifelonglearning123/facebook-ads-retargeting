import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { placeVoiceCall } from "@/lib/channels/voice";
import { renderTemplate, sendSms } from "@/lib/channels/sms";
import { sendEmail } from "@/lib/channels/email";
import { advanceCadence } from "@/lib/cadence/advance";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH = 50;

/**
 * Hit by Supabase pg_cron every minute. Pulls due voice + message rows,
 * enforces per-agency concurrency for voice, fires each via the channel
 * handler, records the attempt, and schedules the next cadence step.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("X-Cron-Secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const now = new Date().toISOString();

  const [calls, msgs] = await Promise.all([
    db
      .from("scheduled_calls")
      .select("id, agency_id, lead_id, campaign_id, step_index")
      .eq("status", "queued")
      .lte("next_attempt_at", now)
      .order("next_attempt_at", { ascending: true })
      .limit(BATCH),
    db
      .from("scheduled_messages")
      .select("id, agency_id, lead_id, campaign_id, channel, template_id, step_index")
      .eq("status", "queued")
      .lte("next_attempt_at", now)
      .order("next_attempt_at", { ascending: true })
      .limit(BATCH),
  ]);

  let dispatched = 0;
  let failed = 0;
  let throttled = 0;

  for (const row of calls.data ?? []) {
    const r = await dispatchCall(row);
    if (r === "ok") dispatched++;
    else if (r === "throttled") throttled++;
    else failed++;
  }

  for (const row of msgs.data ?? []) {
    const r = await dispatchMessage(row);
    if (r === "ok") dispatched++;
    else failed++;
  }

  return NextResponse.json({ ok: true, dispatched, failed, throttled, at: now });
}

type Row = { id: string; agency_id: string; lead_id: string; campaign_id: string; step_index: number };
type MsgRow = Row & { channel: "sms" | "email"; template_id: string | null };

async function dispatchCall(row: Row): Promise<"ok" | "fail" | "throttled"> {
  const db = supabaseAdmin();

  // Concurrency check
  const [{ data: agency }, { count }] = await Promise.all([
    db.from("agencies").select("id, concurrency_cap, twilio_account_sid_enc, retell_api_key_enc").eq("id", row.agency_id).single(),
    db.from("call_attempts").select("id", { count: "exact", head: true }).eq("agency_id", row.agency_id).is("ended_at", null),
  ]);
  if (!agency || !agency.retell_api_key_enc) return await markFailed("calls", row.id, "missing_retell_key");
  if ((count ?? 0) >= agency.concurrency_cap) return "throttled";

  const { data: lead } = await db.from("leads").select("phone_e164, ghl_contact_id").eq("id", row.lead_id).single();
  const { data: campaign } = await db.from("campaigns").select("retell_agent_id, retell_phone_number").eq("id", row.campaign_id).single();
  if (!lead || !campaign?.retell_agent_id || !campaign?.retell_phone_number) {
    return await markFailed("calls", row.id, "campaign_misconfigured");
  }

  await db.from("scheduled_calls").update({ status: "dispatched" }).eq("id", row.id);

  try {
    const { call_id } = await placeVoiceCall({
      retellApiKeyEnc: agency.retell_api_key_enc,
      agentId: campaign.retell_agent_id,
      fromNumber: campaign.retell_phone_number,
      toNumber: lead.phone_e164,
      metadata: {
        agency_id: row.agency_id,
        campaign_id: row.campaign_id,
        lead_id: row.lead_id,
        scheduled_call_id: row.id,
        ghl_contact_id: lead.ghl_contact_id,
        step_index: row.step_index,
      },
    });
    await db.from("call_attempts").insert({
      agency_id: row.agency_id,
      lead_id: row.lead_id,
      scheduled_call_id: row.id,
      retell_call_id: call_id,
    });
    await db.from("leads").update({ status: "in_progress" }).eq("id", row.lead_id);
    return "ok";
  } catch (err) {
    await db.from("scheduled_calls").update({ status: "failed" }).eq("id", row.id);
    await db.from("digest_events").insert({
      agency_id: row.agency_id,
      type: "call.failed",
      lead_id: row.lead_id,
      payload: { error: String(err) },
    });
    // Even on failure, advance the cadence so we don't strand the lead.
    await advanceCadence({
      agencyId: row.agency_id,
      leadId: row.lead_id,
      campaignId: row.campaign_id,
      fromStepIndex: row.step_index,
    });
    return "fail";
  }
}

async function dispatchMessage(row: MsgRow): Promise<"ok" | "fail"> {
  const db = supabaseAdmin();

  const [{ data: agency }, { data: lead }, { data: campaign }, { data: template }] = await Promise.all([
    db.from("agencies").select("twilio_account_sid_enc, twilio_auth_token_enc").eq("id", row.agency_id).single(),
    db.from("leads").select("phone_e164, email, first_name, last_name, ghl_contact_id, sms_consent, email_consent").eq("id", row.lead_id).single(),
    db.from("campaigns").select("retell_phone_number").eq("id", row.campaign_id).single(),
    row.template_id ? db.from("templates").select("subject, body").eq("id", row.template_id).single() : Promise.resolve({ data: null }),
  ]);
  if (!agency || !lead || !template?.body) {
    return await markFailedMsg(row.id, "missing_template_or_lead");
  }

  // Consent gate
  if (row.channel === "sms" && !lead.sms_consent) return await markFailedMsg(row.id, "no_sms_consent");
  if (row.channel === "email" && !lead.email_consent) return await markFailedMsg(row.id, "no_email_consent");

  const vars = {
    first_name: lead.first_name ?? "",
    last_name: lead.last_name ?? "",
    full_name: [lead.first_name, lead.last_name].filter(Boolean).join(" "),
  };
  const body = renderTemplate(template.body, vars);

  await db.from("scheduled_messages").update({ status: "dispatched" }).eq("id", row.id);

  try {
    if (row.channel === "sms") {
      if (!agency.twilio_account_sid_enc || !agency.twilio_auth_token_enc || !campaign?.retell_phone_number) {
        return await markFailedMsg(row.id, "missing_twilio_creds");
      }
      const { sid } = await sendSms({
        twilioAccountSidEnc: agency.twilio_account_sid_enc,
        twilioAuthTokenEnc: agency.twilio_auth_token_enc,
        fromNumber: campaign.retell_phone_number,
        toNumber: lead.phone_e164,
        body,
      });
      await db.from("message_attempts").insert({
        agency_id: row.agency_id,
        lead_id: row.lead_id,
        scheduled_message_id: row.id,
        channel: "sms",
        provider_message_id: sid,
        body_snapshot: body,
        outcome: "sent",
      });
      await db.rpc("increment_sms_attempts", { lead_id: row.lead_id }).catch(async () => {
        // Fallback if RPC not present
        const { data: l } = await db.from("leads").select("attempts_sms").eq("id", row.lead_id).single();
        await db.from("leads").update({ attempts_sms: (l?.attempts_sms ?? 0) + 1 }).eq("id", row.lead_id);
      });
    } else {
      if (!lead.email) return await markFailedMsg(row.id, "no_email");
      const subject = renderTemplate(template.subject ?? "", vars);
      const { id } = await sendEmail({
        apiKey: process.env.RESEND_API_KEY ?? "",
        from: `${process.env.RESEND_FROM_NAME ?? "Agency"} <${process.env.RESEND_FROM_EMAIL ?? ""}>`,
        to: lead.email,
        subject,
        html: body,
        unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/u/${row.lead_id}`,
      });
      await db.from("message_attempts").insert({
        agency_id: row.agency_id,
        lead_id: row.lead_id,
        scheduled_message_id: row.id,
        channel: "email",
        provider_message_id: id,
        body_snapshot: body,
        outcome: "sent",
      });
      const { data: l } = await db.from("leads").select("attempts_email").eq("id", row.lead_id).single();
      await db.from("leads").update({ attempts_email: (l?.attempts_email ?? 0) + 1 }).eq("id", row.lead_id);
    }

    await db.from("scheduled_messages").update({ status: "completed" }).eq("id", row.id);

    await advanceCadence({
      agencyId: row.agency_id,
      leadId: row.lead_id,
      campaignId: row.campaign_id,
      fromStepIndex: row.step_index,
    });
    return "ok";
  } catch (err) {
    await db.from("scheduled_messages").update({ status: "failed" }).eq("id", row.id);
    await db.from("digest_events").insert({
      agency_id: row.agency_id,
      type: row.channel === "sms" ? "sms.failed" : "email.failed",
      lead_id: row.lead_id,
      payload: { error: String(err) },
    });
    await advanceCadence({
      agencyId: row.agency_id,
      leadId: row.lead_id,
      campaignId: row.campaign_id,
      fromStepIndex: row.step_index,
    });
    return "fail";
  }
}

async function markFailed(table: "calls", id: string, reason: string): Promise<"fail"> {
  await supabaseAdmin().from(`scheduled_${table}`).update({ status: "failed" }).eq("id", id);
  return "fail";
}

async function markFailedMsg(id: string, _reason: string): Promise<"fail"> {
  await supabaseAdmin().from("scheduled_messages").update({ status: "failed" }).eq("id", id);
  return "fail";
}
