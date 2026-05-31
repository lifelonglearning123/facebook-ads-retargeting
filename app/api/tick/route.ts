import { NextResponse } from "next/server";
import { APP } from "@/config";
import { searchByTag } from "@/lib/ghl/client";
import { leadStateFromContact, recordAttempt } from "@/lib/state";
import { fireStep } from "@/lib/dispatch";
import { runIntake } from "@/lib/intake";
import { getCampaign } from "@/lib/runtime-config";

export const runtime = "nodejs";
export const maxDuration = 60;

const NOW_TOLERANCE_MS = 30_000;

/**
 * Vercel cron hits this every minute. Two-pass: intake then dispatch.
 */
export async function GET(req: Request) {
  const secret = req.headers.get("X-Cron-Secret") ?? new URL(req.url).searchParams.get("secret");
  if (APP.cronSecret && secret !== APP.cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const campaign = await getCampaign();

  const intake = await runIntake(campaign).catch((err) => ({
    scanned: 0, started: 0, skipped: 0, failed: 1, error: String(err),
  }));

  const contacts = await searchByTag({ tag: APP.ghl.activeTag, pageLimit: 100 });
  const now = new Date();
  let fired = 0;
  let skipped = 0;
  let failed = 0;

  for (const contact of contacts) {
    const lead = leadStateFromContact(contact);

    if (!lead.nextAttemptAt) { skipped++; continue; }
    if (lead.nextAttemptAt.getTime() > now.getTime() + NOW_TOLERANCE_MS) { skipped++; continue; }
    if (["stopped", "engaged", "exhausted"].includes(lead.status)) { skipped++; continue; }
    if (lead.activeCallId) { skipped++; continue; }

    try {
      await fireStep(campaign, lead);
      fired++;
    } catch (err) {
      failed++;
      await recordAttempt(lead.contactId, {
        channel: "voice",
        outcome: `error:${String(err).slice(0, 200)}`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    intake,
    dispatch: { scanned: contacts.length, fired, skipped, failed },
    at: now.toISOString(),
  });
}
