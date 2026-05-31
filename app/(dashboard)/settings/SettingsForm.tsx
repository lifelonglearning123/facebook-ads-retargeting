"use client";
import { useState } from "react";

interface Props {
  agency: {
    id: string;
    name: string;
    location_id: string;
    timezone: string;
    concurrency_cap: number;
    brand_name: string | null;
    brand_logo_url: string | null;
  };
  status: { twilio: boolean; retell: boolean; ghl_pit: boolean };
}

export default function SettingsForm({ agency, status }: Props) {
  const [name, setName] = useState(agency.name);
  const [timezone, setTimezone] = useState(agency.timezone);
  const [concurrency, setConcurrency] = useState(agency.concurrency_cap);
  const [brandName, setBrandName] = useState(agency.brand_name ?? "");
  const [brandLogo, setBrandLogo] = useState(agency.brand_logo_url ?? "");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [retellKey, setRetellKey] = useState("");
  const [pit, setPit] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/agency/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        timezone,
        concurrency_cap: concurrency,
        brand_name: brandName,
        brand_logo_url: brandLogo,
        twilio_account_sid: twilioSid || undefined,
        twilio_auth_token: twilioToken || undefined,
        retell_api_key: retellKey || undefined,
        ghl_pit: pit || undefined,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) setMsg(json.error ?? "save_failed");
    else {
      setMsg("Saved.");
      setTwilioSid(""); setTwilioToken(""); setRetellKey(""); setPit("");
    }
  }

  return (
    <div className="mt-3 space-y-4">
      <Field label="Agency name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={cls} />
      </Field>
      <Field label="GHL location ID">
        <code className="block rounded bg-neutral-100 px-3 py-2 text-sm">{agency.location_id}</code>
      </Field>
      <Field label="Default timezone">
        <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className={cls} />
      </Field>
      <Field label="Concurrent call cap">
        <input type="number" value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} min={1} max={50} className={cls + " w-24"} />
      </Field>

      <hr className="border-neutral-200" />
      <h3 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Branding</h3>
      <Field label="Display name (for digest emails)">
        <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className={cls} />
      </Field>
      <Field label="Logo URL">
        <input value={brandLogo} onChange={(e) => setBrandLogo(e.target.value)} className={cls} />
      </Field>

      <hr className="border-neutral-200" />
      <h3 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Integrations</h3>
      <Field label={`Twilio Account SID ${status.twilio ? "(set ✓)" : "(not set)"}`}>
        <input value={twilioSid} onChange={(e) => setTwilioSid(e.target.value)} placeholder={status.twilio ? "Paste to replace" : "AC..."} className={cls} />
      </Field>
      <Field label="Twilio Auth Token">
        <input type="password" value={twilioToken} onChange={(e) => setTwilioToken(e.target.value)} placeholder={status.twilio ? "Paste to replace" : "auth token"} className={cls} />
      </Field>
      <Field label={`Retell API key ${status.retell ? "(set ✓)" : "(not set)"}`}>
        <input type="password" value={retellKey} onChange={(e) => setRetellKey(e.target.value)} placeholder={status.retell ? "Paste to replace" : "key_..."} className={cls} />
      </Field>
      <Field label={`GHL Private Integration Token ${status.ghl_pit ? "(set ✓)" : "(not set)"}`}>
        <input type="password" value={pit} onChange={(e) => setPit(e.target.value)} placeholder={status.ghl_pit ? "Paste to replace" : "pit-..."} className={cls} />
        <p className="mt-1 text-xs text-neutral-500">Generate inside GHL → Settings → Private Integrations. Required scopes: contacts.write, customFields.write, tags.write, workflows.write.</p>
      </Field>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={loading} className="rounded-md bg-brand px-4 py-2 text-brand-fg disabled:opacity-50">
          {loading ? "Saving..." : "Save settings"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}

const cls = "rounded-md border border-neutral-300 px-3 py-2 w-full";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
