import { parsePhoneNumberFromString } from "libphonenumber-js";
import { APP, type CampaignConfig } from "@/config";
import { removeTag, searchByTag } from "@/lib/ghl/client";
import { enterCadence, leadStateFromContact, loadLeadState, recordAttempt } from "@/lib/state";
import { pickFirstStep } from "@/lib/cadence/advance";
import { nextAttemptAt } from "@/lib/cadence/schedule";
import { resolveLeadTimezone } from "@/lib/timezone";
import { fireStep } from "@/lib/dispatch";

export interface IntakeResult {
  scanned: number;
  started: number;
  skipped: number;
  failed: number;
}

/**
 * Polling-based lead intake. Picks up any GHL contact tagged
 * APP.ghl.sourceTag ("ai-callback"), enters them into the cadence, fires
 * the first step inline if due.
 */
export async function runIntake(campaign: CampaignConfig): Promise<IntakeResult> {
  const result: IntakeResult = { scanned: 0, started: 0, skipped: 0, failed: 0 };

  const contacts = await searchByTag({ tag: APP.ghl.sourceTag, pageLimit: 100 }).catch(() => []);
  result.scanned = contacts.length;

  for (const contact of contacts) {
    const lead = leadStateFromContact(contact);

    if (["in_progress", "engaged", "exhausted", "stopped"].includes(lead.status)) {
      await removeTag(contact.id, APP.ghl.sourceTag).catch(() => {});
      result.skipped++;
      continue;
    }

    const phone = lead.phone ? parsePhoneNumberFromString(lead.phone, "GB") : null;
    if (!phone?.isValid()) {
      await recordAttempt(contact.id, { channel: "voice", outcome: "intake_skipped:invalid_phone" }).catch(() => {});
      await removeTag(contact.id, APP.ghl.sourceTag).catch(() => {});
      result.skipped++;
      continue;
    }

    const first = pickFirstStep(campaign);
    if (!first) {
      await recordAttempt(contact.id, { channel: "voice", outcome: "intake_skipped:empty_cadence" }).catch(() => {});
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
        quietHours: campaign.quietHours,
        spread: campaign.spreadHours,
      });
      await enterCadence(contact.id, first.stepIndex, fireAt, { sms: true, email: true });
      await removeTag(contact.id, APP.ghl.sourceTag).catch(() => {});

      const isDueNow = fireAt.getTime() <= Date.now() + 30_000;
      if (isDueNow) {
        const refreshed = await loadLeadState(contact.id);
        if (refreshed) {
          await fireStep(campaign, {
            ...refreshed,
            phone: phone.number,
            timezone: refreshed.timezone ?? leadTz,
          });
        }
      } else {
        await recordAttempt(contact.id, {
          channel: first.step.channel,
          outcome: `intake_queued_step_${first.stepIndex}`,
        }).catch(() => {});
      }

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
