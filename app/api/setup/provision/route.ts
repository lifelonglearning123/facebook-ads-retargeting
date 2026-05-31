import { NextResponse } from "next/server";
import { provisionFromSpec } from "@/lib/ghl/setup";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Provision the GHL location with the custom fields + tags defined in
 * snapshot/ghl-snapshot-spec.json. Idempotent — safe to re-run. Behind
 * basic auth via middleware (same as the dashboard).
 */
export async function POST() {
  try {
    const result = await provisionFromSpec();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
