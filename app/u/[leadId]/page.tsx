import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export default async function UnsubscribePage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const db = supabaseAdmin();

  const { data: lead } = await db.from("leads").select("id, agency_id, first_name").eq("id", leadId).maybeSingle();
  if (!lead) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Unsubscribe link expired</h1>
      </main>
    );
  }

  await db.from("leads").update({ email_consent: false, status: "stopped", last_outcome: "email_unsubscribed" }).eq("id", leadId);
  await db.from("scheduled_messages").update({ status: "cancelled" }).eq("lead_id", leadId).eq("status", "queued").eq("channel", "email");
  await db.from("digest_events").insert({
    agency_id: lead.agency_id,
    lead_id: leadId,
    type: "email.unsubscribed",
    payload: {},
  });

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">You&apos;ve been unsubscribed</h1>
      <p className="mt-3 text-neutral-600">We won&apos;t send you any more emails. You may still receive SMS or calls unless you reply STOP.</p>
    </main>
  );
}
