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
        className="rounded-md bg-brand px-4 py-2 text-brand-fg disabled:opacity-50"
      >
        {loading ? "Configuring..." : "Configure Retell agent webhook"}
      </button>
      <p className="mt-1 text-xs text-neutral-500">
        Sets <code>webhook_url</code> on the Retell agent so call-end events report back to our app. Idempotent — re-run after swapping <code>RETELL_AGENT_ID</code>.
      </p>

      {result && (
        <div className={`mt-4 rounded-md border p-3 text-sm ${result.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          {result.ok ? (
            <>
              <p className="font-medium text-green-800">Configured ✓</p>
              <ul className="mt-1 ml-5 list-disc text-neutral-700">
                <li>Agent: <code>{result.agent_id}</code></li>
                <li>Webhook set to: <code className="break-all">{result.webhook_url}</code></li>
                <li>Retell reports current: <code className="break-all">{result.current_webhook_url ?? "(unknown)"}</code></li>
              </ul>
            </>
          ) : (
            <p className="text-red-700">Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
