import { decrypt } from "@/lib/crypto";

interface PlaceCallOpts {
  retellApiKeyEnc: string;
  agentId: string;
  fromNumber: string;
  toNumber: string;
  metadata?: Record<string, unknown>;
}

/**
 * Place an outbound call via Retell. Retell handles Twilio under the hood
 * using the agency's connected Twilio number. Returns the retell_call_id
 * for tracking via the post-call webhook.
 */
export async function placeVoiceCall(opts: PlaceCallOpts): Promise<{ call_id: string }> {
  const apiKey = decrypt(opts.retellApiKeyEnc);
  const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from_number: opts.fromNumber,
      to_number: opts.toNumber,
      override_agent_id: opts.agentId,
      metadata: opts.metadata ?? {},
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Retell create-phone-call failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { call_id: string };
  return { call_id: json.call_id };
}
