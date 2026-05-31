import { CAMPAIGN } from "@/config";
import type { LeadState } from "@/lib/state";
import { nextAttemptAt } from "./schedule";
import type { CadenceStep } from "./types";

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

  const next = lead.stepIndex + 1;
  if (next >= cadence.length) return { scheduled: false, reason: "cadence_exhausted" };

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

/** Pick the first step. Used at intake. */
export function pickFirstStep(): { stepIndex: number; step: CadenceStep } | null {
  const step = CAMPAIGN.cadence[0];
  return step ? { stepIndex: 0, step } : null;
}
