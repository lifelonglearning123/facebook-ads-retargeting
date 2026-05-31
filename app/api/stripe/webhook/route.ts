import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SUB_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sig || !secret || !sk) return NextResponse.json({ ok: false, error: "misconfigured" }, { status: 500 });

  const stripe = new Stripe(sk);
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json({ ok: false, error: `bad_signature: ${String(err)}` }, { status: 400 });
  }

  if (!SUB_EVENTS.has(event.type)) return NextResponse.json({ ok: true, ignored: event.type });

  const db = supabaseAdmin();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await db
        .from("agencies")
        .update({
          stripe_subscription_id: sub.id,
          subscription_status: mapStatus(sub.status),
        })
        .eq("stripe_customer_id", customerId);
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      if (customerId) {
        await db.from("agencies").update({ subscription_status: "past_due" }).eq("stripe_customer_id", customerId);
      }
      break;
    }
    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      if (customerId) {
        await db.from("agencies").update({ subscription_status: "active" }).eq("stripe_customer_id", customerId);
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

function mapStatus(s: Stripe.Subscription.Status): "trialing" | "active" | "past_due" | "canceled" | "inactive" {
  switch (s) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due":
    case "unpaid": return "past_due";
    case "canceled":
    case "incomplete_expired": return "canceled";
    default: return "inactive";
  }
}
