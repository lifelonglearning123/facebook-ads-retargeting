"use client";
import { useEffect, useState } from "react";

interface Stage {
  id: string;
  name: string;
}
interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

interface Props {
  initialSelectedStageIds: string[];
}

export default function StopStagesEditor({ initialSelectedStageIds }: Props) {
  const [pipelines, setPipelines] = useState<Pipeline[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedStageIds)
  );
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ghl/pipelines")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.ok) {
          setLoadError(j.error ?? "Couldn't load pipelines");
          return;
        }
        setPipelines(j.pipelines as Pipeline[]);
      })
      .catch((err) => !cancelled && setLoadError(String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(stageId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/config/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stopStageIds: Array.from(selected) }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setResult({ ok: false, message: `Couldn't save: ${json.error ?? "unknown error"}` });
      } else {
        setResult({ ok: true, message: "Saved. New rules apply within 60 seconds." });
      }
    } catch (err) {
      setResult({ ok: false, message: `Network error: ${String(err)}` });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <p className="text-[0.93rem] text-[rgb(var(--tag-stopped-fg))]">
        Couldn't load pipelines from GoHighLevel: {loadError}
      </p>
    );
  }

  if (!pipelines) {
    return (
      <p className="text-[0.93rem] text-[rgb(var(--ink-3))]">Loading pipelines from GoHighLevel…</p>
    );
  }

  if (pipelines.length === 0) {
    return (
      <p className="text-[0.93rem] text-[rgb(var(--ink-2))]">
        No pipelines found in this GoHighLevel location. Create one in GHL first.
      </p>
    );
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-7">
      <p className="text-[0.93rem] text-[rgb(var(--ink-2))]">
        Tick any pipeline stage that means <em>do not call this lead again</em>. The moment
        someone moves a lead into one of these stages, the cadence stops — even if more calls
        were scheduled.
      </p>

      <ol className="space-y-5">
        {pipelines.map((p) => (
          <li key={p.id} className="card p-5 md:p-6">
            <div className="eyebrow mb-3">Pipeline</div>
            <h3
              className="text-[1.15rem] tracking-tight mb-4"
              style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
            >
              {p.name}
            </h3>

            {p.stages.length === 0 ? (
              <p className="text-[0.88rem] text-[rgb(var(--ink-3))]">
                This pipeline has no stages yet.
              </p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {p.stages.map((s) => {
                  const checked = selected.has(s.id);
                  return (
                    <li key={s.id}>
                      <label
                        className={`flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                          checked
                            ? "border-[rgb(var(--tag-stopped-edge))] bg-[rgb(var(--tag-stopped-bg))] text-[rgb(var(--tag-stopped-fg))]"
                            : "border-[rgb(var(--line))] hover:bg-[rgb(var(--paper-deep))]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(s.id)}
                          className="h-4 w-4"
                          aria-label={`Stop calling when stage is ${s.name}`}
                        />
                        <span className="text-[0.93rem]">{s.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ol>

      <div className="hairline" />

      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:justify-between">
        <div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving…" : "Save stop list"}
          </button>
          <p className="mt-2 text-[0.85rem] text-[rgb(var(--ink-3))]">
            {selectedCount === 0
              ? "No stages selected — nothing will be auto-stopped."
              : `${selectedCount} stage${selectedCount === 1 ? "" : "s"} selected.`}
          </p>
        </div>
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
