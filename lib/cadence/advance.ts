import { supabaseAdmin } from "@/lib/supabase/admin";
import { CadenceSchema, QuietHoursSchema, type Cadence } from "./types";
import { nextAttemptAt } from "./schedule";

interface AdvanceOpts {
  agencyId: string;
  leadId: string;
  campaignId: string;
  /** Index of the step that just executed (or attempted to) */
  fromStepIndex: number;
  /** Time the attempt completed — used as baseline for "delay" steps */
  baseline?: Date;
}

interface AdvanceResult {
  scheduled: boolean;
  reason?: "max_attempts" | "cadence_exhausted" | "no_consented_step" | "campaign_missing" | "lead_missing";
  nextStepIndex?: number;
  nextAttemptAt?: string;
  channel?: "voice" | "sms" | "email";
}

/**
 * After an attempt, decide whether to schedule the next cadence step. Skips
 * steps whose channel the lead hasn't consented to. Returns ok=false if the
 * lead has hit max attempts or run off the end of the cadence; caller marks
 * the lead 'exhausted' in that case.
 */
export async function advanceCadence(opts: AdvanceOpts): Promise<AdvanceResult> {
  const db = supabaseAdmin();

  const [{ data: campaign }, { data: lead }] = await Promise.all([
    db.from("campaigns").select("cadence_json, quiet_hours_json, spread_hours, max_attempts").eq("id", opts.campaignId).maybeSingle(),
    db.from("leads").select("timezone, sms_consent, email_consent, attempts_voice, attempts_sms, attempts_email, status").eq("id", opts.leadId).maybeSingle(),
  ]);

  if (!campaign) return { scheduled: false, reason: "campaign_missing" };
  if (!lead) return { scheduled: false, reason: "lead_missing" };

  if (["engaged", "stopped", "exhausted"].includes(lead.status)) {
    return { scheduled: false, reason: "cadence_exhausted" };
  }

  const cadence = CadenceSchema.safeParse(campaign.cadence_json);
  const quiet = QuietHoursSchema.safeParse(campaign.quiet_hours_json);
  if (!cadence.success || !quiet.success) return { scheduled: false, reason: "campaign_missing" };

  const total = lead.attempts_voice + lead.attempts_sms + lead.attempts_email;
  if (total >= campaign.max_attempts) return { scheduled: false, reason: "max_attempts" };

  const nextIdx = pickNextStep(cadence.data, opts.fromStepIndex, {
    smsConsent: lead.sms_consent,
    emailConsent: lead.email_consent,
  });
  if (nextIdx === -1) return { scheduled: false, reason: "cadence_exhausted" };

  const step = cadence.data[nextIdx];

  // Pull recent attempt hours for "spread" mode
  const recentHours: number[] = [];
  if (campaign.spread_hours) {
    const { data: rows } = await db
      .from("call_attempts")
      .select("started_at")
      .eq("lead_id", opts.leadId)
      .order("started_at", { ascending: false })
      .limit(10);
    for (const r of rows ?? []) recentHours.push(new Date(r.started_at).getUTCHours());
  }

  const fireAt = nextAttemptAt(step, {
    baseline: opts.baseline ?? new Date(),
    leadTz: lead.timezone,
    quietHours: quiet.data,
    spread: campaign.spread_hours,
    recentHours,
  });

  if (step.channel === "voice") {
    await db.from("scheduled_calls").insert({
      agency_id: opts.agencyId,
      lead_id: opts.leadId,
      campaign_id: opts.campaignId,
      step_index: nextIdx,
      next_attempt_at: fireAt.toISOString(),
    });
  } else {
    await db.from("scheduled_messages").insert({
      agency_id: opts.agencyId,
      lead_id: opts.leadId,
      campaign_id: opts.campaignId,
      channel: step.channel,
      template_id: "template_id" in step ? step.template_id : null,
      step_index: nextIdx,
      next_attempt_at: fireAt.toISOString(),
    });
  }

  return {
    scheduled: true,
    nextStepIndex: nextIdx,
    nextAttemptAt: fireAt.toISOString(),
    channel: step.channel,
  };
}

function pickNextStep(cadence: Cadence, fromIdx: number, consent: { smsConsent: boolean; emailConsent: boolean }): number {
  for (let i = fromIdx + 1; i < cadence.length; i++) {
    const step = cadence[i];
    if (step.channel === "voice") return i;
    if (step.channel === "sms" && consent.smsConsent) return i;
    if (step.channel === "email" && consent.emailConsent) return i;
  }
  return -1;
}
