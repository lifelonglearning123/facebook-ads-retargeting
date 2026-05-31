import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CadenceSchema, QuietHoursSchema } from "@/lib/cadence/types";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(2),
  enabled: z.boolean().default(true),
  retell_agent_id: z.string().optional().nullable(),
  retell_phone_number: z.string().optional().nullable(),
  max_attempts: z.number().int().min(1).max(20),
  source_tag: z.string().min(1),
  cadence_json: CadenceSchema,
  quiet_hours_json: QuietHoursSchema,
  spread_hours: z.boolean().default(true),
});

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });

  const { data: profile } = await sb.from("users").select("agency_id").single();
  if (!profile) return NextResponse.json({ error: "no_agency" }, { status: 400 });

  const { data, error } = await sb
    .from("campaigns")
    .insert({ agency_id: profile.agency_id, ...parsed.data })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
