import { APP } from "@/config";

export interface RetellSetupResult {
  ok: boolean;
  agent_id?: string;
  webhook_url?: string;
  /** Echoes what Retell now reports for the agent. */
  current_webhook_url?: string;
  error?: string;
}

/**
 * Idempotent: PATCH the configured Retell agent so its webhook_url points at
 * our /api/retell/postcall endpoint. Safe to re-run after deploys or after
 * swapping RETELL_AGENT_ID.
 */
export async function configureRetellAgent(): Promise<RetellSetupResult> {
  if (!APP.retell.apiKey) return { ok: false, error: "RETELL_API_KEY not set" };
  if (!APP.retell.agentId) return { ok: false, error: "RETELL_AGENT_ID not set" };
  if (!APP.appUrl) return { ok: false, error: "NEXT_PUBLIC_APP_URL not set" };

  const webhookUrl = `${APP.appUrl.replace(/\/+$/, "")}/api/retell/postcall`;

  const patchRes = await fetch(`https://api.retellai.com/update-agent/${APP.retell.agentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${APP.retell.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ webhook_url: webhookUrl }),
  });

  if (!patchRes.ok) {
    const text = await patchRes.text();
    return { ok: false, error: `Retell PATCH ${patchRes.status}: ${text.slice(0, 400)}` };
  }

  // Verify by reading it back
  const getRes = await fetch(`https://api.retellai.com/get-agent/${APP.retell.agentId}`, {
    headers: { Authorization: `Bearer ${APP.retell.apiKey}` },
  });
  const agent = await getRes.json().catch(() => ({} as { webhook_url?: string }));

  return {
    ok: true,
    agent_id: APP.retell.agentId,
    webhook_url: webhookUrl,
    current_webhook_url: (agent as { webhook_url?: string }).webhook_url,
  };
}
