import { NextResponse } from "next/server";
import { APP, CAMPAIGN } from "@/config";
import { loadLeadState, markEngaged, markExhausted, recordAttempt, writeLeadState } from "@/lib/state";
import { computeNextStep } from "@/lib/cadence/advance";
import { nextAttemptAt } from "@/lib/cadence/schedule";
import { resolveLeadTimezone } from "@/lib/timezone";

export const runtime = "nodejs";

/**
 * Retell post-call webhook. Looks up the lead via the metadata we passed
 * when placing the call, records the outcome to the GHL contact, and either
 * marks engagement (if they stayed past threshold) or schedules the next
 * cadence step.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RetellWebhookBody | null;
  if (!body?.call?.call_id) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const call = body.call;
  const meta = (call.metadata ?? {}) as RetellMetadata;

  const contactId = meta.contact_id;
  if (!contactId) return NextResponse.json({ ok: true, ignored: "no_contact_id_in_metadata" });

  const lead = await loadLeadState(contactId);
  if (!lead) return NextResponse.json({ ok: false, error: "contact_not_found" }, { status: 404 });

  const duration = Math.round((call.call_length_seconds ?? (call.duration_ms ?? 0) / 1000) || 0);
  const outcome = mapOutcome(call, duration);
  const engaged = outcome === "answered" && duration >= APP.engagedDurationSeconds;

  await recordAttempt(contactId, {
    channel: "voice",
    outcome,
    durationSeconds: duration,
    transcriptUrl: call.transcript_url ?? undefined,
  });

  await writeLeadState(contactId, {
    activeCallId: null,
    lastOutcome: outcome,
    lastAttemptAt: new Date(),
    ...(call.transcript_url ? { transcriptUrl: call.transcript_url } : {}),
  });

  if (engaged) {
    await markEngaged(contactId, outcome);
    return NextResponse.json({ ok: true, engaged: true });
  }

  // Advance to next step
  const result = computeNextStep({ ...lead, lastOutcome: outcome, attempts: { ...lead.attempts } }, new Date());
  if (!result.scheduled) {
    await markExhausted(contactId);
    return NextResponse.json({ ok: true, outcome, terminal: true });
  }

  const leadTz = resolveLeadTimezone({
    ghlTimezone: lead.timezone,
    phoneE164: lead.phone,
    agencyTimezone: APP.agency.timezone,
  });
  const fireAt = nextAttemptAt(result.step, {
    baseline: new Date(),
    leadTz,
    quietHours: CAMPAIGN.quietHours,
    spread: CAMPAIGN.spreadHours,
  });

  await writeLeadState(contactId, { stepIndex: result.stepIndex, nextAttemptAt: fireAt });

  return NextResponse.json({ ok: true, outcome, next_step: result.stepIndex, next_at: fireAt.toISOString() });
}

function mapOutcome(call: RetellCall, durationS: number): "answered" | "no_answer" | "voicemail" | "busy" | "failed" {
  if (durationS >= 5) return "answered";
  if (call.disconnection_reason?.includes("voicemail")) return "voicemail";
  if (call.disconnection_reason?.includes("busy")) return "busy";
  if (call.call_status === "error" || call.call_status === "failed") return "failed";
  return "no_answer";
}

interface RetellWebhookBody {
  event: string;
  call: RetellCall;
}

interface RetellCall {
  call_id: string;
  call_status?: "registered" | "ongoing" | "ended" | "error" | "failed";
  disconnection_reason?: string;
  duration_ms?: number;
  call_length_seconds?: number;
  transcript_url?: string;
  recording_url?: string;
  metadata?: unknown;
  from_number?: string;
  to_number?: string;
}

interface RetellMetadata {
  contact_id?: string;
  step_index?: number;
}
