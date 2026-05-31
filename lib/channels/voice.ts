import { APP } from "@/config";

interface PlaceCallOpts {
  toNumber: string;
  metadata?: Record<string, unknown>;
}

/**
 * Place an outbound call via Retell. Retell delivers via the agency's
 * connected Twilio number. The returned call_id is what we'll match in
 * the post-call webhook.
 */
export async function placeVoiceCall(opts: PlaceCallOpts): Promise<{ call_id: string }> {
  const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${APP.retell.apiKey}`,
    },
    body: JSON.stringify({
      from_number: APP.retell.fromNumber,
      to_number: opts.toNumber,
      override_agent_id: APP.retell.agentId,
      metadata: opts.metadata ?? {},
      webhook_url: `${APP.appUrl}/api/retell/postcall`,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Retell create-phone-call failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { call_id: string };
  return { call_id: json.call_id };
}
