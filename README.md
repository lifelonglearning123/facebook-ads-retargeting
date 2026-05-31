# AI Retargeting Callback

White-label multi-channel retargeting platform. Facebook ad lead lands in GoHighLevel → AI voice agent calls them (Retell + Twilio) on a configurable cadence → SMS and email retries interleave between voice attempts → stops on engagement, max attempts, or GHL stop tag.

## Stack
- Next.js 15 (App Router) on Vercel — **clone-per-agency**
- Supabase Postgres + Auth — **shared across all agency clones**, RLS by `location_id`
- Retell (voice agents) — agency BYO account
- Twilio (voice + SMS) — agency BYO account
- Resend (email) — agency BYO domain
- Stripe (flat monthly per-agency subscription)
- Supabase `pg_cron` for retry scheduling

## Directory layout

```
app/
  api/
    ghl/{start,stop}/[token]/route.ts   # GHL webhook entrypoints
    cron/dispatch/route.ts              # pg_cron hits this every minute
    retell/postcall/route.ts            # Retell webhook on call end
    twilio/{voice,sms}/route.ts         # inbound voice + SMS handlers
    stripe/webhook/route.ts             # Stripe billing events
  (dashboard)/
    campaigns/, leads/, settings/       # agency dashboard
lib/
  supabase/      # server + browser clients
  cadence/       # step types, scheduler, business-day rules
  channels/      # voice (Retell), sms (Twilio), email (Resend)
  ghl/           # PIT-authed client, post-call push, webhook parsing
  tenant/        # token → agency+campaign resolver, env helpers
  crypto.ts      # encrypt agency creds at rest
  timezone.ts    # infer from GHL contact or phone area code
supabase/migrations/
  0001_init.sql                         # schema + RLS + pg_cron
snapshot/
  ghl-snapshot-spec.json                # blueprint for the GHL snapshot installed via PIT
docs/
  agency-onboarding.md                  # Phase 1 manual + Phase 2 PIT setup
```

## Onboarding phases

- **Phase 1 — Manual webhook paste.** Agency creates two workflows in GHL and pastes our start/stop URLs.
- **Phase 2 — PIT + snapshot.** Agency pastes a GHL Private Integration Token and `location_id`; we install the snapshot via API and patch webhook URLs per campaign.
- **Phase 3 — OAuth marketplace app.** Deferred until traction.

## Local dev

```bash
npm install
cp .env.example .env.local
# fill in Supabase, Stripe, Resend, ENCRYPTION_KEY, CRON_SECRET
npm run dev
```

## Cadence step types

```jsonc
[
  { "channel": "voice", "delay": "1min" },
  { "channel": "sms",   "delay": "5min", "template_id": "tmpl_..." },
  { "channel": "voice", "after": "1d", "at": "09:00" },
  { "channel": "voice", "after": "1d", "random_between": ["09:00", "17:00"] },
  { "channel": "email", "rule": "next_business_day", "at_one_of": ["10:00", "13:00"], "template_id": "tmpl_..." }
]
```

All times are interpreted in the lead's timezone (resolved from GHL contact.timezone, falling back to phone area-code).
