# AI Retargeting Callback

Single-customer AI voice + SMS + email retargeting for Facebook ad leads. Triggered from GoHighLevel.

**Stack:** Next.js 15 on Vercel + Retell (voice) + GHL (state, SMS, email). No Supabase, no Stripe, no Twilio creds, no Resend. Sized for ≤100 leads/day per deployment.

## Architecture

```
GHL workflow (tag "ai-callback" added)
   ↓
/api/ghl/start            → writes ai_status, ai_next_attempt_at to GHL contact
                            adds tag "ai-active"
   ↓
Vercel Cron every minute
   ↓
/api/tick                 → searches GHL contacts with tag "ai-active"
                            for each due lead: fire voice/SMS/email step
                            update custom fields + append note
   ↓
Retell post-call          → /api/retell/postcall: outcome → engaged or schedule next
Inbound SMS replies       → handled inside GHL (workflow on reply triggers /api/ghl/stop)
Inbound voice             → Retell-managed number answers directly
   ↓
GHL workflow (booked / stop tag)
   ↓
/api/ghl/stop             → removes tag, cancels future attempts
```

## What lives where

| Thing | Where |
|---|---|
| Per-lead state | GHL contact custom fields |
| Attempt history | GHL contact notes |
| SMS + email sending | GHL conversations API |
| Voice calls | Retell (via Retell-managed phone number) |
| Campaign cadence + templates | `config.ts` (committed) |
| Credentials | Vercel env vars |
| Branding | Vercel env vars |
| Scheduling | Vercel Cron (1-min) + GHL contact search by tag |
| Admin auth | HTTP basic auth (env var) |

## Directory layout

```
config.ts                        # campaign + templates + branding + creds (single source of truth)
app/
  api/
    ghl/{start,stop}/route.ts    # GHL webhook entrypoints
    tick/route.ts                # Vercel cron — fires due steps
    retell/postcall/route.ts     # call-end webhook
  page.tsx                       # admin queue
  config/page.tsx                # admin config view
  lead/[contactId]/page.tsx      # admin lead detail
lib/
  cadence/                       # types, business-day math, scheduler, advance logic
  channels/                      # voice (Retell), sms (GHL), email (GHL)
  ghl/                           # GHL v2 API client + Zod webhook schemas
  state.ts                       # per-lead state via GHL custom fields
  timezone.ts                    # lead tz from GHL or phone area code
middleware.ts                    # HTTP basic auth for admin pages
snapshot/ghl-snapshot-spec.json  # blueprint of custom fields + tags + workflows
docs/agency-onboarding.md        # one-time setup the agency does
```

## Setup

```bash
npm install
cp .env.example .env.local       # fill in everything
npm run dev
```

Then in the customer's GHL location:
1. Create the custom fields and tags defined in `snapshot/ghl-snapshot-spec.json`.
2. Generate a Private Integration Token with conversations write scope, paste into `GHL_PIT`.
3. Build the two workflows (Start + Stop) — copy URLs from the dashboard's `/config` page.
4. Add `https://<your-app>/api/retell/postcall` to your Retell agent's webhook settings.
5. Deploy to Vercel.

See `docs/agency-onboarding.md` for the step-by-step.

## Cadence

Defined in `config.ts`. Mix voice/SMS/email steps with delays, specific times, random windows, or "next business day" rules:

```ts
cadence: [
  { channel: "voice", delay: "1min" },
  { channel: "voice", delay: "5min" },
  { channel: "sms",   delay: "10min", template_id: "missed_call" },
  { channel: "voice", delay: "30min" },
  { channel: "email", after: "1d", at: "09:00", template_id: "day_two_followup" },
  { channel: "voice", rule: "next_business_day", random_between: ["10:00", "17:00"] },
]
```

All times are interpreted in the lead's timezone (resolved from GHL `contact.timezone`, falling back to phone area code, then agency default).

## Why no DB

At ≤100 leads/day, GHL's contact API comfortably handles all per-lead state. A database would just duplicate what's already in GHL — and lose the property that the agency can see everything in their own CRM. If your volume grows past ~1000/day, revisit (poll efficiency drops off, GHL API limits start to matter).
