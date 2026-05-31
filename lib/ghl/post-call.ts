import { GhlClient } from "./client";

interface PushCallOpts {
  pitEnc: string;
  locationId: string;
  contactId: string;
  outcome: string;
  attempts: { voice: number; sms: number; email: number };
  durationSeconds?: number;
  transcriptUrl?: string | null;
  campaignId: string;
  lastAttemptAt: string;
}

/**
 * Push a call outcome to GHL: update the contact's AI custom fields and
 * append a note. Best-effort — swallows network errors and lets the dispatcher
 * keep running.
 */
export async function pushOutcomeToGhl(opts: PushCallOpts): Promise<void> {
  try {
    const client = new GhlClient({ pitEnc: opts.pitEnc, locationId: opts.locationId });
    await client.updateContactCustomFields(opts.contactId, {
      ai_last_outcome: opts.outcome,
      ai_call_attempts: opts.attempts.voice,
      ai_sms_attempts: opts.attempts.sms,
      ai_email_attempts: opts.attempts.email,
      ai_last_attempt_at: opts.lastAttemptAt,
      ai_call_duration_s: opts.durationSeconds ?? 0,
      ai_transcript_url: opts.transcriptUrl ?? "",
      ai_campaign_id: opts.campaignId,
    });
    await client.addNote(opts.contactId, `AI Retargeting — ${opts.outcome} (${opts.attempts.voice} call attempts, ${opts.durationSeconds ?? 0}s last call)`);
  } catch (err) {
    console.error("[ghl.push-outcome] failed", err);
  }
}

export async function pushEngagedTag(opts: { pitEnc: string; locationId: string; contactId: string }): Promise<void> {
  try {
    const client = new GhlClient({ pitEnc: opts.pitEnc, locationId: opts.locationId });
    await client.addTag(opts.contactId, "ai-engaged");
  } catch (err) {
    console.error("[ghl.tag-engaged] failed", err);
  }
}

export async function pushExhaustedTag(opts: { pitEnc: string; locationId: string; contactId: string }): Promise<void> {
  try {
    const client = new GhlClient({ pitEnc: opts.pitEnc, locationId: opts.locationId });
    await client.addTag(opts.contactId, "ai-exhausted");
  } catch (err) {
    console.error("[ghl.tag-exhausted] failed", err);
  }
}
