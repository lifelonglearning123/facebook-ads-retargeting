import Link from "next/link";
import type { LeadStatus } from "@/lib/state";

/**
 * Page header — display serif title + concise subhead + optional aside.
 *
 * The title supports an italicised accent word: pass `accent` separately
 * and it renders as Fraunces italic within the heading.
 */
export function PageHeader({
  eyebrow,
  title,
  accent,
  subtitle,
  aside,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="reveal flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-8 border-b border-[rgb(var(--line))]">
      <div>
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1
          className="text-[2.25rem] md:text-[3rem] leading-[1.05] tracking-[-0.015em]"
          style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
        >
          {title}
          {accent && (
            <>
              {" "}
              <span style={{ fontStyle: "italic", fontWeight: 300 }}>{accent}</span>
            </>
          )}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-[rgb(var(--ink-2))]">
            {subtitle}
          </p>
        )}
      </div>
      {aside && <div className="md:text-right shrink-0">{aside}</div>}
    </header>
  );
}

/** A simple section heading with optional helper text. */
export function SectionHeader({
  title,
  subtitle,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2
          className="text-[1.6rem] tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1.5 text-[0.93rem] text-[rgb(var(--ink-2))] max-w-xl">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}

/** Status pill — translates status code into plain English. */
export function StatusTag({ status }: { status: LeadStatus }) {
  switch (status) {
    case "queued":
      return (
        <span className="tag tag-waiting">
          <span className="dot" /> About to call
        </span>
      );
    case "in_progress":
      return (
        <span className="tag tag-active">
          <span className="dot live-dot" /> Calling now
        </span>
      );
    case "engaged":
      return (
        <span className="tag tag-picked">
          <span className="dot" /> Picked up
        </span>
      );
    case "exhausted":
      return (
        <span className="tag tag-stopped">
          <span className="dot" /> No answer · stopped
        </span>
      );
    case "stopped":
      return (
        <span className="tag tag-stopped">
          <span className="dot" /> Cancelled
        </span>
      );
  }
}

/** Translates last_outcome codes into plain language. */
export function OutcomeLabel({ outcome }: { outcome: string | null | undefined }) {
  if (!outcome) return <span className="text-[rgb(var(--ink-3))]">—</span>;

  const map: Record<string, { label: string; tone: "good" | "neutral" | "bad" }> = {
    answered: { label: "They answered", tone: "good" },
    sms_reply: { label: "They replied to SMS", tone: "good" },
    sms_sent: { label: "SMS sent", tone: "neutral" },
    email_sent: { label: "Email sent", tone: "neutral" },
    no_answer: { label: "Didn’t pick up", tone: "neutral" },
    voicemail: { label: "Hit voicemail", tone: "neutral" },
    busy: { label: "Line was busy", tone: "neutral" },
    failed: { label: "Call failed", tone: "bad" },
  };

  const m = map[outcome];
  if (!m) {
    // Fallback: show the raw outcome but humanised
    return (
      <span className="text-[rgb(var(--ink-2))]">
        {outcome.replaceAll("_", " ")}
      </span>
    );
  }

  const cls =
    m.tone === "good"
      ? "text-[rgb(var(--tag-picked-fg))]"
      : m.tone === "bad"
      ? "text-[rgb(var(--tag-stopped-fg))]"
      : "text-[rgb(var(--ink-2))]";
  return <span className={cls}>{m.label}</span>;
}

/** Helpful empty state with optional CTA. */
export function EmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="text-center py-16 px-6">
      <div
        aria-hidden
        className="mx-auto mb-5 h-10 w-10 rounded-full border border-[rgb(var(--line-strong))] flex items-center justify-center"
      >
        <span className="block h-1.5 w-1.5 rounded-full bg-[rgb(var(--ink-3))]" />
      </div>
      <p
        className="text-[1.25rem] tracking-tight text-[rgb(var(--ink))]"
        style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
      >
        {title}
      </p>
      {description && (
        <p className="mt-2 max-w-md mx-auto text-[0.93rem] text-[rgb(var(--ink-2))]">
          {description}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="btn-ghost inline-block mt-6 text-sm"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/** Big metric figure used in stat cards. */
export function Stat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="card p-5 md:p-6">
      <div className="eyebrow">{label}</div>
      <div
        className="mt-3 text-[2.6rem] leading-none tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
      >
        {value}
      </div>
      {helper && (
        <div className="mt-2 text-[0.83rem] text-[rgb(var(--ink-3))]">{helper}</div>
      )}
    </div>
  );
}
