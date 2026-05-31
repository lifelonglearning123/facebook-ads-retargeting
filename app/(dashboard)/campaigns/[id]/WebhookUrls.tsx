"use client";
import { useState } from "react";

interface Props {
  startUrl: string;
  stopUrl: string;
  sourceTag: string;
}

const SAMPLE_BODY = (sourceTag: string) => `{
  "contact_id": "{{contact.id}}",
  "location_id": "{{location.id}}",
  "phone": "{{contact.phone}}",
  "first_name": "{{contact.first_name}}",
  "last_name": "{{contact.last_name}}",
  "email": "{{contact.email}}",
  "timezone": "{{contact.timezone}}",
  "sms_consent": "{{contact.ai_sms_consent}}",
  "email_consent": "{{contact.ai_email_consent}}",
  "ad_id": "{{contact.attributionSource.adId}}",
  "ad_campaign": "{{contact.attributionSource.campaign}}",
  "source": "${sourceTag}"
}`;

export default function WebhookUrls({ startUrl, stopUrl, sourceTag }: Props) {
  return (
    <div className="mt-4 space-y-4">
      <CopyRow label="START webhook (POST)" value={startUrl} />
      <CopyRow label="STOP webhook (POST)" value={stopUrl} />
      <details className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Workflow setup instructions</summary>
        <ol className="ml-5 mt-2 list-decimal space-y-2 text-neutral-700">
          <li>In GHL, go to <b>Automation → Workflows → Create</b>.</li>
          <li>
            Trigger: <b>Contact Tag Added</b> → tag = <code>{sourceTag}</code>.
          </li>
          <li>
            Action: <b>Webhook</b> → URL = the START url above, method <b>POST</b>, Content-Type <code>application/json</code>.
          </li>
          <li>Paste the body below into the webhook&apos;s body field.</li>
          <li>Save and publish.</li>
          <li>
            Create a second workflow with trigger <b>Appointment Booked</b> or tag <code>stop-ai-callback</code>, action Webhook → STOP url above.
          </li>
        </ol>
        <pre className="mt-3 overflow-x-auto rounded bg-white p-3 text-xs">{SAMPLE_BODY(sourceTag)}</pre>
      </details>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 break-all rounded bg-neutral-100 px-3 py-2 text-xs">{value}</code>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-md border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
