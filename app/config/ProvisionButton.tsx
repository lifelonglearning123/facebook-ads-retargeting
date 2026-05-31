"use client";
import { useState } from "react";

interface ProvisionResult {
  ok: boolean;
  fields?: { created: string[]; existed: string[]; failed: { name: string; error: string }[] };
  tags?: { created: string[]; existed: string[]; failed: { name: string; error: string }[] };
  error?: string;
}

export default function ProvisionButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/setup/provision", { method: "POST" });
      const json = (await res.json()) as ProvisionResult;
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
        {loading ? "Provisioning..." : "Provision custom fields + tags in GHL"}
      </button>
      <p className="mt-1 text-xs text-neutral-500">
        Idempotent — safe to run multiple times. Creates anything from the snapshot spec that isn&apos;t already in the location.
      </p>

      {result && (
        <div className={`mt-4 rounded-md border p-3 text-sm ${result.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          {!result.ok && <p className="text-red-700">Error: {result.error}</p>}
          {result.ok && (
            <>
              <p className="font-medium">Custom fields</p>
              <ul className="mt-1 ml-5 list-disc text-neutral-700">
                <li>Created: {result.fields?.created.length ?? 0} {result.fields?.created.length ? `(${result.fields?.created.join(", ")})` : ""}</li>
                <li>Already existed: {result.fields?.existed.length ?? 0}</li>
                {(result.fields?.failed.length ?? 0) > 0 && (
                  <li className="text-red-700">
                    Failed: {result.fields?.failed.length}
                    <ul className="ml-5 list-disc">
                      {result.fields?.failed.map((f) => (
                        <li key={f.name}><b>{f.name}</b>: {f.error}</li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
              <p className="mt-3 font-medium">Tags</p>
              <ul className="mt-1 ml-5 list-disc text-neutral-700">
                <li>Created: {result.tags?.created.length ?? 0} {result.tags?.created.length ? `(${result.tags?.created.join(", ")})` : ""}</li>
                <li>Already existed: {result.tags?.existed.length ?? 0}</li>
                {(result.tags?.failed.length ?? 0) > 0 && (
                  <li className="text-red-700">
                    Failed: {result.tags?.failed.length}
                    <ul className="ml-5 list-disc">
                      {result.tags?.failed.map((f) => (
                        <li key={f.name}><b>{f.name}</b>: {f.error}</li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
