import Link from "next/link";
import { DateTime } from "luxon";
import { APP, CAMPAIGN } from "@/config";
import { searchByTag } from "@/lib/ghl/client";
import { leadStateFromContact } from "@/lib/state";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const contacts = await searchByTag({ tag: APP.ghl.activeTag, pageLimit: 100 }).catch(() => []);
  const leads = contacts.map(leadStateFromContact).sort((a, b) => {
    const at = a.nextAttemptAt?.getTime() ?? 0;
    const bt = b.nextAttemptAt?.getTime() ?? 0;
    return at - bt;
  });

  return (
    <div>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Live queue</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {leads.length} active · max {CAMPAIGN.maxAttempts} attempts · agency tz {APP.agency.timezone}
          </p>
        </div>
        <span className="text-xs text-neutral-400">
          Updated {DateTime.now().setZone(APP.agency.timezone).toFormat("HH:mm")}
        </span>
      </header>

      <div className="mt-6 overflow-hidden rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Step</th>
              <th className="px-4 py-3">Attempts (V/S/E)</th>
              <th className="px-4 py-3">Next attempt</th>
              <th className="px-4 py-3">Last outcome</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const name = [l.firstName, l.lastName].filter(Boolean).join(" ") || "—";
              const next = l.nextAttemptAt
                ? DateTime.fromJSDate(l.nextAttemptAt).setZone(APP.agency.timezone).toFormat("d LLL HH:mm")
                : "—";
              return (
                <tr key={l.contactId} className="border-t border-neutral-200 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/lead/${l.contactId}`} className="font-medium hover:underline">{name}</Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{l.phone}</td>
                  <td className="px-4 py-3 capitalize">{l.status.replace("_", " ")}</td>
                  <td className="px-4 py-3">{l.stepIndex + 1}/{CAMPAIGN.cadence.length}</td>
                  <td className="px-4 py-3">{l.attempts.voice}/{l.attempts.sms}/{l.attempts.email}</td>
                  <td className="px-4 py-3 text-xs">{next}</td>
                  <td className="px-4 py-3 text-neutral-600">{l.lastOutcome ?? "—"}</td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                  No active leads. Trigger your GHL workflow to enqueue one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
