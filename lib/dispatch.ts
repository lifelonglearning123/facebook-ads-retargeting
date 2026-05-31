import { APP, TEMPLATES, type CampaignConfig } from "@/config";
import { type LeadState, markExhausted, recordAttempt, writeLeadState } from "@/lib/state";
import { placeVoiceCall } from "@/lib/channels/voice";
import { renderTemplate, sendSms } from "@/lib/channels/sms";
import { sendEmail } from "@/lib/channels/email";
import { computeNextStep } from "@/lib/cadence/advance";
import { nextAttemptAt } from "@/lib/cadence/schedule";
import { resolveLeadTimezone } from "@/lib/timezone";

/**
 * Fire the cadence step at lead.stepIndex. For voice, places the call (the
 * post-call webhook will advance the cadence). For SMS/email, sends the
 * message and schedules the next step.
 */
export async function fireStep(campaign: CampaignConfig, lead: LeadState): Promise<void> {
  const step = campaign.cadence[lead.stepIndex];
  if (!step) {
    await markExhausted(lead.contactId);
    return;
  }

  const vars = {
    first_name: lead.firstName ?? "",
    last_name: lead.lastName ?? "",
    full_name: [lead.firstName, lead.lastName].filter(Boolean).join(" "),
    agency_name: APP.branding.name,
  };

  if (step.channel === "voice") {
    const { call_id } = await placeVoiceCall({
      toNumber: lead.phone,
      metadata: { contact_id: lead.contactId, step_index: lead.stepIndex },
    });
    await writeLeadState(lead.contactId, {
      activeCallId: call_id,
      lastAttemptAt: new Date(),
      attempts: { voice: lead.attempts.voice + 1 },
    });
    await recordAttempt(lead.contactId, { channel: "voice", outcome: "placed" });
    return;
  }

  if (step.channel === "sms") {
    const tplId = (step as { template_id: string }).template_id;
    const tpl = TEMPLATES[tplId]?.sms;
    if (!tpl) {
      await scheduleNextStep(campaign, lead, `missing_template:${tplId}`);
      return;
    }
    const body = renderTemplate(tpl, vars);
    await sendSms({ contactId: lead.contactId, body });
    await writeLeadState(lead.contactId, {
      lastAttemptAt: new Date(),
      lastOutcome: "sms_sent",
      attempts: { sms: lead.attempts.sms + 1 },
    });
    await recordAttempt(lead.contactId, { channel: "sms", outcome: "sent", bodySnapshot: body });
    await scheduleNextStep(campaign, lead);
    return;
  }

  if (step.channel === "email") {
    if (!lead.email) {
      await scheduleNextStep(campaign, lead, "skipped_no_email_address");
      return;
    }
    const tplId = (step as { template_id: string }).template_id;
    const tpl = TEMPLATES[tplId]?.email;
    if (!tpl) {
      await scheduleNextStep(campaign, lead, `missing_template:${tplId}`);
      return;
    }
    const subject = renderTemplate(tpl.subject, vars);
    const html = renderTemplate(tpl.html, vars);
    await sendEmail({ contactId: lead.contactId, subject, html });
    await writeLeadState(lead.contactId, {
      lastAttemptAt: new Date(),
      lastOutcome: "email_sent",
      attempts: { email: lead.attempts.email + 1 },
    });
    await recordAttempt(lead.contactId, { channel: "email", outcome: "sent", bodySnapshot: subject });
    await scheduleNextStep(campaign, lead);
    return;
  }
}

export async function scheduleNextStep(campaign: CampaignConfig, lead: LeadState, lastOutcome?: string): Promise<void> {
  const result = computeNextStep(campaign, lead, new Date());
  if (!result.scheduled) {
    await markExhausted(lead.contactId);
    return;
  }
  const leadTz = resolveLeadTimezone({
    ghlTimezone: lead.timezone,
    phoneE164: lead.phone,
    agencyTimezone: APP.agency.timezone,
  });
  const fireAt = nextAttemptAt(result.step, {
    baseline: new Date(),
    leadTz,
    quietHours: campaign.quietHours,
    spread: campaign.spreadHours,
  });
  await writeLeadState(lead.contactId, {
    stepIndex: result.stepIndex,
    nextAttemptAt: fireAt,
    ...(lastOutcome ? { lastOutcome } : {}),
  });
}
