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
  amount: number;       // minutes, hours, or days depending on kind
  atTime: string;       // HH:MM
  randomFrom: string;   // HH:MM
  randomTo: string;     // HH:MM
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
  wait_minutes: "Wait X minutes, then call",
  wait_hours: "Wait X hours, then call",
  wait_days: "Wait X days, then call",
  specific_day_time: "X days from now at a specific time",
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

// ─── Conversion: JSON ↔ UI ──────────────────────────────────────────────────

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

function describe(ui: UiStep): string {
  switch (ui.kind) {
    case "immediate":
      return "📞 Call straight away";
    case "wait_minutes":
      return `⏱ Wait ${ui.amount} minute${ui.amount === 1 ? "" : "s"} after previous attempt, then call`;
    case "wait_hours":
      return `⏱ Wait ${ui.amount} hour${ui.amount === 1 ? "" : "s"} after previous attempt, then call`;
    case "wait_days":
      return `⏱ Wait ${ui.amount} day${ui.amount === 1 ? "" : "s"} after previous attempt, then call`;
    case "specific_day_time":
      return `📅 ${ui.amount === 1 ? "Tomorrow" : `In ${ui.amount} days`} at ${ui.atTime}, call`;
    case "next_workday_at":
      return `🗓 Next working day at ${ui.atTime}, call`;
    case "next_workday_random":
      return `🎲 Next working day, random time between ${ui.randomFrom} and ${ui.randomTo}, call`;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

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
        setResult({ ok: false, message: `Save failed: ${json.error ?? "unknown"}` });
      } else {
        setResult({ ok: true, message: "Saved. New cadence applies within ≤60 seconds on the next tick." });
      }
    } catch (err) {
      setResult({ ok: false, message: `Network error: ${String(err)}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-600">
        Build your call cadence below. Saved changes take effect within 60 seconds — no redeploy.
      </p>

      <div>
        <label className="block text-sm font-medium">Maximum total call attempts</label>
        <input
          type="number"
          min={1}
          max={20}
          value={maxAttempts}
          onChange={(e) => setMaxAttempts(Number(e.target.value))}
          className="mt-1 w-24 rounded-md border border-neutral-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-neutral-500">
          If the lead doesn&apos;t pick up after this many calls, they&apos;re marked as exhausted. Should be ≤ the number of steps below.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium">Call steps (in order)</label>
          <button
            type="button"
            onClick={addStep}
            className="rounded-md border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50"
          >
            + Add step
          </button>
        </div>

        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-start gap-3">
                <span className="mt-2 w-6 text-center text-sm font-medium text-neutral-500">{i + 1}</span>
                <div className="flex-1 space-y-2">
                  <select
                    value={s.kind}
                    onChange={(e) => updateStep(i, { kind: e.target.value as StepKind })}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    {KIND_OPTIONS.map((k) => (
                      <option key={k} value={k}>{KIND_LABELS[k]}</option>
                    ))}
                  </select>

                  {renderInputs(s, (patch) => updateStep(i, patch))}

                  <p className="text-xs text-neutral-600">{describe(s)}</p>
                </div>

                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    className="rounded px-2 py-1 text-xs hover:bg-neutral-200 disabled:opacity-30"
                    title="Move up"
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => moveStep(i, 1)}
                    disabled={i === steps.length - 1}
                    className="rounded px-2 py-1 text-xs hover:bg-neutral-200 disabled:opacity-30"
                    title="Move down"
                  >↓</button>
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    title="Remove"
                  >✕</button>
                </div>
              </div>
            </li>
          ))}
          {steps.length === 0 && (
            <li className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
              No steps yet. Click <b>+ Add step</b> to create your first one.
            </li>
          )}
        </ol>
      </div>

      <div className="flex items-center gap-3 border-t border-neutral-200 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving || steps.length === 0}
          className="rounded-md bg-brand px-4 py-2 text-brand-fg disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save cadence"}
        </button>
        {result && (
          <span className={result.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>{result.message}</span>
        )}
      </div>
    </div>
  );
}

function renderInputs(s: UiStep, set: (patch: Partial<UiStep>) => void): React.ReactNode {
  if (s.kind === "immediate") return null;

  if (s.kind === "wait_minutes" || s.kind === "wait_hours" || s.kind === "wait_days") {
    const unitLabel = s.kind === "wait_minutes" ? "minutes" : s.kind === "wait_hours" ? "hours" : "days";
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-neutral-600">Wait</span>
        <input
          type="number"
          min={1}
          max={s.kind === "wait_minutes" ? 1440 : s.kind === "wait_hours" ? 168 : 30}
          value={s.amount}
          onChange={(e) => set({ amount: Math.max(1, Number(e.target.value)) })}
          className="w-20 rounded-md border border-neutral-300 px-2 py-1"
        />
        <span className="text-neutral-600">{unitLabel}</span>
      </div>
    );
  }

  if (s.kind === "specific_day_time") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-600">In</span>
        <input
          type="number"
          min={1}
          max={30}
          value={s.amount}
          onChange={(e) => set({ amount: Math.max(1, Number(e.target.value)) })}
          className="w-20 rounded-md border border-neutral-300 px-2 py-1"
        />
        <span className="text-neutral-600">days, at</span>
        <input
          type="time"
          value={s.atTime}
          onChange={(e) => set({ atTime: e.target.value })}
          className="rounded-md border border-neutral-300 px-2 py-1"
        />
        <span className="text-neutral-600 text-xs">(lead&apos;s local time)</span>
      </div>
    );
  }

  if (s.kind === "next_workday_at") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-600">At</span>
        <input
          type="time"
          value={s.atTime}
          onChange={(e) => set({ atTime: e.target.value })}
          className="rounded-md border border-neutral-300 px-2 py-1"
        />
        <span className="text-neutral-600 text-xs">(lead&apos;s local time)</span>
      </div>
    );
  }

  if (s.kind === "next_workday_random") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-600">Between</span>
        <input
          type="time"
          value={s.randomFrom}
          onChange={(e) => set({ randomFrom: e.target.value })}
          className="rounded-md border border-neutral-300 px-2 py-1"
        />
        <span className="text-neutral-600">and</span>
        <input
          type="time"
          value={s.randomTo}
          onChange={(e) => set({ randomTo: e.target.value })}
          className="rounded-md border border-neutral-300 px-2 py-1"
        />
        <span className="text-neutral-600 text-xs">(picks a random minute in the window)</span>
      </div>
    );
  }

  return null;
}
