"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TemplateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setLoading(true); setError(null);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, channel, subject: channel === "email" ? subject : null, body }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "save_failed"); return; }
    setName(""); setSubject(""); setBody("");
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        <select value={channel} onChange={(e) => setChannel(e.target.value as "sms" | "email")} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </select>
      </div>
      {channel === "email" && (
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={channel === "email" ? 8 : 4}
        placeholder={channel === "sms" ? "Hi {{first_name}}, we just tried calling..." : "<p>Hi {{first_name}}, we just tried calling about your enquiry...</p>"}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm"
      />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={loading || !name || !body} className="rounded-md bg-brand px-4 py-2 text-brand-fg disabled:opacity-50">
          {loading ? "Saving..." : "Add template"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
