import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CampaignContext {
  agency: {
    id: string;
    location_id: string;
    timezone: string;
    concurrency_cap: number;
    subscription_status: string;
    twilio_account_sid_enc: string | null;
    twilio_auth_token_enc: string | null;
    retell_api_key_enc: string | null;
    ghl_pit_enc: string | null;
  };
  campaign: {
    id: string;
    name: string;
    enabled: boolean;
    retell_agent_id: string | null;
    retell_phone_number: string | null;
    cadence_json: unknown;
    max_attempts: number;
    quiet_hours_json: unknown;
    spread_hours: boolean;
  };
}

/**
 * Resolve a per-campaign start token (from webhook URL) to its agency + campaign.
 * Returns null if not found or campaign is disabled / agency not subscribed.
 */
export async function resolveByStartToken(token: string): Promise<CampaignContext | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("campaigns")
    .select(`
      id, name, enabled, retell_agent_id, retell_phone_number,
      cadence_json, max_attempts, quiet_hours_json, spread_hours,
      agencies (
        id, location_id, timezone, concurrency_cap, subscription_status,
        twilio_account_sid_enc, twilio_auth_token_enc, retell_api_key_enc, ghl_pit_enc
      )
    `)
    .eq("start_token", token)
    .maybeSingle();

  if (!data || !data.agencies) return null;
  const campaign = data;
  const agency = Array.isArray(data.agencies) ? data.agencies[0] : data.agencies;
  if (!campaign.enabled) return null;
  if (!["active", "trialing"].includes(agency.subscription_status)) return null;

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      enabled: campaign.enabled,
      retell_agent_id: campaign.retell_agent_id,
      retell_phone_number: campaign.retell_phone_number,
      cadence_json: campaign.cadence_json,
      max_attempts: campaign.max_attempts,
      quiet_hours_json: campaign.quiet_hours_json,
      spread_hours: campaign.spread_hours,
    },
    agency,
  };
}

export async function resolveByStopToken(token: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("campaigns")
    .select("id, agency_id")
    .eq("stop_token", token)
    .maybeSingle();
  return data;
}
