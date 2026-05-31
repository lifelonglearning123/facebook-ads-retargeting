import { CAMPAIGN } from "@/config";
import type { LeadState } from "@/lib/state";
import { nextAttemptAt } from "./schedule";
import type { Cadence, CadenceStep } from "./types";

interface AdvanceResult {
  scheduled: false;
  reason: "max_attempts" | "cadence_exhausted";
}

interface AdvanceOk {
  scheduled: true;
  stepIndex: number;
  step: CadenceStep;
  nextAttemptAt: Date;
}

/**
 * Decide the next step in the campaign cadence after an attempt completes.
 * Pure function over the in-memory campaign config + the lead state — no IO.
 */
export function computeNextStep(lead: LeadState, baseline: Date, recentAttemptHoursUtc: number[] = []): AdvanceOk | AdvanceResult {
  const cadence = CAMPAIGN.cadence;
  const totalAttempts = lead.attempts.voice + lead.attempts.sms + lead.attempts.email;
  if (totalAttempts >= CAMPAIGN.maxAttempts) return { scheduled: false, reason: "max_attempts" };

  const next = pickNextStep(cadence, lead.stepIndex, { sms: lead.smsConsent, email: lead.emailConsent });
  if (next === -1) return { scheduled: false, reason: "cadence_exhausted" };

  const step = cadence[next];
  const leadTz = lead.timezone ?? "Europe/London";
  const fireAt = nextAttemptAt(step, {
    baseline,
    leadTz,
    quietHours: CAMPAIGN.quietHours,
    spread: CAMPAIGN.spreadHours,
    recentHours: recentAttemptHoursUtc,
  });

  return { scheduled: true, stepIndex: next, step, nextAttemptAt: fireAt };
}

function pickNextStep(cadence: Cadence, fromIdx: number, consent: { sms: boolean; email: boolean }): number {
  for (let i = fromIdx + 1; i < cadence.length; i++) {
    const step = cadence[i];
    if (step.channel === "voice") return i;
    if (step.channel === "sms" && consent.sms) return i;
    if (step.channel === "email" && consent.email) return i;
  }
  return -1;
}

/** Pick the first step the lead can take given consent flags. Used at intake. */
export function pickFirstStep(consent: { sms: boolean; email: boolean }): { stepIndex: number; step: CadenceStep } | null {
  for (let i = 0; i < CAMPAIGN.cadence.length; i++) {
    const step = CAMPAIGN.cadence[i];
    if (step.channel === "voice") return { stepIndex: i, step };
    if (step.channel === "sms" && consent.sms) return { stepIndex: i, step };
    if (step.channel === "email" && consent.email) return { stepIndex: i, step };
  }
  return null;
}
