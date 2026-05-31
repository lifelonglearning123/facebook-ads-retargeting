import { NextResponse } from "next/server";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { resolveByStartToken } from "@/lib/tenant/resolve";
import { GhlStartPayloadSchema, toBool } from "@/lib/ghl/webhook";
import { resolveLeadTimezone } from "@/lib/timezone";
import { CadenceSchema, QuietHoursSchema } from "@/lib/cadence/types";
import { nextAttemptAt } from "@/lib/cadence/schedule";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;

  const ctxData = await resolveByStartToken(token);
  if (!ctxData) {
    return NextResponse.json({ ok: false, error: "campaign_not_found_or_inactive" }, { status: 404 });
  }
  const { agency, campaign } = ctxData;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = GhlStartPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  const phone = parsePhoneNumberFromString(p.phone, "GB");
  if (!phone || !phone.isValid()) {
    return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }
  const phoneE164 = phone.number;

  const leadTz = resolveLeadTimezone({
    ghlTimezone: p.timezone,
    phoneE164,
    agencyTimezone: agency.timezone,
  });

  const cadence = CadenceSchema.safeParse(campaign.cadence_json);
  const quiet = QuietHoursSchema.safeParse(campaign.quiet_hours_json);
  if (!cadence.success || !quiet.success) {
    return NextResponse.json({ ok: false, error: "campaign_misconfigured" }, { status: 500 });
  }
  if (cadence.data.length === 0) {
    return NextResponse.json({ ok: false, error: "empty_cadence" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: lead, error: leadErr } = await db
    .from("leads")
    .upsert(
      {
        agency_id: agency.id,
        campaign_id: campaign.id,
        ghl_contact_id: p.contact_id,
        phone_e164: phoneE164,
        email: p.email ?? null,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        timezone: leadTz,
        sms_consent: toBool(p.sms_consent),
        email_consent: toBool(p.email_consent),
        status: "queued",
      },
      { onConflict: "campaign_id,ghl_contact_id" }
    )
    .select()
    .single();

  if (leadErr || !lead) {
    return NextResponse.json({ ok: false, error: "lead_upsert_failed", details: leadErr?.message }, { status: 500 });
  }

  const firstStep = cadence.data[0];
  const skipForConsent =
    (firstStep.channel === "sms" && !toBool(p.sms_consent)) ||
    (firstStep.channel === "email" && !toBool(p.email_consent));

  const startIndex = skipForConsent
    ? cadence.data.findIndex((s) => {
        if (s.channel === "voice") return true;
        if (s.channel === "sms") return toBool(p.sms_consent);
        if (s.channel === "email") return toBool(p.email_consent);
        return false;
      })
    : 0;

  if (startIndex === -1) {
    return NextResponse.json({ ok: true, lead_id: lead.id, scheduled: false, reason: "no_consented_step" });
  }

  const step = cadence.data[startIndex];
  const fireAt = nextAttemptAt(step, {
    baseline: new Date(),
    leadTz,
    quietHours: quiet.data,
    spread: campaign.spread_hours,
  });

  if (step.channel === "voice") {
    const { error } = await db.from("scheduled_calls").insert({
      agency_id: agency.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
      step_index: startIndex,
      next_attempt_at: fireAt.toISOString(),
    });
    if (error) return NextResponse.json({ ok: false, error: "schedule_failed", details: error.message }, { status: 500 });
  } else {
    const { error } = await db.from("scheduled_messages").insert({
      agency_id: agency.id,
      lead_id: lead.id,
      campaign_id: campaign.id,
      channel: step.channel,
      template_id: "template_id" in step ? step.template_id : null,
      step_index: startIndex,
      next_attempt_at: fireAt.toISOString(),
    });
    if (error) return NextResponse.json({ ok: false, error: "schedule_failed", details: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    lead_id: lead.id,
    next_attempt_at: fireAt.toISOString(),
    step_index: startIndex,
    channel: step.channel,
  });
}
