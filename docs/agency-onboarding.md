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

Paste into Vercel env var `GHL_PIT`. Paste the location ID into `GHL_LOCATION_ID`.

## 3. Fill in remaining env vars

`AGENCY_NAME`, `AGENCY_TIMEZONE`, branding vars, Twilio creds, Retell creds, Resend creds, `ADMIN_PASSWORD`, `CRON_SECRET`. See `.env.example`.

## 4. Build the GHL workflows

Open the dashboard's `/config` page — it shows the exact webhook URLs.

### Workflow A — Start calling

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

### Workflow B — Stop calling

1. New workflow.
2. Trigger: **Appointment Booked** OR **Contact Tag Added** with tag `stop-ai-callback`.
3. Action: Webhook → Stop URL from `/config` → body:
   ```json
   { "contact_id": "{{contact.id}}", "reason": "ghl_workflow" }
   ```

## 5. Wire Twilio number webhooks

Twilio Console → Phone Numbers → your number:

- **A call comes in** → Webhook → URL from `/config` (`/api/twilio/voice`)
- **A message comes in** → Webhook → URL from `/config` (`/api/twilio/sms`)

## 6. Wire Retell post-call webhook

Retell → your agent → Webhooks → add `https://<app>/api/retell/postcall`.

## 7. Test

Manually add the `ai-callback` tag to a real (consenting) contact in GHL. Watch the queue at the dashboard root. The first step fires within a minute.

## 8. Edit the cadence

`config.ts` → modify the `CAMPAIGN` block → commit → Vercel auto-deploys. Live leads continue running on their current step; new leads pick up the new cadence.
