"use client";
import { useState } from "react";
import type { Cadence, CadenceStep } from "@/lib/cadence/types";

type Template = { id: string; name: string; channel: "sms" | "email" };

interface Props {
  value: Cadence;
  onChange: (next: Cadence) => void;
  templates: Template[];
}

const blankStep: Record<string, CadenceStep> = {
  voice_delay: { channel: "voice", delay: "5min" },
  voice_after_at: { channel: "voice", after: "1d", at: "10:00" },
  voice_after_random: { channel: "voice", after: "1d", random_between: ["09:00", "17:00"] },
  voice_bday_at: { channel: "voice", rule: "next_business_day", at: "10:00" },
  sms_delay: { channel: "sms", delay: "10min", template_id: "" } as CadenceStep,
  email_after_at: { channel: "email", after: "1d", at: "09:00", template_id: "" } as CadenceStep,
};

export default function CadenceBuilder({ value, onChange, templates }: Props) {
  const [adding, setAdding] = useState<string>("voice_delay");

  function update(i: number, patch: Partial<CadenceStep>) {
    const next = value.map((s, idx) => (idx === i ? ({ ...s, ...patch } as CadenceStep) : s));
    onChange(next);
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function add() {
    const fresh = { ...blankStep[adding] } as CadenceStep;
    onChange([...value, fresh]);
  }

  return (
    <div className="space-y-3">
      {value.map((step, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <span className="font-medium text-neutral-500">{i + 1}.</span>
          <select
            value={step.channel}
            onChange={(e) => update(i, { channel: e.target.value as CadenceStep["channel"] } as Partial<CadenceStep>)}
            className="rounded border border-neutral-300 px-2 py-1"
          >
            <option value="voice">Voice</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>

          {renderWhenEditor(step, (patch) => update(i, patch))}

          {(step.channel === "sms" || step.channel === "email") && (
            <select
              value={"template_id" in step ? (step as { template_id: string }).template_id : ""}
              onChange={(e) => update(i, { template_id: e.target.value } as Partial<CadenceStep>)}
              className="rounded border border-neutral-300 px-2 py-1"
            >
              <option value="">Template…</option>
              {templates.filter((t) => t.channel === step.channel).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => remove(i)}
            className="ml-auto text-xs text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <select
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="voice_delay">Voice — wait N minutes/hours</option>
          <option value="voice_after_at">Voice — in N days at specific time</option>
          <option value="voice_after_random">Voice — in N days at random time</option>
          <option value="voice_bday_at">Voice — next business day at specific time</option>
          <option value="sms_delay">SMS — wait N minutes/hours</option>
          <option value="email_after_at">Email — in N days at specific time</option>
        </select>
        <button
          type="button"
          onClick={add}
          className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
        >
          + Add step
        </button>
      </div>
    </div>
  );
}

function renderWhenEditor(step: CadenceStep, set: (patch: Partial<CadenceStep>) => void) {
  if ("delay" in step) {
    return (
      <>
        <span>wait</span>
        <input
          value={(step as { delay: string }).delay}
          onChange={(e) => set({ delay: e.target.value } as Partial<CadenceStep>)}
          className="w-24 rounded border border-neutral-300 px-2 py-1"
          placeholder="5min"
        />
      </>
    );
  }
  if ("rule" in step && step.rule === "next_business_day") {
    if ("at" in step) {
      return (
        <>
          <span>next business day at</span>
          <input
            value={(step as { at: string }).at}
            onChange={(e) => set({ at: e.target.value } as Partial<CadenceStep>)}
            className="w-24 rounded border border-neutral-300 px-2 py-1"
            placeholder="10:00"
          />
        </>
      );
    }
    if ("random_between" in step) {
      const [lo, hi] = step.random_between;
      return (
        <>
          <span>next business day between</span>
          <input
            value={lo}
            onChange={(e) => set({ random_between: [e.target.value, hi] } as Partial<CadenceStep>)}
            className="w-20 rounded border border-neutral-300 px-2 py-1"
          />
          <span>and</span>
          <input
            value={hi}
            onChange={(e) => set({ random_between: [lo, e.target.value] } as Partial<CadenceStep>)}
            className="w-20 rounded border border-neutral-300 px-2 py-1"
          />
        </>
      );
    }
  }
  if ("after" in step) {
    if ("at" in step) {
      return (
        <>
          <span>in</span>
          <input
            value={(step as { after: string }).after}
            onChange={(e) => set({ after: e.target.value } as Partial<CadenceStep>)}
            className="w-20 rounded border border-neutral-300 px-2 py-1"
            placeholder="1d"
          />
          <span>at</span>
          <input
            value={(step as { at: string }).at}
            onChange={(e) => set({ at: e.target.value } as Partial<CadenceStep>)}
            className="w-24 rounded border border-neutral-300 px-2 py-1"
            placeholder="09:00"
          />
        </>
      );
    }
    if ("random_between" in step) {
      const [lo, hi] = step.random_between;
      return (
        <>
          <span>in</span>
          <input
            value={(step as { after: string }).after}
            onChange={(e) => set({ after: e.target.value } as Partial<CadenceStep>)}
            className="w-20 rounded border border-neutral-300 px-2 py-1"
            placeholder="1d"
          />
          <span>between</span>
          <input
            value={lo}
            onChange={(e) => set({ random_between: [e.target.value, hi] } as Partial<CadenceStep>)}
            className="w-20 rounded border border-neutral-300 px-2 py-1"
          />
          <span>and</span>
          <input
            value={hi}
            onChange={(e) => set({ random_between: [lo, e.target.value] } as Partial<CadenceStep>)}
            className="w-20 rounded border border-neutral-300 px-2 py-1"
          />
        </>
      );
    }
  }
  return null;
}
