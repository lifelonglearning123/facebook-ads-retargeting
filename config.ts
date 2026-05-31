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
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER ?? "",
  },
  retell: {
    apiKey: process.env.RETELL_API_KEY ?? "",
    agentId: process.env.RETELL_AGENT_ID ?? "",
  },
  email: {
    apiKey: process.env.RESEND_API_KEY ?? "",
    fromAddress: process.env.RESEND_FROM_EMAIL ?? "",
    fromName: process.env.RESEND_FROM_NAME ?? "",
  },
  admin: {
    /** HTTP basic-auth password. If empty, dashboard is open (useful in dev only). */
    password: process.env.ADMIN_PASSWORD ?? "",
  },
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  /** Shared secret in the Vercel cron URL so randos can't trigger /api/tick. */
  cronSecret: process.env.CRON_SECRET ?? "",
  /** Voice attempt duration in seconds for the lead to count as engaged. */
  engagedDurationSeconds: 30,
} as const;

// ---------------------------------------------------------------------------

export const CAMPAIGN: CampaignConfig = {
  maxAttempts: 6,
  quietHours: { start: "09:00", end: "20:00", days: [1, 2, 3, 4, 5, 6, 7] },
  spreadHours: true,
  cadence: [
    { channel: "voice", delay: "1min" },
    { channel: "voice", delay: "5min" },
    { channel: "sms", delay: "10min", template_id: "missed_call" },
    { channel: "voice", delay: "30min" },
    { channel: "email", after: "1d", at: "09:00", template_id: "day_two_followup" },
    { channel: "voice", rule: "next_business_day", random_between: ["10:00", "17:00"] },
  ],
};

export const TEMPLATES: TemplateMap = {
  missed_call: {
    sms: "Hi {{first_name}}, this is {{agency_name}} — we just tried calling about your enquiry. Reply here or call us back when you have a moment.",
  },
  day_two_followup: {
    email: {
      subject: "Following up on your enquiry",
      html: `<p>Hi {{first_name}},</p>
<p>We tried calling yesterday and didn't manage to reach you. We'd love to help with the project you enquired about.</p>
<p>Reply to this email or grab a time that suits you and we'll call then.</p>
<p>Best,<br/>{{agency_name}}</p>`,
    },
  },
};
