import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { advanceCadence } from "@/lib/cadence/advance";
import { pushEngagedTag, pushExhaustedTag, pushOutcomeToGhl } from "@/lib/ghl/post-call";

export const runtime = "nodejs";

const ENGAGED_DURATION_S = 30;

/**
 * Retell post-call webhook. Retell will POST when a call ends with the
 * call_id, duration, status, transcript URL, and any custom metadata we
 * set when placing the call.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RetellWebhookBody | null;
  if (!body || !body.call?.call_id) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const call = body.call;
  const meta = (call.metadata ?? {}) as RetellMetadata;
  const db = supabaseAdmin();

  // Locate the attempt we created when dispatching
  const { data: attempt } = await db
    .from("call_attempts")
    .select("id, lead_id, agency_id, scheduled_call_id")
    .eq("retell_call_id", call.call_id)
    .maybeSingle();

  if (!attempt) {
    // Inbound call (not initiated by us) — create the attempt fresh
    if (!meta.agency_id || !meta.lead_id) {
      return NextResponse.json({ ok: true, ignored: true });
    }
  }

  const agencyId = attempt?.agency_id ?? meta.agency_id;
  const leadId = attempt?.lead_id ?? meta.lead_id;
  const campaignId = meta.campaign_id;
  if (!agencyId || !leadId) {
    return NextResponse.json({ ok: false, error: "no_agency_or_lead" }, { status: 400 });
  }

  const duration = call.call_length_seconds ?? call.duration_ms ? Math.round((call.duration_ms ?? 0) / 1000) : 0;
  const answered = call.disconnection_reason === "user_hangup" || (call.call_status === "ended" && duration > 0);
  const outcome = mapOutcome(call, duration);
  const engaged = outcome === "answered" && duration >= ENGAGED_DURATION_S;

  // Update the attempt
  if (attempt) {
    await db.from("call_attempts").update({
      ended_at: new Date().toISOString(),
      duration_s: duration,
      outcome,
      transcript_url: call.transcript_url ?? null,
      recording_url: call.recording_url ?? null,
      raw_payload: body as unknown as object,
    }).eq("id", attempt.id);

    if (attempt.scheduled_call_id) {
      await db.from("scheduled_calls").update({ status: "completed" }).eq("id", attempt.scheduled_call_id);
    }
  }

  // Bump voice attempt counter on lead
  const { data: lead } = await db
    .from("leads")
    .select("attempts_voice, attempts_sms, attempts_email, ghl_contact_id")
    .eq("id", leadId)
    .single();
  if (lead) {
    await db.from("leads").update({
      attempts_voice: (lead.attempts_voice ?? 0) + 1,
      last_outcome: outcome,
      status: engaged ? "engaged" : "in_progress",
    }).eq("id", leadId);
  }

  // Digest event
  await db.from("digest_events").insert({
    agency_id: agencyId,
    lead_id: leadId,
    type: engaged ? "call.engaged" : `call.${outcome}`,
    payload: { call_id: call.call_id, duration_s: duration, transcript_url: call.transcript_url ?? null },
  });

  // Push to GHL if we have a contact and the agency configured a PIT
  const { data: agency } = await db.from("agencies").select("location_id, ghl_pit_enc").eq("id", agencyId).single();
  if (agency?.ghl_pit_enc && lead?.ghl_contact_id) {
    await pushOutcomeToGhl({
      pitEnc: agency.ghl_pit_enc,
      locationId: agency.location_id,
      contactId: lead.ghl_contact_id,
      outcome,
      attempts: {
        voice: (lead.attempts_voice ?? 0) + 1,
        sms: lead.attempts_sms ?? 0,
        email: lead.attempts_email ?? 0,
      },
      durationSeconds: duration,
      transcriptUrl: call.transcript_url ?? null,
      campaignId: campaignId ?? "",
      lastAttemptAt: new Date().toISOString(),
    });
  }

  if (engaged) {
    if (agency?.ghl_pit_enc && lead?.ghl_contact_id) {
      await pushEngagedTag({ pitEnc: agency.ghl_pit_enc, locationId: agency.location_id, contactId: lead.ghl_contact_id });
    }
    // Cancel any remaining queued steps
    await db.from("scheduled_calls").update({ status: "cancelled" }).eq("lead_id", leadId).eq("status", "queued");
    await db.from("scheduled_messages").update({ status: "cancelled" }).eq("lead_id", leadId).eq("status", "queued");
    return NextResponse.json({ ok: true, engaged: true });
  }

  // Not engaged → schedule next step
  const result = campaignId
    ? await advanceCadence({
        agencyId,
        leadId,
        campaignId,
        fromStepIndex: meta.step_index ?? 0,
      })
    : null;

  if (result && !result.scheduled && result.reason === "max_attempts") {
    await db.from("leads").update({ status: "exhausted" }).eq("id", leadId);
    if (agency?.ghl_pit_enc && lead?.ghl_contact_id) {
      await pushExhaustedTag({ pitEnc: agency.ghl_pit_enc, locationId: agency.location_id, contactId: lead.ghl_contact_id });
    }
    await db.from("digest_events").insert({
      agency_id: agencyId,
      lead_id: leadId,
      type: "lead.exhausted",
      payload: {},
    });
  }

  return NextResponse.json({ ok: true, outcome, scheduled_next: result?.scheduled ?? false });
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
  agency_id?: string;
  campaign_id?: string;
  lead_id?: string;
  scheduled_call_id?: string;
  ghl_contact_id?: string;
  step_index?: number;
}
