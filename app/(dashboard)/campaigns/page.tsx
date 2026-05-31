import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export default async function CampaignsPage() {
  const sb = await supabaseServer();
  const { data: campaigns } = await sb
    .from("campaigns")
    .select("id, name, enabled, max_attempts, cadence_json, source_tag, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Link
          href="/campaigns/new"
          className="rounded-md bg-brand px-4 py-2 text-brand-fg"
        >
          New campaign
        </Link>
      </header>

      <div className="mt-6 overflow-hidden rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Tag</th>
              <th className="px-4 py-3">Steps</th>
              <th className="px-4 py-3">Max attempts</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(campaigns ?? []).map((c) => {
              const steps = Array.isArray(c.cadence_json) ? c.cadence_json.length : 0;
              return (
                <tr key={c.id} className="border-t border-neutral-200">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{c.source_tag}</code>
                  </td>
                  <td className="px-4 py-3">{steps}</td>
                  <td className="px-4 py-3">{c.max_attempts}</td>
                  <td className="px-4 py-3">
                    <span className={c.enabled ? "text-green-700" : "text-neutral-500"}>
                      {c.enabled ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/campaigns/${c.id}`} className="text-sm text-brand hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(!campaigns || campaigns.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-neutral-500">
                  No campaigns yet. Create one to start retargeting.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
