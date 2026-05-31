import { APP } from "@/config";
import { getCampaign } from "@/lib/runtime-config";
import { PageHeader, SectionHeader } from "@/components/presentational";
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
    { label: "GoHighLevel location ID", value: APP.ghl.locationId, set: !!APP.ghl.locationId },
    { label: "GoHighLevel access token", value: APP.ghl.pitToken ? "•••• hidden ••••" : "", set: !!APP.ghl.pitToken },
    { label: "Retell API key", value: APP.retell.apiKey ? "•••• hidden ••••" : "", set: !!APP.retell.apiKey },
    { label: "Retell agent ID", value: APP.retell.agentId, set: !!APP.retell.agentId },
    { label: "Outbound phone number", value: APP.retell.fromNumber, set: !!APP.retell.fromNumber },
  ];

  return (
    <div className="space-y-14">
      <PageHeader
        eyebrow="Configuration"
        title="Calling"
        accent="schedule & setup"
        subtitle="Decide when and how often the AI should call leads, and check that every connection to GoHighLevel and Retell is healthy."
      />

      <section className="reveal reveal-d1">
        <SectionHeader
          title="Calling schedule"
          subtitle="The sequence of calls the AI agent will make for each new lead. Saved changes apply to all new leads within 60 seconds — no redeploy."
        />
        <div className="card p-6 md:p-8">
          <CadenceEditor
            initialMaxAttempts={campaign.maxAttempts}
            initialCadenceJson={JSON.stringify(campaign.cadence, null, 2)}
          />
          <div className="mt-8 pt-6 border-t border-[rgb(var(--line))]">
            <div className="eyebrow mb-2">Calling hours (for retries)</div>
            <p className="text-[0.93rem] text-[rgb(var(--ink-2))]">
              The first call happens immediately when a lead is added (they just clicked
              an ad, so they’re awake). All later calls only happen between{" "}
              <span className="text-[rgb(var(--ink))]">
                {campaign.quietHours.start}
              </span>{" "}
              and{" "}
              <span className="text-[rgb(var(--ink))]">{campaign.quietHours.end}</span>{" "}
              in the lead’s local time zone — so we don’t ring them at 3am.
            </p>
          </div>
        </div>
      </section>

      <section className="reveal reveal-d2">
        <SectionHeader
          title="How leads enter the cadence"
          subtitle="Two ways to start a call campaign for a lead — pick whichever fits your team’s workflow."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-6">
            <div className="eyebrow mb-2">Recommended · no extra setup</div>
            <h3
              className="text-[1.25rem] tracking-tight"
              style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
            >
              Add the tag and wait
            </h3>
            <p className="mt-2 text-[0.93rem] text-[rgb(var(--ink-2))]">
              In GoHighLevel, open any contact and add the tag{" "}
              <code className="rounded px-1.5 py-0.5 bg-[rgb(var(--paper-deep))] text-[rgb(var(--ink))]" style={{ fontFamily: "var(--font-mono)" }}>
                ai-callback
              </code>
              . Within 60 seconds the system picks them up and the first call goes out.
            </p>
          </div>
          <div className="card p-6">
            <div className="eyebrow mb-2">Advanced · workflow trigger</div>
            <h3
              className="text-[1.25rem] tracking-tight"
              style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
            >
              Trigger instantly via webhook
            </h3>
            <p className="mt-2 text-[0.93rem] text-[rgb(var(--ink-2))]">
              For zero-second latency, set up a GoHighLevel workflow with the trigger
              <em> Contact Tag Added → ai-callback</em> and a webhook action pointing
              to the Start URL below.
            </p>
          </div>
        </div>
      </section>

      <section className="reveal reveal-d3">
        <SectionHeader
          title="Webhook addresses"
          subtitle="Paste these into GoHighLevel and Retell if you set up the advanced workflows. The Retell post-call address is set up automatically by the button below."
        />
        <div className="card divide-y divide-[rgb(var(--line))]">
          <UrlRow label="Start a call campaign (GoHighLevel → here)" value={startUrl} />
          <UrlRow label="Stop a call campaign (GoHighLevel → here)" value={stopUrl} />
          <UrlRow label="Call ended (Retell → here)" value={retellPostcallUrl} muted />
        </div>
      </section>

      <section className="reveal reveal-d4">
        <SectionHeader
          title="One-click setup"
          subtitle="Two buttons that make sure GoHighLevel and Retell are wired correctly. Both are safe to run multiple times — they only change what needs changing."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-6">
            <div className="eyebrow mb-3">GoHighLevel</div>
            <h3
              className="text-[1.2rem] tracking-tight mb-2"
              style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
            >
              Provision custom fields & tags
            </h3>
            <p className="text-[0.9rem] text-[rgb(var(--ink-2))] mb-4">
              Creates the AI status fields and the lifecycle tags inside your GoHighLevel
              location, so the system has somewhere to write each lead’s progress.
            </p>
            <ProvisionButton />
          </div>
          <div className="card p-6">
            <div className="eyebrow mb-3">Retell</div>
            <h3
              className="text-[1.2rem] tracking-tight mb-2"
              style={{ fontFamily: "var(--font-fraunces)", fontWeight: 400 }}
            >
              Configure agent webhook
            </h3>
            <p className="text-[0.9rem] text-[rgb(var(--ink-2))] mb-4">
              Tells the Retell agent to report each call’s outcome back to this app so
              the cadence can advance. Run this once, and again if you swap agents.
            </p>
            <RetellSetupButton />
          </div>
        </div>
      </section>

      <section className="reveal reveal-d5">
        <SectionHeader
          title="Connections"
          subtitle="Everything this app needs to do its work. Set any missing values as environment variables and redeploy."
        />
        <div className="card overflow-hidden">
          {integrations.map((i, idx) => (
            <div
              key={i.label}
              className={`flex items-center justify-between gap-4 px-6 py-4 ${
                idx !== integrations.length - 1
                  ? "border-b border-[rgb(var(--line))]"
                  : ""
              }`}
            >
              <div>
                <div className="text-[0.95rem] text-[rgb(var(--ink))]">{i.label}</div>
                {i.set && i.value && !i.value.startsWith("•") && (
                  <div
                    className="mt-1 text-[0.78rem] text-[rgb(var(--ink-3))]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {i.value}
                  </div>
                )}
              </div>
              <span
                className={`tag ${i.set ? "tag-picked" : "tag-stopped"}`}
              >
                <span className="dot" />
                {i.set ? "Connected" : "Not set"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function UrlRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="px-6 py-5">
      <div className="eyebrow mb-2">{label}</div>
      <code
        className={`block break-all text-[0.85rem] leading-relaxed ${
          muted ? "text-[rgb(var(--ink-2))]" : "text-[rgb(var(--ink))]"
        }`}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value || "(set NEXT_PUBLIC_APP_URL in your environment)"}
      </code>
    </div>
  );
}
