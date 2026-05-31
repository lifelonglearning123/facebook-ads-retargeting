import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { APP } from "@/config";
import { getContact, listNotes } from "@/lib/ghl/client";
import { leadStateFromContact } from "@/lib/state";
import { getCampaign } from "@/lib/runtime-config";
import { PageHeader, SectionHeader, StatusTag } from "@/components/presentational";

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
    ? DateTime.fromJSDate(lead.nextAttemptAt).setZone(APP.agency.timezone).toFormat("d LLL yyyy, HH:mm")
    : null;

  // Notes from GHL come newest first — we want oldest first for a journey view.
  const events = [...notes]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((n) => decorateEvent(n));

  return (
    <div className="space-y-10">
      <div className="reveal">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[0.85rem] text-[rgb(var(--ink-3))] hover:text-[rgb(var(--ink))]"
        >
          <span aria-hidden>←</span> Back to queue
        </Link>
      </div>

      <PageHeader
        eyebrow="Lead"
        title={name}
        subtitle="Everything we’ve done with this lead so far."
        aside={<StatusTag status={lead.status} />}
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 reveal reveal-d1">
        <DetailCard
          eyebrow="Phone"
          value={prettifyPhone(lead.phone)}
          mono
        />
        <DetailCard
          eyebrow="Email"
          value={lead.email || "Not provided"}
          subtle={!lead.email}
        />
        <DetailCard
          eyebrow="Their time zone"
          value={lead.timezone ? lead.timezone.replace("_", " ") : "—"}
          subtle={!lead.timezone}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-5 reveal reveal-d2">
        <DetailCard
          eyebrow="Calls made"
          value={String(lead.attempts.voice)}
          big
        />
        <DetailCard
          eyebrow="Now on call"
          value={`${lead.stepIndex + 1} of ${campaign.cadence.length}`}
          big
        />
        <DetailCard
          eyebrow="Next call at"
          value={next ?? "No more calls scheduled"}
          subtle={!next}
          mono={!!next}
        />
        <DetailCard
          eyebrow="What happened last time"
          value={prettyOutcome(lead.lastOutcome)}
          subtle={!lead.lastOutcome}
        />
      </section>

      <section className="reveal reveal-d3">
        <SectionHeader
          title="The journey"
          subtitle="Each event that's happened with this lead, oldest at the top."
        />

        {events.length === 0 ? (
          <div className="card p-8 text-center text-[rgb(var(--ink-3))]">
            Nothing yet. As soon as the first call is placed, events will appear here.
          </div>
        ) : (
          <ol className="relative pl-8">
            {/* Vertical guide line */}
            <span
              className="absolute left-[7px] top-2 bottom-2 w-px"
              style={{ background: "rgb(var(--line))" }}
              aria-hidden
            />
            {events.map((e, i) => (
              <li key={i} className="relative pb-7 last:pb-0">
                <span
                  className={`absolute -left-[18px] top-[6px] inline-block h-[10px] w-[10px] rounded-full ring-4 ring-[rgb(var(--paper))]`}
                  style={{ background: `rgb(${e.dotColor})` }}
                  aria-hidden
                />
                <div className="text-[0.8rem] text-[rgb(var(--ink-3))] mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                  {DateTime.fromISO(e.at).setZone(APP.agency.timezone).toFormat("d LLL · HH:mm")}
                </div>
                <div
                  className="text-[1.05rem] tracking-tight"
                  style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
                >
                  {e.title}
                </div>
                {e.detail && (
                  <div className="mt-1 text-[0.9rem] text-[rgb(var(--ink-2))]">{e.detail}</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function DetailCard({
  eyebrow,
  value,
  big,
  mono,
  subtle,
}: {
  eyebrow: string;
  value: string;
  big?: boolean;
  mono?: boolean;
  subtle?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="eyebrow">{eyebrow}</div>
      <div
        className={`mt-2 ${big ? "text-[1.8rem] tracking-[-0.02em]" : "text-[1.05rem]"} ${
          subtle ? "text-[rgb(var(--ink-3))]" : "text-[rgb(var(--ink))]"
        }`}
        style={{
          fontFamily: big
            ? "var(--font-fraunces)"
            : mono
            ? "var(--font-mono)"
            : "var(--font-geist), system-ui, sans-serif",
          fontWeight: big ? 400 : 500,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// =============================================================================
// Event decoration — translate raw note bodies into journey-readable entries.
// =============================================================================
interface NoteRow {
  id: string;
  body: string;
  createdAt: string;
}

interface DecoratedEvent {
  at: string;
  title: string;
  detail?: string;
  dotColor: string; // "47 88 38"
}

function decorateEvent(n: NoteRow): DecoratedEvent {
  const text = n.body || "";
  const base = { at: n.createdAt, dotColor: "var(--ink-3)".replace("var(--", "").replace(")", "") };
  // Reasonable defaults: muted dot
  const fallback: DecoratedEvent = { at: n.createdAt, title: text, dotColor: "124 119 132" };

  if (/intake_queued_step_(\d+)/.test(text)) {
    return { ...fallback, title: "Queued for first call", dotColor: "162 148 122", detail: "Added to the calling list — first attempt scheduled." };
  }
  if (/intake_skipped:invalid_phone/.test(text)) {
    return { ...fallback, title: "Skipped — phone number isn't valid", dotColor: "188 116 108" };
  }
  if (/intake_skipped:/.test(text)) {
    return { ...fallback, title: "Skipped at intake", dotColor: "188 116 108", detail: text.replace(/^AI VOICE — /, "") };
  }
  if (/intake_failed:/.test(text)) {
    return { ...fallback, title: "Couldn't add to the call list", dotColor: "188 116 108", detail: text.replace(/^AI VOICE — intake_failed:/, "") };
  }
  if (/AI VOICE — placed/.test(text)) {
    return { ...fallback, title: "Call placed", dotColor: "213 165 96", detail: "AI agent is dialling them now." };
  }
  if (/answered · (\d+)s/.test(text)) {
    const m = text.match(/answered · (\d+)s/);
    const secs = m ? Number(m[1]) : 0;
    return {
      ...fallback,
      title: secs >= 15 ? "Picked up & engaged" : "Picked up briefly",
      dotColor: secs >= 15 ? "124 165 96" : "162 148 122",
      detail: `Stayed on the line for ${secs} second${secs === 1 ? "" : "s"}${
        secs >= 15 ? " — long enough to count as engaged." : " — hung up before engaging."
      }`,
    };
  }
  if (/no_answer/.test(text)) {
    return { ...fallback, title: "Didn’t pick up", detail: "The call rang out without an answer.", dotColor: "162 148 122" };
  }
  if (/voicemail/.test(text)) {
    return { ...fallback, title: "Reached voicemail", dotColor: "150 130 180" };
  }
  if (/busy/.test(text)) {
    return { ...fallback, title: "Line was busy", dotColor: "162 148 122" };
  }
  if (/failed/.test(text)) {
    return { ...fallback, title: "Call failed", dotColor: "188 116 108", detail: "The call couldn't be connected." };
  }
  if (/stopped:/.test(text)) {
    return { ...fallback, title: "Cadence cancelled", dotColor: "188 116 108", detail: "Calls for this lead were stopped." };
  }
  if (/AI (SMS|EMAIL)/.test(text)) {
    return { ...fallback, title: text.replace(/^AI /, ""), dotColor: "162 148 122" };
  }
  // Anything else — show it cleanly
  return { ...fallback, title: text.replace(/^AI VOICE — /, "") };
}

function prettyOutcome(o: string | null): string {
  if (!o) return "Hasn't happened yet";
  const map: Record<string, string> = {
    answered: "They answered",
    no_answer: "Didn't pick up",
    voicemail: "Reached voicemail",
    busy: "Line was busy",
    failed: "Call failed",
    sms_sent: "SMS sent",
    sms_reply: "Replied to SMS",
    email_sent: "Email sent",
  };
  return map[o] ?? o.replaceAll("_", " ");
}

function prettifyPhone(e164: string): string {
  if (!e164) return "—";
  const m = e164.match(/^(\+\d{1,3})(\d{3,4})(\d{3})(\d+)$/);
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return e164;
}
