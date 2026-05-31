import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { CadenceSchema, QuietHoursSchema } from "@/lib/cadence/types";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(2).optional(),
  enabled: z.boolean().optional(),
  retell_agent_id: z.string().optional().nullable(),
  retell_phone_number: z.string().optional().nullable(),
  max_attempts: z.number().int().min(1).max(20).optional(),
  source_tag: z.string().min(1).optional(),
  cadence_json: CadenceSchema.optional(),
  quiet_hours_json: QuietHoursSchema.optional(),
  spread_hours: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  const { error } = await sb.from("campaigns").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { error } = await sb.from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
