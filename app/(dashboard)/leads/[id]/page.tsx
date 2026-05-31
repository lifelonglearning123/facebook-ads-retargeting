import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: lead } = await sb
    .from("leads")
    .select("id, first_name, last_name, phone_e164, email, status, timezone, sms_consent, email_consent, attempts_voice, attempts_sms, attempts_email, last_outcome, created_at, campaigns(name)")
    .eq("id", id)
    .maybeSingle();
  if (!lead) notFound();

  const [{ data: calls }, { data: messages }, { data: queuedCalls }, { data: queuedMsgs }] = await Promise.all([
    sb.from("call_attempts").select("started_at, ended_at, duration_s, outcome, transcript_url").eq("lead_id", id).order("started_at", { ascending: false }),
    sb.from("message_attempts").select("sent_at, channel, outcome, body_snapshot").eq("lead_id", id).order("sent_at", { ascending: false }),
    sb.from("scheduled_calls").select("id, next_attempt_at, step_index, status").eq("lead_id", id).eq("status", "queued"),
    sb.from("scheduled_messages").select("id, next_attempt_at, step_index, channel, status").eq("lead_id", id).eq("status", "queued"),
  ]);

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Lead";
  const campaignName = Array.isArray(lead.campaigns) ? lead.campaigns[0]?.name : (lead.campaigns as { name: string } | null)?.name;

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="mt-1 text-neutral-600">
          {lead.phone_e164} · {lead.email ?? "no email"} · {campaignName ?? "—"} · {lead.timezone}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Status: <span className="capitalize">{lead.status.replace("_", " ")}</span> · Last outcome: {lead.last_outcome ?? "—"}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Attempts — Voice {lead.attempts_voice}, SMS {lead.attempts_sms}, Email {lead.attempts_email}
        </p>
      </header>

      <section>
        <h2 className="text-lg font-medium">Queued next steps</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(queuedCalls ?? []).map((q) => (
            <li key={q.id}>Voice — {new Date(q.next_attempt_at).toLocaleString()} (step {q.step_index})</li>
          ))}
          {(queuedMsgs ?? []).map((q) => (
            <li key={q.id}>{q.channel} — {new Date(q.next_attempt_at).toLocaleString()} (step {q.step_index})</li>
          ))}
          {(!queuedCalls?.length && !queuedMsgs?.length) && <li className="text-neutral-500">Nothing queued.</li>}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">Call history</h2>
        <div className="mt-2 overflow-hidden rounded-md border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Transcript</th>
              </tr>
            </thead>
            <tbody>
              {(calls ?? []).map((c, i) => (
                <tr key={i} className="border-t border-neutral-200">
                  <td className="px-3 py-2">{new Date(c.started_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{c.duration_s ?? "—"}s</td>
                  <td className="px-3 py-2">{c.outcome ?? "—"}</td>
                  <td className="px-3 py-2">
                    {c.transcript_url ? <a href={c.transcript_url} className="text-brand hover:underline" target="_blank" rel="noreferrer">View</a> : "—"}
                  </td>
                </tr>
              ))}
              {(!calls || calls.length === 0) && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-500">No calls yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Message history</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {(messages ?? []).map((m, i) => (
            <li key={i} className="rounded-md border border-neutral-200 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                {m.channel} · {m.outcome ?? "—"} · {new Date(m.sent_at).toLocaleString()}
              </div>
              <div className="mt-1 whitespace-pre-wrap text-neutral-800">{m.body_snapshot}</div>
            </li>
          ))}
          {(!messages || messages.length === 0) && <li className="text-neutral-500">No messages yet.</li>}
        </ul>
      </section>
    </div>
  );
}
