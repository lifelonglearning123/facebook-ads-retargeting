/**
 * Single source of truth for this deployment.
 *
 * One Vercel project = one customer. Editing this file + redeploying is how
 * the agency changes their campaign. No DB-backed config because at ≤100
 * leads/day there's no need for one.
 *
 * GHL custom field keys used (the agency must create these in their
 * location — they're provisioned by snapshot/ghl-snapshot-spec.json):
 *
 *   ai_status              text   queued | in_progress | engaged | exhausted | stopped
 *   ai_step_index          number current cadence step
 *   ai_next_attempt_at     date   ISO timestamp of next fire
 *   ai_attempts_voice      number
 *   ai_attempts_sms        number
 *   ai_attempts_email      number
 *   ai_last_outcome        text   "answered" | "no_answer" | "sms_sent" | etc.
 *   ai_last_attempt_at     date
 *   ai_transcript_url      text
 *   ai_active_call_id      text   Retell call_id for in-flight calls
 *   ai_sms_consent         bool
 *   ai_email_consent       bool
 *
 * Tags used:
 *
 *   ai-callback      adding this enters the contact into the cadence
 *   ai-active        added by /api/ghl/start, removed on terminal state
 *   ai-engaged       added when lead picks up + stays past threshold
 *   ai-exhausted     added when max attempts reached
 *   stop-ai-callback agency uses to manually stop
 */
import type { Cadence, QuietHours } from "@/lib/cadence/types";

export interface CampaignConfig {
  maxAttempts: number;
  quietHours: QuietHours;
  spreadHours: boolean;
  cadence: Cadence;
}

export interface TemplateMap {
  [templateId: string]: {
    sms?: string;
    email?: { subject: string; html: string };
  };
}

// ---------------------------------------------------------------------------

export const APP = {
  agency: {
    name: process.env.AGENCY_NAME ?? "AI Retargeting",
    timezone: process.env.AGENCY_TIMEZONE ?? "Europe/London",
    notificationEmail: process.env.NOTIFICATION_EMAIL ?? "",
  },
  branding: {
    name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "AI Retargeting",
    logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? "",
    primaryRgb: process.env.NEXT_PUBLIC_BRAND_PRIMARY ?? "14 165 233",
    primaryFgRgb: process.env.NEXT_PUBLIC_BRAND_PRIMARY_FG ?? "255 255 255",
    font: process.env.NEXT_PUBLIC_BRAND_FONT ?? "Inter",
  },
  ghl: {
    locationId: process.env.GHL_LOCATION_ID ?? "",
    pitToken: process.env.GHL_PIT ?? "",
    sourceTag: "ai-callback",
    activeTag: "ai-active",
    engagedTag: "ai-engaged",
    exhaustedTag: "ai-exhausted",
    stopTag: "stop-ai-callback",
  },
  retell: {
    apiKey: process.env.RETELL_API_KEY ?? "",
    agentId: process.env.RETELL_AGENT_ID ?? "",
    /** Outbound caller-id used by Retell's create-phone-call. This is the
     *  number you registered inside Retell (Retell manages the Twilio side). */
    fromNumber: process.env.RETELL_FROM_NUMBER ?? "",
  },
  email: {
    /** Optional override for the From address used when sending email via
     *  GHL's conversations API. If blank, GHL uses the location's default. */
    fromAddress: process.env.GHL_EMAIL_FROM ?? "",
  },
  admin: {
    /** HTTP basic-auth password. If empty, dashboard is open (useful in dev only). */
    password: process.env.ADMIN_PASSWORD ?? "",
  },
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  /** Shared secret in the Vercel cron URL so randos can't trigger /api/tick. */
  cronSecret: process.env.CRON_SECRET ?? "",
  /** Voice attempt duration in seconds for the lead to count as engaged. */
  engagedDurationSeconds: 15,
} as const;

// ---------------------------------------------------------------------------

export const CAMPAIGN: CampaignConfig = {
  maxAttempts: 6,
  quietHours: { start: "09:00", end: "20:00", days: [1, 2, 3, 4, 5, 6, 7] },
  spreadHours: true,
  cadence: [
    // Step 0: fire immediately — FB lead has just consented, strike while hot
    { channel: "voice", delay: "0min" },
    // Step 1: retry in 5 min if no answer
    { channel: "voice", delay: "5min" },
    // Step 2: retry in 30 min
    { channel: "voice", delay: "30min" },
    // Step 3: retry in 2 hours
    { channel: "voice", delay: "2h" },
    // Step 4: next business day, mid-morning
    { channel: "voice", rule: "next_business_day", at: "10:00" },
    // Step 5: final attempt, next business day afternoon (random within window)
    { channel: "voice", rule: "next_business_day", random_between: ["13:00", "17:00"] },
  ],
};

// Voice-only deployment — templates kept for future use if SMS/email steps
// are reintroduced in the cadence.
export const TEMPLATES: TemplateMap = {};
