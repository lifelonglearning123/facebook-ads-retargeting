"use client";
import { useState } from "react";

interface Result {
  ok: boolean;
  agent_id?: string;
  webhook_url?: string;
  current_webhook_url?: string;
  error?: string;
}

export default function RetellSetupButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/setup/retell", { method: "POST" });
      const json = (await res.json()) as Result;
      setResult(json);
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="btn-primary text-sm"
      >
        {loading ? "Configuring…" : "Configure Retell"}
      </button>

      {result && (
        <div
          className="mt-4 rounded-xl border p-4 text-sm"
          style={{
            borderColor: result.ok
              ? "rgb(var(--tag-picked-edge))"
              : "rgb(var(--tag-stopped-edge))",
            background: result.ok
              ? "rgb(var(--tag-picked-bg) / 0.35)"
              : "rgb(var(--tag-stopped-bg) / 0.35)",
          }}
        >
          {result.ok ? (
            <div className="space-y-2">
              <p className="text-[rgb(var(--tag-picked-fg))]">
                <strong>Configured.</strong> The Retell agent now reports call outcomes back to this app.
              </p>
              <dl className="text-[0.85rem] text-[rgb(var(--ink-2))] grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-2">
                <dt className="text-[rgb(var(--ink-3))]">Agent:</dt>
                <dd style={{ fontFamily: "var(--font-mono)" }} className="break-all">
                  {result.agent_id}
                </dd>
                <dt className="text-[rgb(var(--ink-3))]">Reporting to:</dt>
                <dd style={{ fontFamily: "var(--font-mono)" }} className="break-all">
                  {result.current_webhook_url ?? result.webhook_url}
                </dd>
              </dl>
            </div>
          ) : (
            <p className="text-[rgb(var(--tag-stopped-fg))]">
              <strong>Setup error.</strong> {result.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
