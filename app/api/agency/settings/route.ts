import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(2).optional(),
  timezone: z.string().min(3).optional(),
  concurrency_cap: z.number().int().min(1).max(50).optional(),
  brand_name: z.string().optional().nullable(),
  brand_logo_url: z.string().url().optional().nullable().or(z.literal("").transform(() => null)),
  twilio_account_sid: z.string().optional(),
  twilio_auth_token: z.string().optional(),
  retell_api_key: z.string().optional(),
  ghl_pit: z.string().optional(),
});

export async function PATCH(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { data: profile } = await sb.from("users").select("agency_id, role").single();
  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const admin = supabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.timezone !== undefined) patch.timezone = b.timezone;
  if (b.concurrency_cap !== undefined) patch.concurrency_cap = b.concurrency_cap;
  if (b.brand_name !== undefined) patch.brand_name = b.brand_name;
  if (b.brand_logo_url !== undefined) patch.brand_logo_url = b.brand_logo_url;
  if (b.twilio_account_sid) patch.twilio_account_sid_enc = encrypt(b.twilio_account_sid);
  if (b.twilio_auth_token) patch.twilio_auth_token_enc = encrypt(b.twilio_auth_token);
  if (b.retell_api_key) patch.retell_api_key_enc = encrypt(b.retell_api_key);
  if (b.ghl_pit) patch.ghl_pit_enc = encrypt(b.ghl_pit);

  const { error } = await admin.from("agencies").update(patch).eq("id", profile.agency_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
