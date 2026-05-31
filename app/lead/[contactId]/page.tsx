import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { APP } from "@/config";
import { getContact, listNotes } from "@/lib/ghl/client";
import { leadStateFromContact } from "@/lib/state";
import { getCampaign } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const contact = await getContact(contactId);
  if (!contact) notFound();

  const [campaign, notes] = await Promise.all([
    getCampaign(),
    listNotes(contactId, 50).catch(() => []),
  ]);
  const lead = leadStateFromContact(contact);

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Lead";
  const next = lead.nextAttemptAt
    ? DateTime.fromJSDate(lead.nextAttemptAt).setZone(APP.agency.timezone).toFormat("d LLL yyyy HH:mm ZZZZ")
    : "—";

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="mt-1 text-neutral-600">{lead.phone} · {lead.email ?? "no email"}</p>
        <p className="mt-1 text-sm text-neutral-500">
          Status: <span className="capitalize">{lead.status.replace("_", " ")}</span> · Last outcome: {lead.lastOutcome ?? "—"}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Step {lead.stepIndex + 1}/{campaign.cadence.length} · Next at {next} · Voice {lead.attempts.voice}, SMS {lead.attempts.sms}, Email {lead.attempts.email}
        </p>
      </header>

      <section>
        <h2 className="text-lg font-medium">History (from GHL notes)</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {notes.length === 0 && <li className="text-neutral-500">No notes yet.</li>}
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-neutral-200 p-3">
              <div className="text-xs text-neutral-500">
                {DateTime.fromISO(n.createdAt).setZone(APP.agency.timezone).toFormat("d LLL HH:mm")}
              </div>
              <div className="mt-1 whitespace-pre-wrap text-neutral-800">{n.body}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
