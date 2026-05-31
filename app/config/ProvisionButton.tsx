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
        className="btn-primary text-sm"
      >
        {loading ? "Setting up…" : "Set up GoHighLevel"}
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
          {!result.ok && (
            <p className="text-[rgb(var(--tag-stopped-fg))]">
              <strong>Setup error.</strong> {result.error}
            </p>
          )}
          {result.ok && (
            <div className="space-y-3">
              <p className="text-[rgb(var(--tag-picked-fg))]">
                <strong>All set.</strong> Here’s what we did:
              </p>
              <ResultRow
                title="Custom fields"
                created={result.fields?.created ?? []}
                existed={result.fields?.existed.length ?? 0}
                failed={result.fields?.failed ?? []}
              />
              <ResultRow
                title="Tags"
                created={result.tags?.created ?? []}
                existed={result.tags?.existed.length ?? 0}
                failed={result.tags?.failed ?? []}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({
  title,
  created,
  existed,
  failed,
}: {
  title: string;
  created: string[];
  existed: number;
  failed: { name: string; error: string }[];
}) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{title}</div>
      <ul className="space-y-0.5 text-[0.88rem] text-[rgb(var(--ink-2))]">
        <li>
          <strong className="text-[rgb(var(--ink))]">{created.length}</strong> newly created
          {created.length > 0 && (
            <span className="text-[rgb(var(--ink-3))]"> — {created.join(", ")}</span>
          )}
        </li>
        <li>
          <strong className="text-[rgb(var(--ink))]">{existed}</strong> already existed
        </li>
        {failed.length > 0 && (
          <li className="text-[rgb(var(--tag-stopped-fg))]">
            <strong>{failed.length}</strong> couldn’t be created
            <ul className="ml-4 mt-1 list-disc">
              {failed.map((f) => (
                <li key={f.name}>
                  <strong>{f.name}</strong>: {f.error}
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </div>
  );
}
