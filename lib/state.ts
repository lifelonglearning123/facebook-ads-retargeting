import type { GhlContact } from "@/lib/ghl/client";
import { addNote, addTag, getContact, removeTag, updateContactCustomFields } from "@/lib/ghl/client";
import { APP } from "@/config";

/**
 * Per-lead state lives in GHL contact custom fields. This module is the
 * read/write boundary so the rest of the app speaks in domain terms.
 */

export type LeadStatus = "queued" | "in_progress" | "engaged" | "exhausted" | "stopped";

export interface LeadState {
  contactId: string;
  status: LeadStatus;
  stepIndex: number;
  nextAttemptAt: Date | null;
  attempts: { voice: number; sms: number; email: number };
  lastOutcome: string | null;
  lastAttemptAt: Date | null;
  smsConsent: boolean;
  emailConsent: boolean;
  activeCallId: string | null;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  timezone: string | null;
}

function getField(c: GhlContact, key: string): string | number | boolean | undefined {
  return c.customFields?.find((f) => f.key === key)?.value;
}

function asNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") return Number(v);
  return 0;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return false;
}

function asDate(v: unknown): Date | null {
  if (typeof v !== "string" || v === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function leadStateFromContact(c: GhlContact): LeadState {
  return {
    contactId: c.id,
    status: ((getField(c, "ai_status") as LeadStatus) || "queued") as LeadStatus,
    stepIndex: asNum(getField(c, "ai_step_index")),
    nextAttemptAt: asDate(getField(c, "ai_next_attempt_at")),
    attempts: {
      voice: asNum(getField(c, "ai_attempts_voice")),
      sms: asNum(getField(c, "ai_attempts_sms")),
      email: asNum(getField(c, "ai_attempts_email")),
    },
    lastOutcome: (getField(c, "ai_last_outcome") as string) ?? null,
    lastAttemptAt: asDate(getField(c, "ai_last_attempt_at")),
    smsConsent: asBool(getField(c, "ai_sms_consent")),
    emailConsent: asBool(getField(c, "ai_email_consent")),
    activeCallId: (getField(c, "ai_active_call_id") as string) ?? null,
    phone: c.phone ?? "",
    email: c.email ?? null,
    firstName: c.firstName ?? null,
    lastName: c.lastName ?? null,
    timezone: c.timezone ?? null,
  };
}

export async function loadLeadState(contactId: string): Promise<LeadState | null> {
  const contact = await getContact(contactId);
  if (!contact) return null;
  return leadStateFromContact(contact);
}

interface WriteOpts {
  status?: LeadStatus;
  stepIndex?: number;
  nextAttemptAt?: Date | null;
  lastOutcome?: string;
  lastAttemptAt?: Date;
  attempts?: Partial<{ voice: number; sms: number; email: number }>;
  activeCallId?: string | null;
  transcriptUrl?: string;
  smsConsent?: boolean;
  emailConsent?: boolean;
}

export async function writeLeadState(contactId: string, patch: WriteOpts): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.status !== undefined) fields.ai_status = patch.status;
  if (patch.stepIndex !== undefined) fields.ai_step_index = patch.stepIndex;
  if (patch.nextAttemptAt !== undefined) fields.ai_next_attempt_at = patch.nextAttemptAt ? patch.nextAttemptAt.toISOString() : "";
  if (patch.lastOutcome !== undefined) fields.ai_last_outcome = patch.lastOutcome;
  if (patch.lastAttemptAt !== undefined) fields.ai_last_attempt_at = patch.lastAttemptAt.toISOString();
  if (patch.attempts?.voice !== undefined) fields.ai_attempts_voice = patch.attempts.voice;
  if (patch.attempts?.sms !== undefined) fields.ai_attempts_sms = patch.attempts.sms;
  if (patch.attempts?.email !== undefined) fields.ai_attempts_email = patch.attempts.email;
  if (patch.activeCallId !== undefined) fields.ai_active_call_id = patch.activeCallId ?? "";
  if (patch.transcriptUrl !== undefined) fields.ai_transcript_url = patch.transcriptUrl;
  if (patch.smsConsent !== undefined) fields.ai_sms_consent = patch.smsConsent;
  if (patch.emailConsent !== undefined) fields.ai_email_consent = patch.emailConsent;

  if (Object.keys(fields).length === 0) return;
  await updateContactCustomFields(contactId, fields);
}

// ─── Lifecycle helpers ────────────────────────────────────────────────────

export async function enterCadence(contactId: string, firstStep: number, nextAttemptAt: Date, consent: { sms: boolean; email: boolean }): Promise<void> {
  await writeLeadState(contactId, {
    status: "in_progress",
    stepIndex: firstStep,
    nextAttemptAt,
    smsConsent: consent.sms,
    emailConsent: consent.email,
  });
  await addTag(contactId, APP.ghl.activeTag);
}

export async function markEngaged(contactId: string, outcome: string): Promise<void> {
  await writeLeadState(contactId, {
    status: "engaged",
    nextAttemptAt: null,
    lastOutcome: outcome,
    activeCallId: null,
  });
  await removeTag(contactId, APP.ghl.activeTag);
  await addTag(contactId, APP.ghl.engagedTag);
}

export async function markExhausted(contactId: string): Promise<void> {
  await writeLeadState(contactId, { status: "exhausted", nextAttemptAt: null, activeCallId: null });
  await removeTag(contactId, APP.ghl.activeTag);
  await addTag(contactId, APP.ghl.exhaustedTag);
}

export async function markStopped(contactId: string, reason: string): Promise<void> {
  await writeLeadState(contactId, { status: "stopped", nextAttemptAt: null, lastOutcome: reason, activeCallId: null });
  await removeTag(contactId, APP.ghl.activeTag);
}

export async function recordAttempt(contactId: string, opts: { channel: "voice" | "sms" | "email"; outcome: string; durationSeconds?: number; transcriptUrl?: string; bodySnapshot?: string; }): Promise<void> {
  // Append a human-readable note for the agency.
  const parts = [
    `AI ${opts.channel.toUpperCase()} — ${opts.outcome}`,
    opts.durationSeconds !== undefined ? `${opts.durationSeconds}s` : null,
    opts.bodySnapshot ? `\n${opts.bodySnapshot}` : null,
    opts.transcriptUrl ? `\n${opts.transcriptUrl}` : null,
  ].filter(Boolean).join(" · ");
  await addNote(contactId, parts);
}
