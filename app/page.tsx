import Link from "next/link";
import { DateTime } from "luxon";
import { APP } from "@/config";
import { searchByTag } from "@/lib/ghl/client";
import { leadStateFromContact } from "@/lib/state";
import { getCampaign } from "@/lib/runtime-config";
import {
  EmptyState,
  OutcomeLabel,
  PageHeader,
  Stat,
  StatusTag,
} from "@/components/presentational";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [activeContacts, engagedContacts, campaign] = await Promise.all([
    searchByTag({ tag: APP.ghl.activeTag, pageLimit: 100 }).catch(() => []),
    searchByTag({ tag: APP.ghl.engagedTag, pageLimit: 100 }).catch(() => []),
    getCampaign(),
  ]);

  const leads = activeContacts
    .map(leadStateFromContact)
    .sort((a, b) => (a.nextAttemptAt?.getTime() ?? 0) - (b.nextAttemptAt?.getTime() ?? 0));

  const totalCallsSoFar = leads.reduce((sum, l) => sum + l.attempts.voice, 0);
  const callsNeededTotal = leads.length * campaign.cadence.length;
  const pickedUpCount = engagedContacts.length;
  const updatedAt = DateTime.now().setZone(APP.agency.timezone).toFormat("HH:mm");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Live"
        title="Who we’re"
        accent="calling now"
        subtitle="Every Facebook lead currently being dialled by the AI agent. The list refreshes when you reload the page."
        aside={
          <div className="text-[0.85rem] text-[rgb(var(--ink-3))]">
            Updated <span className="text-[rgb(var(--ink))]">{updatedAt}</span>
            <div className="mt-0.5">{APP.agency.timezone.replace("_", " ")}</div>
          </div>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 reveal reveal-d1">
        <Stat
          label="In the queue"
          value={leads.length}
          helper={leads.length === 1 ? "lead being worked" : "leads being worked"}
        />
        <Stat
          label="Calls made so far"
          value={totalCallsSoFar}
          helper={callsNeededTotal ? `of up to ${callsNeededTotal} attempts` : "no attempts yet"}
        />
        <Stat
          label="Picked up (all-time)"
          value={pickedUpCount}
          helper={pickedUpCount === 1 ? "lead spoke to the agent" : "leads spoke to the agent"}
        />
      </section>

      <section className="reveal reveal-d2">
        {leads.length === 0 ? (
          <div className="card">
            <EmptyState
              title="No one is in the queue right now"
              description={
                "To start a campaign, open GoHighLevel, find a contact who agreed to be called, and add the tag “ai-callback” to them. The system will pick them up within 60 seconds."
              }
              cta={{ href: "/config", label: "Review calling schedule" }}
            />
          </div>
        ) : (
          <LeadsTable leads={leads} totalSteps={campaign.cadence.length} />
        )}
      </section>
    </div>
  );
}

function LeadsTable({
  leads,
  totalSteps,
}: {
  leads: ReturnType<typeof leadStateFromContact>[];
  totalSteps: number;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[rgb(var(--line))]">
        <div className="eyebrow col-span-4">Lead</div>
        <div className="eyebrow col-span-2">Status</div>
        <div className="eyebrow col-span-2">Progress</div>
        <div className="eyebrow col-span-2">Next call</div>
        <div className="eyebrow col-span-2">Last result</div>
      </div>

      <ul>
        {leads.map((l, i) => {
          const name = [l.firstName, l.lastName].filter(Boolean).join(" ") || "Unnamed lead";
          const next = l.nextAttemptAt
            ? DateTime.fromJSDate(l.nextAttemptAt)
                .setZone(APP.agency.timezone)
                .toFormat("d LLL, HH:mm")
            : "—";
          const callsMade = l.attempts.voice;
          const totalCalls = totalSteps;
          const progressPct = totalCalls > 0 ? Math.min(100, ((l.stepIndex) / totalCalls) * 100) : 0;

          return (
            <li
              key={l.contactId}
              className={`grid grid-cols-12 gap-4 px-6 py-5 items-center transition-colors hover:bg-[rgb(var(--paper-deep))] ${
                i !== leads.length - 1 ? "border-b border-[rgb(var(--line))]" : ""
              }`}
            >
              <div className="col-span-4">
                <Link href={`/lead/${l.contactId}`} className="group block">
                  <div
                    className="text-[1.1rem] tracking-tight text-[rgb(var(--ink))] group-hover:underline decoration-[rgb(var(--line-strong))] underline-offset-4"
                    style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
                  >
                    {name}
                  </div>
                  <div
                    className="mt-1 text-[0.82rem] text-[rgb(var(--ink-3))]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {prettifyPhone(l.phone)}
                  </div>
                </Link>
              </div>

              <div className="col-span-2">
                <StatusTag status={l.status} />
              </div>

              <div className="col-span-2">
                <div className="text-[0.9rem] text-[rgb(var(--ink-2))]">
                  Call <span className="text-[rgb(var(--ink))]">{callsMade}</span> of {totalCalls}
                </div>
                <div className="mt-1.5 h-[3px] w-full rounded-full bg-[rgb(var(--paper-deep))] overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${progressPct}%`,
                      background: "rgb(var(--ink))",
                    }}
                  />
                </div>
              </div>

              <div className="col-span-2 text-[0.9rem] text-[rgb(var(--ink-2))]">
                <span style={{ fontFamily: "var(--font-mono)" }}>{next}</span>
              </div>

              <div className="col-span-2 text-[0.9rem]">
                <OutcomeLabel outcome={l.lastOutcome} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function prettifyPhone(e164: string): string {
  if (!e164) return "";
  // Group into chunks for readability. Doesn't replace E.164 — just spaces.
  // e.g. "+447861235406" -> "+44 7861 235 406"
  const m = e164.match(/^(\+\d{1,3})(\d{3,4})(\d{3})(\d+)$/);
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return e164;
}
