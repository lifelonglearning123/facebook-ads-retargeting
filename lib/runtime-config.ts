import { z } from "zod";
import { CAMPAIGN, type CampaignConfig } from "@/config";
import { CadenceSchema, QuietHoursSchema } from "@/lib/cadence/types";
import { getCustomValue, upsertCustomValue } from "@/lib/ghl/client";

const STORE_KEY = "AI_RETARGETING_CONFIG";
const CACHE_TTL_MS = 60_000;

const RuntimeOverrideSchema = z.object({
  maxAttempts: z.number().int().min(1).max(20).optional(),
  cadence: CadenceSchema.optional(),
  quietHours: QuietHoursSchema.optional(),
  spreadHours: z.boolean().optional(),
  stopStageIds: z.array(z.string().min(1)).optional(),
});
export type RuntimeOverride = z.infer<typeof RuntimeOverrideSchema>;

let cache: { campaign: CampaignConfig; expires: number } | null = null;

/**
 * Returns the live campaign config: defaults from config.ts overlaid with any
 * override stored in GHL Custom Values (key = AI_RETARGETING_CONFIG). Cached
 * for 60 seconds to avoid hammering GHL on every dispatch.
 */
export async function getCampaign(): Promise<CampaignConfig> {
  if (cache && cache.expires > Date.now()) return cache.campaign;

  let merged: CampaignConfig = CAMPAIGN;
  try {
    const raw = await getCustomValue(STORE_KEY);
    if (raw) {
      const parsed = RuntimeOverrideSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        merged = {
          maxAttempts: parsed.data.maxAttempts ?? CAMPAIGN.maxAttempts,
          cadence: parsed.data.cadence ?? CAMPAIGN.cadence,
          quietHours: parsed.data.quietHours ?? CAMPAIGN.quietHours,
          spreadHours: parsed.data.spreadHours ?? CAMPAIGN.spreadHours,
          stopStageIds: parsed.data.stopStageIds ?? CAMPAIGN.stopStageIds,
        };
      }
    }
  } catch {
    /* keep defaults */
  }

  cache = { campaign: merged, expires: Date.now() + CACHE_TTL_MS };
  return merged;
}

/** Force the next getCampaign() call to bypass cache. Call after a write. */
export function invalidateRuntimeConfig(): void {
  cache = null;
}

/**
 * Validate and persist a runtime override to GHL Custom Values. Performs a
 * partial merge with whatever's already stored, so each editor on the config
 * page can save its own slice without wiping the others. Returns the merged
 * campaign that will take effect.
 */
export async function saveRuntimeOverride(input: unknown): Promise<{ ok: true; campaign: CampaignConfig } | { ok: false; error: string }> {
  const parsed = RuntimeOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: JSON.stringify(parsed.error.flatten()) };
  }
  try {
    let existing: RuntimeOverride = {};
    try {
      const raw = await getCustomValue(STORE_KEY);
      if (raw) {
        const prev = RuntimeOverrideSchema.safeParse(JSON.parse(raw));
        if (prev.success) existing = prev.data;
      }
    } catch {
      /* treat missing/corrupt as empty */
    }
    const merged: RuntimeOverride = { ...existing, ...parsed.data };
    await upsertCustomValue(STORE_KEY, JSON.stringify(merged));
    invalidateRuntimeConfig();
    const campaign = await getCampaign();
    return { ok: true, campaign };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
