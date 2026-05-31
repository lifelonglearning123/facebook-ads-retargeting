import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

const STATUSES = ["queued", "in_progress", "engaged", "exhausted", "stopped"] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const sb = await supabaseServer();

  let q = sb
    .from("leads")
    .select("id, first_name, last_name, phone_e164, status, attempts_voice, attempts_sms, attempts_email, last_outcome, updated_at, campaigns(name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (sp.status) q = q.eq("status", sp.status);

  const { data: leads } = await q;

  return (
    <div>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="flex gap-1">
          <Link
            href="/leads"
            className={`rounded-md border px-3 py-1 text-sm ${!sp.status ? "border-brand bg-brand text-brand-fg" : "border-neutral-300"}`}
          >
            All
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/leads?status=${s}`}
              className={`rounded-md border px-3 py-1 text-sm capitalize ${sp.status === s ? "border-brand bg-brand text-brand-fg" : "border-neutral-300"}`}
            >
              {s.replace("_", " ")}
            </Link>
          ))}
        </div>
      </header>

      <div className="mt-6 overflow-hidden rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts (V/S/E)</th>
              <th className="px-4 py-3">Last outcome</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((l) => {
              const name = [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";
              const campaignName = Array.isArray(l.campaigns) ? l.campaigns[0]?.name : (l.campaigns as { name: string } | null)?.name;
              return (
                <tr key={l.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium hover:underline">{name}</Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{l.phone_e164}</td>
                  <td className="px-4 py-3">{campaignName ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{l.status.replace("_", " ")}</td>
                  <td className="px-4 py-3">{l.attempts_voice}/{l.attempts_sms}/{l.attempts_email}</td>
                  <td className="px-4 py-3 text-neutral-600">{l.last_outcome ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{new Date(l.updated_at).toLocaleString()}</td>
                </tr>
              );
            })}
            {(!leads || leads.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">No leads yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
