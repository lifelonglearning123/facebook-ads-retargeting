import { APP, CAMPAIGN, TEMPLATES } from "@/config";

export const dynamic = "force-dynamic";

export default function ConfigPage() {
  const startUrl = `${APP.appUrl}/api/ghl/start`;
  const stopUrl = `${APP.appUrl}/api/ghl/stop`;
  const inboundVoiceUrl = `${APP.appUrl}/api/twilio/voice`;
  const inboundSmsUrl = `${APP.appUrl}/api/twilio/sms`;
  const retellPostcallUrl = `${APP.appUrl}/api/retell/postcall`;

  const integrations = [
    { label: "GHL location ID", value: APP.ghl.locationId, set: !!APP.ghl.locationId },
    { label: "GHL PIT", value: APP.ghl.pitToken ? "•••••" : "", set: !!APP.ghl.pitToken },
    { label: "Twilio Account SID", value: APP.twilio.accountSid, set: !!APP.twilio.accountSid },
    { label: "Twilio Auth Token", value: APP.twilio.authToken ? "•••••" : "", set: !!APP.twilio.authToken },
    { label: "Twilio number", value: APP.twilio.phoneNumber, set: !!APP.twilio.phoneNumber },
    { label: "Retell API key", value: APP.retell.apiKey ? "•••••" : "", set: !!APP.retell.apiKey },
    { label: "Retell agent ID", value: APP.retell.agentId, set: !!APP.retell.agentId },
    { label: "Resend API key", value: APP.email.apiKey ? "•••••" : "", set: !!APP.email.apiKey },
    { label: "Resend from", value: APP.email.fromAddress, set: !!APP.email.fromAddress },
  ];

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Configuration</h1>
        <p className="mt-1 text-sm text-neutral-500">
          All config lives in <code>config.ts</code> + environment variables. Edit and redeploy to change.
        </p>
      </header>

      <Section title="Webhook URLs to paste into GHL / Twilio">
        <UrlRow label="GHL → Start workflow webhook" value={startUrl} />
        <UrlRow label="GHL → Stop workflow webhook" value={stopUrl} />
        <UrlRow label="Retell → Post-call webhook" value={retellPostcallUrl} />
        <UrlRow label="Twilio → Inbound voice webhook" value={inboundVoiceUrl} />
        <UrlRow label="Twilio → Inbound SMS webhook" value={inboundSmsUrl} />
      </Section>

      <Section title="Integrations">
        <ul className="space-y-1 text-sm">
          {integrations.map((i) => (
            <li key={i.label} className="flex justify-between">
              <span>{i.label}</span>
              <span className={i.set ? "text-green-700" : "text-red-600"}>
                {i.set ? `set${i.value && !i.value.startsWith("•") ? ` (${i.value})` : ""} ✓` : "not set"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Campaign cadence">
        <div className="text-sm text-neutral-700">
          <p>Max attempts: <b>{CAMPAIGN.maxAttempts}</b></p>
          <p>Quiet hours: {CAMPAIGN.quietHours.start}–{CAMPAIGN.quietHours.end} (days: {CAMPAIGN.quietHours.days.join(",")})</p>
          <p>Spread hours: {CAMPAIGN.spreadHours ? "on" : "off"}</p>
        </div>
        <ol className="mt-3 space-y-1 text-sm">
          {CAMPAIGN.cadence.map((s, i) => (
            <li key={i} className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="font-medium uppercase">{s.channel}</span> — <code className="text-xs">{JSON.stringify(stripChannel(s))}</code>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Templates">
        <ul className="space-y-3">
          {Object.entries(TEMPLATES).map(([id, t]) => (
            <li key={id} className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{id}</div>
              {t.sms && <pre className="mt-1 whitespace-pre-wrap text-neutral-700">{t.sms}</pre>}
              {t.email && (
                <div className="mt-1">
                  <div className="text-xs text-neutral-500">Subject: <b>{t.email.subject}</b></div>
                  <pre className="mt-1 whitespace-pre-wrap text-neutral-700">{t.email.html}</pre>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <code className="mt-1 block break-all rounded bg-neutral-100 px-3 py-2 text-xs">{value || "(set NEXT_PUBLIC_APP_URL)"}</code>
    </div>
  );
}

function stripChannel(s: Record<string, unknown>) {
  const { channel: _channel, ...rest } = s;
  return rest;
}
