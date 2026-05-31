# Agency onboarding

One-time setup for the customer this deployment serves. After this, contacts entering the cadence is just "add the `ai-callback` tag in a GHL workflow."

## 1. Provision GHL custom fields + tags

The blueprint is in `snapshot/ghl-snapshot-spec.json`. Recreate it manually in GHL **Settings → Custom Fields** and **Settings → Tags**:

### Custom fields (group: "AI Retargeting")

| Key | Type | Notes |
|---|---|---|
| `ai_status` | Text | queued / in_progress / engaged / exhausted / stopped |
| `ai_step_index` | Number | |
| `ai_next_attempt_at` | Date | ISO timestamp |
| `ai_attempts_voice` | Number | |
| `ai_attempts_sms` | Number | |
| `ai_attempts_email` | Number | |
| `ai_last_outcome` | Text | |
| `ai_last_attempt_at` | Date | |
| `ai_transcript_url` | Text | |
| `ai_active_call_id` | Text | |
| `ai_sms_consent` | Checkbox | TCPA: must be true before SMS step fires |
| `ai_email_consent` | Checkbox | |

### Tags

- `ai-callback` — adding this enters the contact into cadence
- `ai-active` — added by `/api/ghl/start`, removed on terminal state
- `ai-engaged` — added when lead picks up + stays past threshold
- `ai-exhausted` — added when max attempts reached
- `stop-ai-callback` — agency uses to manually stop

## 2. Generate a Private Integration Token

GHL → **Settings → Private Integrations → Create token**. Scopes:
- `contacts.readonly`
- `contacts.write`
- `customFields.readonly`
- `customFields.write`
- `tags.write`
- `conversations.readonly`
- `conversations.write`
- `conversations/message.write`         (sends SMS + email via GHL)

Paste into Vercel env var `GHL_PIT`. Paste the location ID into `GHL_LOCATION_ID`.

## 3. Fill in remaining env vars

`AGENCY_NAME`, `AGENCY_TIMEZONE`, branding vars, Retell creds (`RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_FROM_NUMBER`), `ADMIN_PASSWORD`, `CRON_SECRET`. See `.env.example`.

SMS and email go through GHL's conversations API — no Twilio or Resend creds needed.

## 4. (Optional) Build the GHL workflows

**You can skip this section entirely.** By default our app polls GHL every minute and picks up any contact tagged `ai-callback`, so workflows are not required. Tag a contact and it'll enter the cadence within ≤60 seconds.

If you want **instant** pickup (zero-second latency) or you want the stop event triggered from an appointment booking, build the workflows below. Webhook URLs are shown on the dashboard's `/config` page.

### Workflow A (optional) — Start calling instantly

1. Automation → Workflows → Create.
2. Trigger: **Contact Tag Added** → tag `ai-callback`.
3. Action: **Webhook** → URL from `/config` → method POST → headers `Content-Type: application/json` → body:
   ```json
   {
     "contact_id": "{{contact.id}}",
     "phone": "{{contact.phone}}",
     "first_name": "{{contact.first_name}}",
     "last_name": "{{contact.last_name}}",
     "email": "{{contact.email}}",
     "timezone": "{{contact.timezone}}",
     "sms_consent": "{{contact.ai_sms_consent}}",
     "email_consent": "{{contact.ai_email_consent}}"
   }
   ```
4. Save and publish.

### Workflow B (optional but recommended) — Stop calling on appointment booked

1. New workflow.
2. Trigger: **Appointment Booked** OR **Contact Tag Added** with tag `stop-ai-callback`.
3. Action: Webhook → Stop URL from `/config` → body:
   ```json
   { "contact_id": "{{contact.id}}", "reason": "ghl_workflow" }
   ```

## 5. Wire Retell post-call webhook

Retell → your agent → Webhooks → add `https://<app>/api/retell/postcall`.

Inbound voice (lead calls back the Retell number) is handled by Retell directly — no Twilio webhook configuration needed on your end.

## 6. (Optional) GHL workflow on SMS reply

GHL handles STOP keywords automatically (sets the contact's DND flag, blocks future sends). If you want a non-STOP reply to also cancel future cadence steps + mark the lead as engaged so sales can take over, add a small workflow:

1. Trigger: **Customer replied (SMS)**.
2. Action: Webhook → URL from `/config` (Stop) with body `{ "contact_id": "{{contact.id}}", "reason": "sms_reply" }`.

If you skip this, GHL still routes the reply into your conversations inbox; our app just keeps trying the cadence until max attempts or STOP.

## 7. Test

Manually add the `ai-callback` tag to a real (consenting) contact in GHL. Watch the queue at the dashboard root. The first step fires within a minute.

## 8. Edit the cadence

`config.ts` → modify the `CAMPAIGN` block → commit → Vercel auto-deploys. Live leads continue running on their current step; new leads pick up the new cadence.
