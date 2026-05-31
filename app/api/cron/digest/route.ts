import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendDailyDigest } from "@/lib/digest";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Hit by Vercel Cron once per hour. For each agency whose local time is 09:00
 * (within the hour), send a digest to its primary recipient.
 */
export async function GET(req: Request) {
  const secret = req.headers.get("X-Cron-Secret") ?? new URL(req.url).searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: agencies } = await db
    .from("agencies")
    .select("id, name, timezone, brand_name, brand_logo_url, subscription_status");

  if (!agencies) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;
  for (const agency of agencies) {
    if (!["active", "trialing"].includes(agency.subscription_status)) continue;
    const localHour = DateTime.now().setZone(agency.timezone).hour;
    if (localHour !== 9) continue;

    // Recipient: the owner user's email
    const { data: owner } = await db
      .from("users")
      .select("email")
      .eq("agency_id", agency.id)
      .eq("role", "owner")
      .maybeSingle();
    if (!owner?.email) continue;

    try {
      const n = await sendDailyDigest(agency, owner.email);
      sent += n;
    } catch (err) {
      console.error("[digest] failed for", agency.id, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
