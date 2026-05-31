import { APP } from "@/config";
import { getCampaign } from "@/lib/runtime-config";
import ProvisionButton from "./ProvisionButton";
import RetellSetupButton from "./RetellSetupButton";
import CadenceEditor from "./CadenceEditor";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const campaign = await getCampaign();

  const startUrl = `${APP.appUrl}/api/ghl/start`;
  const stopUrl = `${APP.appUrl}/api/ghl/stop`;
  const retellPostcallUrl = `${APP.appUrl}/api/retell/postcall`;

  const integrations = [
    { label: "GHL location ID", value: APP.ghl.locationId, set: !!APP.ghl.locationId },
    { label: "GHL PIT", value: APP.ghl.pitToken ? "•••••" : "", set: !!APP.ghl.pitToken },
    { label: "Retell API key", value: APP.retell.apiKey ? "•••••" : "", set: !!APP.retell.apiKey },
    { label: "Retell agent ID", value: APP.retell.agentId, set: !!APP.retell.agentId },
    { label: "Retell from number", value: APP.retell.fromNumber, set: !!APP.retell.fromNumber },
  ];

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Configuration</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Edit max attempts and cadence below — saved to GHL Custom Values, applied within ≤60s, no redeploy. Other integrations and credentials live in environment variables.
        </p>
      </header>

      <Section title="Campaign cadence">
        <CadenceEditor
          initialMaxAttempts={campaign.maxAttempts}
          initialCadenceJson={JSON.stringify(campaign.cadence, null, 2)}
        />
        <p className="mt-4 text-xs text-neutral-500">
          Current quiet hours (not editable here): {campaign.quietHours.start}–{campaign.quietHours.end} on days {campaign.quietHours.days.join(",")}. Spread retries across the day: {campaign.spreadHours ? "on" : "off"}.
        </p>
      </Section>

      <Section title="GHL provisioning">
        <ProvisionButton />
      </Section>

      <Section title="Retell agent setup">
        <RetellSetupButton />
      </Section>

      <Section title="How leads enter the cadence">
        <div className="space-y-3 text-sm text-neutral-700">
          <p>
            <b>Default (no workflow needed):</b> add the <code>ai-callback</code> tag to any contact in GHL.
            Our <code>/api/tick</code> cron picks it up within ≤60 seconds, validates the phone, and starts the cadence.
          </p>
          <p>
            <b>Optional (instant trigger):</b> set up a GHL workflow with trigger <i>Contact Tag Added → ai-callback</i> and a webhook action pointing at the Start URL below.
          </p>
        </div>
      </Section>

      <Section title="Webhook URLs">
        <UrlRow label="GHL → Start workflow webhook (optional)" value={startUrl} />
        <UrlRow label="GHL → Stop workflow webhook (optional, e.g. on appointment booked)" value={stopUrl} />
        <UrlRow label="Retell → Post-call webhook (auto-configured by setup button above)" value={retellPostcallUrl} />
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
