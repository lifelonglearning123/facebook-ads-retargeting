import { NextResponse } from "next/server";
import { APP, CAMPAIGN, TEMPLATES } from "@/config";
import { searchByTag } from "@/lib/ghl/client";
import { leadStateFromContact, markEngaged, markExhausted, recordAttempt, writeLeadState, type LeadState } from "@/lib/state";
import { placeVoiceCall } from "@/lib/channels/voice";
import { renderTemplate, sendSms } from "@/lib/channels/sms";
import { sendEmail } from "@/lib/channels/email";
import { computeNextStep } from "@/lib/cadence/advance";
import { resolveLeadTimezone } from "@/lib/timezone";
import { nextAttemptAt } from "@/lib/cadence/schedule";

export const runtime = "nodejs";
export const maxDuration = 60;

const NOW_TOLERANCE_MS = 30_000;

/**
 * Vercel cron hits this every minute. Pulls every "ai-active" contact from
 * GHL, checks their ai_next_attempt_at, and fires steps that are due.
 *
 * At ≤100 leads/day a single search page (100 contacts) is comfortably
 * sufficient. No DB, no queue: GHL holds all the per-lead state.
 */
export async function GET(req: Request) {
  const secret = req.headers.get("X-Cron-Secret") ?? new URL(req.url).searchParams.get("secret");
  if (APP.cronSecret && secret !== APP.cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const contacts = await searchByTag({ tag: APP.ghl.activeTag, pageLimit: 100 });
  const now = new Date();

  let fired = 0;
  let skipped = 0;
  let failed = 0;

  for (const contact of contacts) {
    const lead = leadStateFromContact(contact);

    if (!lead.nextAttemptAt) { skipped++; continue; }
    if (lead.nextAttemptAt.getTime() > now.getTime() + NOW_TOLERANCE_MS) { skipped++; continue; }
    if (lead.status === "stopped" || lead.status === "engaged" || lead.status === "exhausted") { skipped++; continue; }

    try {
      await fireStep(lead);
      fired++;
    } catch (err) {
      failed++;
      await recordAttempt(lead.contactId, {
        channel: "voice",
        outcome: `error:${String(err).slice(0, 200)}`,
      });
    }
  }

  return NextResponse.json({ ok: true, scanned: contacts.length, fired, skipped, failed, at: now.toISOString() });
}

async function fireStep(lead: LeadState): Promise<void> {
  const step = CAMPAIGN.cadence[lead.stepIndex];
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
    // Cadence advances when the Retell post-call webhook fires.
    return;
  }

  if (step.channel === "sms") {
    if (!lead.smsConsent) {
      await scheduleNext(lead, "skipped_no_sms_consent");
      return;
    }
    const tplId = (step as { template_id: string }).template_id;
    const tpl = TEMPLATES[tplId]?.sms;
    if (!tpl) {
      await scheduleNext(lead, `missing_template:${tplId}`);
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
    await scheduleNext(lead);
    return;
  }

  if (step.channel === "email") {
    if (!lead.emailConsent || !lead.email) {
      await scheduleNext(lead, "skipped_no_email_consent_or_address");
      return;
    }
    const tplId = (step as { template_id: string }).template_id;
    const tpl = TEMPLATES[tplId]?.email;
    if (!tpl) {
      await scheduleNext(lead, `missing_template:${tplId}`);
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
    await scheduleNext(lead);
    return;
  }
}

async function scheduleNext(lead: LeadState, lastOutcome?: string): Promise<void> {
  // Bump the lead's attempt counters for cadence computation
  const refreshed: LeadState = {
    ...lead,
    attempts: {
      voice: lead.attempts.voice,
      sms: lead.attempts.sms + (lead.lastOutcome === "sms_sent" ? 0 : 0),
      email: lead.attempts.email + (lead.lastOutcome === "email_sent" ? 0 : 0),
    },
  };

  const result = computeNextStep(refreshed, new Date());
  if (!result.scheduled) {
    await markExhausted(lead.contactId);
    return;
  }

  const leadTz = resolveLeadTimezone({
    ghlTimezone: lead.timezone,
    phoneE164: lead.phone,
    agencyTimezone: APP.agency.timezone,
  });

  // Recompute with explicit tz
  const fireAt = nextAttemptAt(result.step, {
    baseline: new Date(),
    leadTz,
    quietHours: CAMPAIGN.quietHours,
    spread: CAMPAIGN.spreadHours,
  });

  await writeLeadState(lead.contactId, {
    stepIndex: result.stepIndex,
    nextAttemptAt: fireAt,
    ...(lastOutcome ? { lastOutcome } : {}),
  });
}
