import { NextResponse } from "next/server";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { GhlStartPayloadSchema } from "@/lib/ghl/webhook";
import { resolveLeadTimezone } from "@/lib/timezone";
import { nextAttemptAt } from "@/lib/cadence/schedule";
import { pickFirstStep } from "@/lib/cadence/advance";
import { APP } from "@/config";
import { enterCadence, loadLeadState, recordAttempt } from "@/lib/state";
import { fireStep } from "@/lib/dispatch";
import { removeTag } from "@/lib/ghl/client";
import { getCampaign } from "@/lib/runtime-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = GhlStartPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  const phone = parsePhoneNumberFromString(p.phone, "GB");
  if (!phone || !phone.isValid()) {
    return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }

  const campaign = await getCampaign();
  const first = pickFirstStep(campaign);
  if (!first) {
    return NextResponse.json({ ok: true, contact_id: p.contact_id, scheduled: false, reason: "empty_cadence" });
  }

  const leadTz = resolveLeadTimezone({
    ghlTimezone: p.timezone,
    phoneE164: phone.number,
    agencyTimezone: APP.agency.timezone,
  });

  const fireAt = nextAttemptAt(first.step, {
    baseline: new Date(),
    leadTz,
    quietHours: campaign.quietHours,
    spread: campaign.spreadHours,
    // First call after the FB click — the lead is awake, ring them now.
    bypassQuietHours: true,
  });

  await enterCadence(p.contact_id, first.stepIndex, fireAt, { sms: true, email: true });
  await removeTag(p.contact_id, APP.ghl.sourceTag).catch(() => {});

  const isDueNow = fireAt.getTime() <= Date.now() + 30_000;
  let fired = false;
  if (isDueNow) {
    const refreshed = await loadLeadState(p.contact_id);
    if (refreshed) {
      await fireStep(campaign, {
        ...refreshed,
        phone: phone.number,
        timezone: refreshed.timezone ?? leadTz,
      });
      fired = true;
    }
  } else {
    await recordAttempt(p.contact_id, {
      channel: first.step.channel,
      outcome: `queued_step_${first.stepIndex}`,
    });
  }

  return NextResponse.json({
    ok: true,
    contact_id: p.contact_id,
    step_index: first.stepIndex,
    channel: first.step.channel,
    next_attempt_at: fireAt.toISOString(),
    fired_inline: fired,
  });
}
