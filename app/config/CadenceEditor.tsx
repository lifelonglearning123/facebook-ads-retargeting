"use client";
import { useState } from "react";

interface Props {
  initialMaxAttempts: number;
  initialCadenceJson: string;
}

export default function CadenceEditor({ initialMaxAttempts, initialCadenceJson }: Props) {
  const [maxAttempts, setMaxAttempts] = useState(initialMaxAttempts);
  const [cadenceText, setCadenceText] = useState(initialCadenceJson);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function save() {
    setSaving(true);
    setResult(null);
    let cadence: unknown;
    try {
      cadence = JSON.parse(cadenceText);
    } catch {
      setSaving(false);
      setResult({ ok: false, message: "Cadence JSON is not valid JSON. Check brackets and commas." });
      return;
    }
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
        setResult({ ok: true, message: `Saved. New cadence applies within 60 seconds on the next tick.` });
      }
    } catch (err) {
      setResult({ ok: false, message: `Network error: ${String(err)}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Edit max attempts and the cadence here. Saves to GHL Custom Values so changes take effect within ≤60 seconds —
        no redeploy needed. Defaults from <code>config.ts</code> are used if no override is set.
      </p>

      <div>
        <label className="block text-sm font-medium">Max attempts</label>
        <input
          type="number"
          min={1}
          max={20}
          value={maxAttempts}
          onChange={(e) => setMaxAttempts(Number(e.target.value))}
          className="mt-1 w-24 rounded-md border border-neutral-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-neutral-500">Total call attempts across the cadence. Must be ≤ number of steps below.</p>
      </div>

      <div>
        <label className="block text-sm font-medium">Cadence steps (JSON)</label>
        <textarea
          rows={12}
          value={cadenceText}
          onChange={(e) => setCadenceText(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
          spellCheck={false}
        />
        <details className="mt-2 text-xs text-neutral-600">
          <summary className="cursor-pointer">Step shape reference</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-neutral-50 p-3">{`Each step is one of:

  { "channel": "voice", "delay": "0min" }
  { "channel": "voice", "delay": "5min" }
  { "channel": "voice", "delay": "2h" }
  { "channel": "voice", "delay": "1d" }
  { "channel": "voice", "after": "1d", "at": "10:00" }
  { "channel": "voice", "after": "1d", "random_between": ["09:00", "17:00"] }
  { "channel": "voice", "rule": "next_business_day", "at": "10:00" }
  { "channel": "voice", "rule": "next_business_day", "random_between": ["13:00", "17:00"] }

Times are in the lead's timezone. Delays accept "Nmin", "Nh", "Nd".`}</pre>
        </details>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
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
