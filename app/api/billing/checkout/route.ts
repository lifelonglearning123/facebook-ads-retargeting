import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST() {
  const sk = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!sk || !priceId) return NextResponse.json({ error: "stripe_misconfigured" }, { status: 500 });

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("users").select("agency_id").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "no_agency" }, { status: 400 });

  const { data: agency } = await admin
    .from("agencies")
    .select("id, name, stripe_customer_id")
    .eq("id", profile.agency_id)
    .single();
  if (!agency) return NextResponse.json({ error: "agency_missing" }, { status: 400 });

  const stripe = new Stripe(sk);

  let customerId = agency.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: agency.name,
      metadata: { agency_id: agency.id },
    });
    customerId = customer.id;
    await admin.from("agencies").update({ stripe_customer_id: customerId }).eq("id", agency.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?checkout=cancel`,
  });

  return NextResponse.json({ url: session.url });
}
