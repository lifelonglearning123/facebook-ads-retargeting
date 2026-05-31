import { parsePhoneNumberFromString } from "libphonenumber-js";
import { APP, CAMPAIGN } from "@/config";
import { removeTag, searchByTag } from "@/lib/ghl/client";
import { enterCadence, leadStateFromContact, recordAttempt } from "@/lib/state";
import { pickFirstStep } from "@/lib/cadence/advance";
import { nextAttemptAt } from "@/lib/cadence/schedule";
import { resolveLeadTimezone } from "@/lib/timezone";

export interface IntakeResult {
  scanned: number;
  started: number;
  skipped: number;
  failed: number;
}

/**
 * Polling-based lead intake. Looks for any GHL contact tagged with
 * APP.ghl.sourceTag ("ai-callback"), starts a cadence for each, then
 * removes the trigger tag so the same contact isn't picked up twice.
 *
 * This means the agency doesn't have to build a GHL workflow — they just
 * tag a contact, and our /api/tick will pick it up within ≤60 seconds.
 * For instant pickup, the /api/ghl/start webhook endpoint is still
 * available as an opt-in.
 */
export async function runIntake(): Promise<IntakeResult> {
  const result: IntakeResult = { scanned: 0, started: 0, skipped: 0, failed: 0 };

  const contacts = await searchByTag({ tag: APP.ghl.sourceTag, pageLimit: 100 }).catch(() => []);
  result.scanned = contacts.length;

  for (const contact of contacts) {
    const lead = leadStateFromContact(contact);

    // Already moved into cadence or terminal — just clean the trigger tag.
    if (["in_progress", "engaged", "exhausted", "stopped"].includes(lead.status)) {
      await removeTag(contact.id, APP.ghl.sourceTag).catch(() => {});
      result.skipped++;
      continue;
    }

    // Validate phone
    const phone = lead.phone ? parsePhoneNumberFromString(lead.phone, "GB") : null;
    if (!phone?.isValid()) {
      await recordAttempt(contact.id, { channel: "voice", outcome: "intake_skipped:invalid_phone" }).catch(() => {});
      await removeTag(contact.id, APP.ghl.sourceTag).catch(() => {});
      result.skipped++;
      continue;
    }

    const first = pickFirstStep({ sms: lead.smsConsent, email: lead.emailConsent });
    if (!first) {
      await recordAttempt(contact.id, { channel: "voice", outcome: "intake_skipped:no_consented_step" }).catch(() => {});
      await removeTag(contact.id, APP.ghl.sourceTag).catch(() => {});
      result.skipped++;
      continue;
    }

    try {
      const leadTz = resolveLeadTimezone({
        ghlTimezone: lead.timezone,
        phoneE164: phone.number,
        agencyTimezone: APP.agency.timezone,
      });
      const fireAt = nextAttemptAt(first.step, {
        baseline: new Date(),
        leadTz,
        quietHours: CAMPAIGN.quietHours,
        spread: CAMPAIGN.spreadHours,
      });
      await enterCadence(contact.id, first.stepIndex, fireAt, {
        sms: lead.smsConsent,
        email: lead.emailConsent,
      });
      await removeTag(contact.id, APP.ghl.sourceTag).catch(() => {});
      await recordAttempt(contact.id, {
        channel: first.step.channel,
        outcome: `intake_queued_step_${first.stepIndex}`,
      }).catch(() => {});
      result.started++;
    } catch (err) {
      await recordAttempt(contact.id, {
        channel: "voice",
        outcome: `intake_failed:${String(err).slice(0, 100)}`,
      }).catch(() => {});
      result.failed++;
    }
  }

  return result;
}
