import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST() {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.json({ error: "stripe_misconfigured" }, { status: 500 });

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("users").select("agency_id").eq("id", user.id).single();
  const { data: agency } = await admin
    .from("agencies")
    .select("stripe_customer_id")
    .eq("id", profile?.agency_id ?? "")
    .maybeSingle();

  if (!agency?.stripe_customer_id) return NextResponse.json({ error: "no_customer" }, { status: 400 });

  const stripe = new Stripe(sk);
  const portal = await stripe.billingPortal.sessions.create({
    customer: agency.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });
  return NextResponse.json({ url: portal.url });
}
