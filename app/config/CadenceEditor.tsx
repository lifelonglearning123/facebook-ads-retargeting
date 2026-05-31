"use client";
import { useState } from "react";

type StepKind =
  | "immediate"
  | "wait_minutes"
  | "wait_hours"
  | "wait_days"
  | "specific_day_time"
  | "next_workday_at"
  | "next_workday_random";

interface UiStep {
  kind: StepKind;
  amount: number;
  atTime: string;
  randomFrom: string;
  randomTo: string;
}

type JsonStep = Record<string, unknown>;

interface Props {
  initialMaxAttempts: number;
  initialCadenceJson: string;
}

const DEFAULT_AT_TIME = "10:00";
const DEFAULT_RANDOM_FROM = "13:00";
const DEFAULT_RANDOM_TO = "17:00";

const KIND_LABELS: Record<StepKind, string> = {
  immediate: "Call straight away",
  wait_minutes: "Wait some minutes, then call",
  wait_hours: "Wait some hours, then call",
  wait_days: "Wait some days, then call",
  specific_day_time: "On a specific day at a specific time",
  next_workday_at: "Next working day at a specific time",
  next_workday_random: "Next working day, random time in a window",
};

const KIND_OPTIONS: StepKind[] = [
  "immediate",
  "wait_minutes",
  "wait_hours",
  "wait_days",
  "specific_day_time",
  "next_workday_at",
  "next_workday_random",
];

// ─── Conversion: JSON ↔ UI ─────────────────────────────────────────────────

function jsonToUi(step: JsonStep): UiStep {
  const base: UiStep = {
    kind: "immediate",
    amount: 5,
    atTime: DEFAULT_AT_TIME,
    randomFrom: DEFAULT_RANDOM_FROM,
    randomTo: DEFAULT_RANDOM_TO,
  };
  if ("delay" in step && typeof step.delay === "string") {
    const m = step.delay.match(/^(\d+)(min|h|d)$/i);
    if (m) {
      const n = Number(m[1]);
      const unit = m[2].toLowerCase();
      if (n === 0) return { ...base, kind: "immediate" };
      if (unit === "min") return { ...base, kind: "wait_minutes", amount: n };
      if (unit === "h") return { ...base, kind: "wait_hours", amount: n };
      return { ...base, kind: "wait_days", amount: n };
    }
  }
  if ("after" in step && typeof step.after === "string" && "at" in step && typeof step.at === "string") {
    const m = step.after.match(/^(\d+)d$/i);
    const n = m ? Number(m[1]) : 1;
    return { ...base, kind: "specific_day_time", amount: n, atTime: step.at };
  }
  if (step.rule === "next_business_day") {
    if ("at" in step && typeof step.at === "string") {
      return { ...base, kind: "next_workday_at", atTime: step.at };
    }
    if ("random_between" in step && Array.isArray(step.random_between)) {
      const [lo, hi] = step.random_between as [string, string];
      return { ...base, kind: "next_workday_random", randomFrom: lo, randomTo: hi };
    }
  }
  return base;
}

function uiToJson(ui: UiStep): JsonStep {
  switch (ui.kind) {
    case "immediate":
      return { channel: "voice", delay: "0min" };
    case "wait_minutes":
      return { channel: "voice", delay: `${Math.max(1, ui.amount)}min` };
    case "wait_hours":
      return { channel: "voice", delay: `${Math.max(1, ui.amount)}h` };
    case "wait_days":
      return { channel: "voice", delay: `${Math.max(1, ui.amount)}d` };
    case "specific_day_time":
      return { channel: "voice", after: `${Math.max(1, ui.amount)}d`, at: ui.atTime };
    case "next_workday_at":
      return { channel: "voice", rule: "next_business_day", at: ui.atTime };
    case "next_workday_random":
      return { channel: "voice", rule: "next_business_day", random_between: [ui.randomFrom, ui.randomTo] };
  }
}

function describe(ui: UiStep, isFirst: boolean): { headline: string; sub?: string } {
  switch (ui.kind) {
    case "immediate":
      return {
        headline: isFirst ? "Call them straight away" : "Call again straight after the previous attempt",
        sub: isFirst ? "The instant the lead is added to the queue." : undefined,
      };
    case "wait_minutes":
      return {
        headline: `Wait ${ui.amount} ${ui.amount === 1 ? "minute" : "minutes"}, then call`,
        sub: isFirst ? "Measured from when the lead arrives." : "Measured from the previous attempt.",
      };
    case "wait_hours":
      return {
        headline: `Wait ${ui.amount} ${ui.amount === 1 ? "hour" : "hours"}, then call`,
        sub: isFirst ? "Measured from when the lead arrives." : "Measured from the previous attempt.",
      };
    case "wait_days":
      return {
        headline: `Wait ${ui.amount} ${ui.amount === 1 ? "day" : "days"}, then call`,
        sub: isFirst ? "Measured from when the lead arrives." : "Measured from the previous attempt.",
      };
    case "specific_day_time":
      return {
        headline: `${ui.amount === 1 ? "Tomorrow" : `In ${ui.amount} days`} at ${ui.atTime}`,
        sub: `Time is in the lead’s own time zone, so a London lead will get a call at ${ui.atTime} London time.`,
      };
    case "next_workday_at":
      return {
        headline: `On the next working day, call at ${ui.atTime}`,
        sub: "Skips weekends. Time is in the lead’s time zone.",
      };
    case "next_workday_random":
      return {
        headline: `Next working day, anytime between ${ui.randomFrom} and ${ui.randomTo}`,
        sub: "A natural-looking time is picked at random inside the window — avoids calling at exactly the same hour every day.",
      };
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function CadenceEditor({ initialMaxAttempts, initialCadenceJson }: Props) {
  const initialUiSteps: UiStep[] = (() => {
    try {
      const parsed = JSON.parse(initialCadenceJson) as JsonStep[];
      return parsed.map(jsonToUi);
    } catch {
      return [{ kind: "immediate", amount: 5, atTime: DEFAULT_AT_TIME, randomFrom: DEFAULT_RANDOM_FROM, randomTo: DEFAULT_RANDOM_TO }];
    }
  })();

  const [maxAttempts, setMaxAttempts] = useState(initialMaxAttempts);
  const [steps, setSteps] = useState<UiStep[]>(initialUiSteps);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function updateStep(i: number, patch: Partial<UiStep>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addStep() {
    setSteps((prev) => [
      ...prev,
      { kind: "wait_minutes", amount: 5, atTime: DEFAULT_AT_TIME, randomFrom: DEFAULT_RANDOM_FROM, randomTo: DEFAULT_RANDOM_TO },
    ]);
  }

  async function save() {
    setSaving(true);
    setResult(null);
    const cadence = steps.map(uiToJson);
    try {
      const res = await fetch("/api/config/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxAttempts, cadence }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setResult({ ok: false, message: `Couldn’t save: ${json.error ?? "unknown error"}` });
      } else {
        setResult({ ok: true, message: "Saved. The new schedule applies within 60 seconds." });
      }
    } catch (err) {
      setResult({ ok: false, message: `Network error: ${String(err)}` });
    } finally {
      setSaving(false);
    }
  }

  const effectiveMax = Math.min(maxAttempts, steps.length);

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] items-start gap-4 md:gap-8">
        <div>
          <label
            htmlFor="max-attempts"
            className="eyebrow"
          >
            Maximum calls
          </label>
          <input
            id="max-attempts"
            type="number"
            min={1}
            max={20}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
            className="field mt-2 w-24 text-[1.5rem] text-center"
            style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
          />
        </div>
        <p className="text-[0.93rem] text-[rgb(var(--ink-2))] mt-1">
          We’ll stop after this many call attempts even if the lead never picks up. You’ve set up
          <span className="text-[rgb(var(--ink))]"> {steps.length} step{steps.length === 1 ? "" : "s"}</span>{" "}
          below — so in practice the limit is{" "}
          <span className="text-[rgb(var(--ink))]">{effectiveMax} call{effectiveMax === 1 ? "" : "s"}</span>.
        </p>
      </div>

      <div className="hairline" />

      <div>
        <div className="flex items-baseline justify-between mb-4">
          <div className="eyebrow">Call sequence</div>
          <button
            type="button"
            onClick={addStep}
            className="btn-ghost text-sm"
          >
            + Add another call
          </button>
        </div>

        <ol className="space-y-4">
          {steps.map((s, i) => (
            <StepCard
              key={i}
              index={i}
              total={steps.length}
              step={s}
              onUpdate={(patch) => updateStep(i, patch)}
              onRemove={() => removeStep(i)}
              onMoveUp={() => moveStep(i, -1)}
              onMoveDown={() => moveStep(i, 1)}
            />
          ))}
          {steps.length === 0 && (
            <li className="card border-dashed p-8 text-center">
              <p
                className="text-[1.15rem] text-[rgb(var(--ink))]"
                style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
              >
                No calls scheduled yet
              </p>
              <p className="mt-2 text-[0.92rem] text-[rgb(var(--ink-2))]">
                Click <em>Add another call</em> above to create the first one.
              </p>
            </li>
          )}
        </ol>
      </div>

      <div className="hairline" />

      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:justify-between">
        <button
          type="button"
          onClick={save}
          disabled={saving || steps.length === 0}
          className="btn-primary"
        >
          {saving ? "Saving…" : "Save calling schedule"}
        </button>
        {result && (
          <span
            className={`text-sm ${
              result.ok ? "text-[rgb(var(--tag-picked-fg))]" : "text-[rgb(var(--tag-stopped-fg))]"
            }`}
          >
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Step card ─────────────────────────────────────────────────────────────

function StepCard({
  index,
  total,
  step,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  total: number;
  step: UiStep;
  onUpdate: (patch: Partial<UiStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const desc = describe(step, index === 0);

  return (
    <li className="card p-5 md:p-6">
      <div className="flex gap-4 md:gap-6">
        <div className="shrink-0 pt-1">
          <div
            className="h-9 w-9 rounded-full border border-[rgb(var(--line-strong))] flex items-center justify-center"
            style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
            aria-hidden
          >
            {index + 1}
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="eyebrow mb-1">Call {index + 1} of {total}</div>
            <h3
              className="text-[1.2rem] leading-snug tracking-tight"
              style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
            >
              {desc.headline}
            </h3>
            {desc.sub && (
              <p className="mt-1 text-[0.88rem] text-[rgb(var(--ink-3))]">{desc.sub}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <select
              value={step.kind}
              onChange={(e) => onUpdate({ kind: e.target.value as StepKind })}
              className="field w-full md:max-w-md text-[0.92rem]"
              aria-label={`Type of call ${index + 1}`}
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>{KIND_LABELS[k]}</option>
              ))}
            </select>

            {renderInputs(step, onUpdate)}
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-1.5 items-end">
          <IconButton onClick={onMoveUp} disabled={index === 0} label="Move up">
            ↑
          </IconButton>
          <IconButton onClick={onMoveDown} disabled={index === total - 1} label="Move down">
            ↓
          </IconButton>
          <IconButton onClick={onRemove} danger label="Remove">
            ✕
          </IconButton>
        </div>
      </div>
    </li>
  );
}

function IconButton({
  onClick,
  disabled,
  danger,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`h-7 w-7 rounded-md border text-[0.8rem] flex items-center justify-center transition-colors ${
        danger
          ? "border-[rgb(var(--tag-stopped-edge))] text-[rgb(var(--tag-stopped-fg))] hover:bg-[rgb(var(--tag-stopped-bg))]"
          : "border-[rgb(var(--line))] text-[rgb(var(--ink-2))] hover:bg-[rgb(var(--paper-deep))]"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function renderInputs(s: UiStep, set: (patch: Partial<UiStep>) => void): React.ReactNode {
  if (s.kind === "immediate") {
    return (
      <p className="text-[0.85rem] text-[rgb(var(--ink-3))]">
        No timing to set — the call goes out the moment we’re ready.
      </p>
    );
  }

  if (s.kind === "wait_minutes" || s.kind === "wait_hours" || s.kind === "wait_days") {
    const unitLabel =
      s.kind === "wait_minutes" ? "minutes" : s.kind === "wait_hours" ? "hours" : "days";
    return (
      <Row>
        <span className="text-[rgb(var(--ink-2))]">Wait</span>
        <input
          type="number"
          min={1}
          max={s.kind === "wait_minutes" ? 1440 : s.kind === "wait_hours" ? 168 : 30}
          value={s.amount}
          onChange={(e) => set({ amount: Math.max(1, Number(e.target.value)) })}
          className="field w-20 text-center"
        />
        <span className="text-[rgb(var(--ink-2))]">{unitLabel}</span>
      </Row>
    );
  }

  if (s.kind === "specific_day_time") {
    return (
      <Row>
        <span className="text-[rgb(var(--ink-2))]">In</span>
        <input
          type="number"
          min={1}
          max={30}
          value={s.amount}
          onChange={(e) => set({ amount: Math.max(1, Number(e.target.value)) })}
          className="field w-20 text-center"
        />
        <span className="text-[rgb(var(--ink-2))]">days, at</span>
        <input
          type="time"
          value={s.atTime}
          onChange={(e) => set({ atTime: e.target.value })}
          className="field"
        />
      </Row>
    );
  }

  if (s.kind === "next_workday_at") {
    return (
      <Row>
        <span className="text-[rgb(var(--ink-2))]">At</span>
        <input
          type="time"
          value={s.atTime}
          onChange={(e) => set({ atTime: e.target.value })}
          className="field"
        />
      </Row>
    );
  }

  if (s.kind === "next_workday_random") {
    return (
      <Row>
        <span className="text-[rgb(var(--ink-2))]">Between</span>
        <input
          type="time"
          value={s.randomFrom}
          onChange={(e) => set({ randomFrom: e.target.value })}
          className="field"
        />
        <span className="text-[rgb(var(--ink-2))]">and</span>
        <input
          type="time"
          value={s.randomTo}
          onChange={(e) => set({ randomTo: e.target.value })}
          className="field"
        />
      </Row>
    );
  }

  return null;
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[0.95rem]">
      {children}
    </div>
  );
}
