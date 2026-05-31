"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import CadenceBuilder from "@/components/CadenceBuilder";
import type { Cadence } from "@/lib/cadence/types";

interface Props {
  campaign?: {
    id: string;
    name: string;
    enabled: boolean;
    retell_agent_id: string | null;
    retell_phone_number: string | null;
    cadence_json: Cadence;
    max_attempts: number;
    quiet_hours_json: { start: string; end: string; days: number[] };
    spread_hours: boolean;
    source_tag: string;
  };
  templates: { id: string; name: string; channel: "sms" | "email" }[];
}

export default function CampaignForm({ campaign, templates }: Props) {
  const router = useRouter();
  const [name, setName] = useState(campaign?.name ?? "");
  const [enabled, setEnabled] = useState(campaign?.enabled ?? true);
  const [agentId, setAgentId] = useState(campaign?.retell_agent_id ?? "");
  const [fromNumber, setFromNumber] = useState(campaign?.retell_phone_number ?? "");
  const [maxAttempts, setMaxAttempts] = useState(campaign?.max_attempts ?? 6);
  const [sourceTag, setSourceTag] = useState(campaign?.source_tag ?? "ai-callback");
  const [cadence, setCadence] = useState<Cadence>(campaign?.cadence_json ?? []);
  const [qhStart, setQhStart] = useState(campaign?.quiet_hours_json?.start ?? "09:00");
  const [qhEnd, setQhEnd] = useState(campaign?.quiet_hours_json?.end ?? "20:00");
  const [qhDays, setQhDays] = useState<number[]>(campaign?.quiet_hours_json?.days ?? [1, 2, 3, 4, 5]);
  const [spread, setSpread] = useState(campaign?.spread_hours ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleDay(d: number) {
    setQhDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function save() {
    setLoading(true);
    setError(null);
    const payload = {
      name,
      enabled,
      retell_agent_id: agentId,
      retell_phone_number: fromNumber,
      max_attempts: maxAttempts,
      source_tag: sourceTag,
      cadence_json: cadence,
      quiet_hours_json: { start: qhStart, end: qhEnd, days: qhDays },
      spread_hours: spread,
    };
    const url = campaign ? `/api/campaigns/${campaign.id}` : `/api/campaigns`;
    const method = campaign ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "save_failed");
      return;
    }
    router.push(`/campaigns/${json.id ?? campaign?.id}`);
    router.refresh();
  }

  const DAYS = [
    { d: 1, l: "Mon" }, { d: 2, l: "Tue" }, { d: 3, l: "Wed" },
    { d: 4, l: "Thu" }, { d: 5, l: "Fri" }, { d: 6, l: "Sat" }, { d: 7, l: "Sun" },
  ];

  return (
    <div className="space-y-6">
      <Field label="Campaign name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </Field>

      <Field label="GHL source tag">
        <input value={sourceTag} onChange={(e) => setSourceTag(e.target.value)} className={inputCls} />
        <Hint>Workflow A fires when a contact gets this tag.</Hint>
      </Field>

      <Field label="Retell agent ID">
        <input value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputCls} placeholder="agent_..." />
      </Field>

      <Field label="Outbound phone number (E.164)">
        <input value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} className={inputCls} placeholder="+447700900123" />
      </Field>

      <Field label="Max attempts">
        <input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className={inputCls + " w-24"} min={1} max={20} />
      </Field>

      <Field label="Cadence">
        <CadenceBuilder value={cadence} onChange={setCadence} templates={templates} />
      </Field>

      <Field label="Quiet hours (lead's local time)">
        <div className="flex items-center gap-2">
          <input value={qhStart} onChange={(e) => setQhStart(e.target.value)} className={inputCls + " w-24"} />
          <span>to</span>
          <input value={qhEnd} onChange={(e) => setQhEnd(e.target.value)} className={inputCls + " w-24"} />
        </div>
        <div className="mt-2 flex gap-1">
          {DAYS.map((d) => (
            <button
              key={d.d}
              type="button"
              onClick={() => toggleDay(d.d)}
              className={`rounded border px-2 py-1 text-xs ${qhDays.includes(d.d) ? "border-brand bg-brand text-brand-fg" : "border-neutral-300 bg-white"}`}
            >
              {d.l}
            </button>
          ))}
        </div>
      </Field>

      <Field label="">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={spread} onChange={(e) => setSpread(e.target.checked)} />
          Spread retries across different hours of the day
        </label>
      </Field>

      <Field label="">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Campaign active
        </label>
      </Field>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={loading} className="rounded-md bg-brand px-4 py-2 text-brand-fg disabled:opacity-50">
          {loading ? "Saving..." : "Save campaign"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

const inputCls = "rounded-md border border-neutral-300 px-3 py-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-neutral-700">{label}</label>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-neutral-500">{children}</p>;
}
