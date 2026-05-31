import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(2),
  location_id: z.string().min(2),
  timezone: z.string().min(3),
});

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: existingProfile } = await admin.from("users").select("agency_id").eq("id", user.id).maybeSingle();
  if (existingProfile?.agency_id) {
    return NextResponse.json({ ok: true, agency_id: existingProfile.agency_id, existing: true });
  }

  const { data: agency, error: agencyErr } = await admin
    .from("agencies")
    .insert({
      name: parsed.data.name,
      location_id: parsed.data.location_id,
      timezone: parsed.data.timezone,
      brand_name: parsed.data.name,
    })
    .select("id")
    .single();
  if (agencyErr || !agency) {
    return NextResponse.json({ error: "agency_create_failed", details: agencyErr?.message }, { status: 500 });
  }

  const { error: userErr } = await admin.from("users").insert({
    id: user.id,
    agency_id: agency.id,
    email: user.email ?? "",
    role: "owner",
  });
  if (userErr) return NextResponse.json({ error: "user_link_failed", details: userErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, agency_id: agency.id });
}
