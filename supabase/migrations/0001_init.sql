-- =============================================================================
-- AI Retargeting Callback — initial schema
-- Single shared Supabase across all agency Vercel clones.
-- Tenancy enforced by RLS keyed on location_id (GHL sub-account).
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─── enums ────────────────────────────────────────────────────────────────────
create type channel_t      as enum ('voice', 'sms', 'email');
create type lead_status_t  as enum ('queued', 'in_progress', 'engaged', 'exhausted', 'stopped');
create type sched_status_t as enum ('queued', 'dispatched', 'completed', 'cancelled', 'failed');
create type call_outcome_t as enum ('answered', 'no_answer', 'voicemail', 'busy', 'failed');
create type msg_outcome_t  as enum ('sent', 'delivered', 'replied', 'clicked', 'bounced', 'failed', 'unsubscribed');
create type user_role_t    as enum ('owner', 'admin', 'viewer');
create type sub_status_t   as enum ('trialing', 'active', 'past_due', 'canceled', 'inactive');

-- ─── agencies (tenant root) ───────────────────────────────────────────────────
create table agencies (
  id                       uuid primary key default uuid_generate_v4(),
  location_id              text not null unique,            -- GHL sub-account id
  name                     text not null,
  timezone                 text not null default 'Europe/London',
  concurrency_cap          int  not null default 5,

  -- credentials (encrypted at rest by app via lib/crypto.ts)
  twilio_account_sid_enc   text,
  twilio_auth_token_enc    text,
  retell_api_key_enc       text,
  ghl_pit_enc              text,                            -- private integration token

  -- branding (mostly read from per-clone env, but stored for digest emails sent server-side)
  brand_name               text,
  brand_logo_url           text,

  -- stripe
  stripe_customer_id       text,
  stripe_subscription_id   text,
  subscription_status      sub_status_t not null default 'inactive',

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index on agencies (location_id);
create index on agencies (subscription_status);

-- ─── users (auth) ─────────────────────────────────────────────────────────────
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  agency_id   uuid not null references agencies(id) on delete cascade,
  email       text not null,
  role        user_role_t not null default 'viewer',
  created_at  timestamptz not null default now()
);

create index on users (agency_id);

-- ─── campaigns ────────────────────────────────────────────────────────────────
create table campaigns (
  id                   uuid primary key default uuid_generate_v4(),
  agency_id            uuid not null references agencies(id) on delete cascade,
  name                 text not null,
  enabled              boolean not null default true,

  retell_agent_id      text,                                -- voice agent
  retell_phone_number  text,                                -- outbound caller id (in agency's Retell)

  -- ordered list of {channel, when, ...}; see lib/cadence/types.ts
  cadence_json         jsonb not null default '[]'::jsonb,
  max_attempts         int  not null default 6,

  -- {start: "09:00", end: "20:00", days: [1,2,3,4,5]}  (tz = lead's tz)
  quiet_hours_json     jsonb not null default '{"start":"09:00","end":"20:00","days":[1,2,3,4,5,6,7]}'::jsonb,

  spread_hours         boolean not null default true,       -- anti-pattern detection

  -- opaque per-campaign secrets embedded in webhook URLs
  start_token          text not null default replace(uuid_generate_v4()::text, '-', ''),
  stop_token           text not null default replace(uuid_generate_v4()::text, '-', ''),

  -- which GHL tag identifies this campaign (for the snapshot installer)
  source_tag           text not null default 'ai-callback',

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index on campaigns (start_token);
create unique index on campaigns (stop_token);
create index on campaigns (agency_id);

-- ─── templates (SMS + email bodies, reusable across campaigns) ────────────────
create table templates (
  id          uuid primary key default uuid_generate_v4(),
  agency_id   uuid not null references agencies(id) on delete cascade,
  channel     channel_t not null check (channel in ('sms', 'email')),
  name        text not null,
  subject     text,                                          -- email only
  body        text not null,                                 -- supports {{first_name}} etc.
  created_at  timestamptz not null default now()
);

create index on templates (agency_id, channel);

-- ─── leads ────────────────────────────────────────────────────────────────────
create table leads (
  id              uuid primary key default uuid_generate_v4(),
  agency_id       uuid not null references agencies(id) on delete cascade,
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  ghl_contact_id  text not null,
  phone_e164      text not null,
  email           text,
  first_name      text,
  last_name       text,
  timezone        text not null default 'Europe/London',     -- resolved at intake
  sms_consent     boolean not null default false,
  email_consent   boolean not null default false,
  status          lead_status_t not null default 'queued',
  attempts_voice  int not null default 0,
  attempts_sms    int not null default 0,
  attempts_email  int not null default 0,
  last_outcome    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (campaign_id, ghl_contact_id)
);

create index on leads (agency_id, status);
create index on leads (campaign_id, status);

-- ─── scheduled_calls (voice queue) ────────────────────────────────────────────
create table scheduled_calls (
  id              uuid primary key default uuid_generate_v4(),
  agency_id       uuid not null references agencies(id) on delete cascade,
  lead_id         uuid not null references leads(id) on delete cascade,
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  step_index      int  not null,
  next_attempt_at timestamptz not null,
  status          sched_status_t not null default 'queued',
  created_at      timestamptz not null default now()
);

create index scheduled_calls_due on scheduled_calls (next_attempt_at) where status = 'queued';
create index on scheduled_calls (lead_id);

-- ─── scheduled_messages (SMS + email queue) ───────────────────────────────────
create table scheduled_messages (
  id              uuid primary key default uuid_generate_v4(),
  agency_id       uuid not null references agencies(id) on delete cascade,
  lead_id         uuid not null references leads(id) on delete cascade,
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  channel         channel_t not null check (channel in ('sms', 'email')),
  template_id     uuid references templates(id),
  step_index      int  not null,
  next_attempt_at timestamptz not null,
  status          sched_status_t not null default 'queued',
  created_at      timestamptz not null default now()
);

create index scheduled_messages_due on scheduled_messages (next_attempt_at) where status = 'queued';
create index on scheduled_messages (lead_id);

-- ─── call_attempts (voice history) ────────────────────────────────────────────
create table call_attempts (
  id                 uuid primary key default uuid_generate_v4(),
  agency_id          uuid not null references agencies(id) on delete cascade,
  lead_id            uuid not null references leads(id) on delete cascade,
  scheduled_call_id  uuid references scheduled_calls(id),
  retell_call_id     text unique,
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  duration_s         int,
  outcome            call_outcome_t,
  transcript_url     text,
  recording_url      text,
  raw_payload        jsonb
);

create index on call_attempts (lead_id, started_at desc);
create index on call_attempts (agency_id, started_at desc);

-- ─── message_attempts (SMS + email history) ───────────────────────────────────
create table message_attempts (
  id                    uuid primary key default uuid_generate_v4(),
  agency_id             uuid not null references agencies(id) on delete cascade,
  lead_id               uuid not null references leads(id) on delete cascade,
  scheduled_message_id  uuid references scheduled_messages(id),
  channel               channel_t not null check (channel in ('sms', 'email')),
  provider_message_id   text,                                -- twilio sid or resend id
  sent_at               timestamptz not null default now(),
  outcome               msg_outcome_t,
  body_snapshot         text,                                -- rendered content sent
  raw_payload           jsonb
);

create index on message_attempts (lead_id, sent_at desc);
create index on message_attempts (provider_message_id);

-- ─── digest_events (per-day rollup buffer) ────────────────────────────────────
create table digest_events (
  id          uuid primary key default uuid_generate_v4(),
  agency_id   uuid not null references agencies(id) on delete cascade,
  type        text not null,                                 -- 'call.answered' | 'call.exhausted' | 'sms.replied' | ...
  lead_id     uuid references leads(id) on delete set null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  digested    boolean not null default false
);

create index digest_events_pending on digest_events (agency_id, created_at) where digested = false;

-- ─── updated_at trigger ───────────────────────────────────────────────────────
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

create trigger t_agencies   before update on agencies   for each row execute function touch_updated_at();
create trigger t_campaigns  before update on campaigns  for each row execute function touch_updated_at();
create trigger t_leads      before update on leads      for each row execute function touch_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table agencies            enable row level security;
alter table users               enable row level security;
alter table campaigns           enable row level security;
alter table templates           enable row level security;
alter table leads               enable row level security;
alter table scheduled_calls     enable row level security;
alter table scheduled_messages  enable row level security;
alter table call_attempts       enable row level security;
alter table message_attempts    enable row level security;
alter table digest_events       enable row level security;

-- helper: current user's agency_id
create or replace function current_agency_id() returns uuid
language sql stable as $$
  select agency_id from users where id = auth.uid()
$$;

-- agencies: read own row
create policy agencies_select_own on agencies for select
  using (id = current_agency_id());

create policy agencies_update_own on agencies for update
  using (id = current_agency_id());

-- users: read own agency's users
create policy users_select_same_agency on users for select
  using (agency_id = current_agency_id());

-- generic "same agency" policies for the rest
create policy campaigns_rw on campaigns for all
  using (agency_id = current_agency_id()) with check (agency_id = current_agency_id());

create policy templates_rw on templates for all
  using (agency_id = current_agency_id()) with check (agency_id = current_agency_id());

create policy leads_rw on leads for all
  using (agency_id = current_agency_id()) with check (agency_id = current_agency_id());

create policy scheduled_calls_rw on scheduled_calls for all
  using (agency_id = current_agency_id()) with check (agency_id = current_agency_id());

create policy scheduled_messages_rw on scheduled_messages for all
  using (agency_id = current_agency_id()) with check (agency_id = current_agency_id());

create policy call_attempts_rw on call_attempts for all
  using (agency_id = current_agency_id()) with check (agency_id = current_agency_id());

create policy message_attempts_rw on message_attempts for all
  using (agency_id = current_agency_id()) with check (agency_id = current_agency_id());

create policy digest_events_r on digest_events for select
  using (agency_id = current_agency_id());

-- Service-role bypass: the dispatch route uses SUPABASE_SERVICE_ROLE_KEY for
-- reads/writes across tenants. RLS doesn't apply to the service role.

-- ─── pg_cron job: dispatch due calls + messages every minute ──────────────────
-- The job sends an HTTP POST (pg_net) to our Vercel dispatch endpoint. The
-- endpoint is responsible for batching, concurrency enforcement, and channel
-- routing. CRON_SECRET protects the endpoint.

-- NOTE: substitute __APP_BASE_URL__ and __CRON_SECRET__ via supabase secrets
-- at migration apply time. Example values shown for clarity.

select cron.schedule(
  'ai-retargeting-dispatch',
  '* * * * *',
  $cron$
    select net.http_post(
      url     := current_setting('app.dispatch_url', true),
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'X-Cron-Secret', current_setting('app.cron_secret', true)
                 ),
      body    := '{}'::jsonb
    );
  $cron$
);

-- Operators must set the GUCs once per Supabase project:
--   alter database postgres set app.dispatch_url = 'https://<vercel-app>/api/cron/dispatch';
--   alter database postgres set app.cron_secret  = '<random-secret>';
