import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(2),
  channel: z.enum(["sms", "email"]),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
});

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { data: profile } = await sb.from("users").select("agency_id").single();
  if (!profile) return NextResponse.json({ error: "no_agency" }, { status: 400 });
  const { data, error } = await sb.from("templates").insert({ agency_id: profile.agency_id, ...parsed.data }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
