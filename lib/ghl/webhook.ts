import { z } from "zod";

export const GhlStartPayloadSchema = z.object({
  contact_id: z.string().min(1),
  location_id: z.string().min(1).optional(),
  phone: z.string().min(7),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  timezone: z.string().optional().nullable(),
  sms_consent: z.union([z.boolean(), z.string()]).optional(),
  email_consent: z.union([z.boolean(), z.string()]).optional(),
  ad_id: z.string().optional().nullable(),
  ad_campaign: z.string().optional().nullable(),
  ad_set: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  campaign_id: z.string().optional().nullable(),
});
export type GhlStartPayload = z.infer<typeof GhlStartPayloadSchema>;

export const GhlStopPayloadSchema = z.object({
  contact_id: z.string().min(1),
  location_id: z.string().min(1).optional(),
  reason: z.string().optional(),
});
export type GhlStopPayload = z.infer<typeof GhlStopPayloadSchema>;

export function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "1", "yes", "y", "on"].includes(v.toLowerCase());
  return false;
}
