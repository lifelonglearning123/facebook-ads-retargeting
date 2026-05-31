# Agency onboarding

This is what your white-label customers do to go live. Designed to take ~10 minutes per agency in Phase 1, and ~60 seconds once Phase 2 (PIT installer) ships.

## Phase 1 — Manual webhook setup

### 1. Sign in
- Visit your branded URL (e.g. `https://calls.acme-agency.com`).
- Enter email → magic link → click through.

### 2. Create agency
- Enter agency name, GHL location ID, default timezone.
- Continue to Stripe Checkout → subscribe.

### 3. Configure integrations (Settings)
- **Twilio Account SID + Auth Token** — from the Twilio console.
- **Retell API key** — Settings → API Keys in Retell.
- **GHL Private Integration Token (PIT)** — GHL → Settings → Private Integrations → create. Required scopes:
  - `contacts.readonly`, `contacts.write`
  - `customFields.readonly`, `customFields.write`
  - `tags.write`
  - `workflows.readonly`, `workflows.write` (optional in Phase 1)

### 4. Create SMS / email templates
- Templates → New template. Use `{{first_name}}`, `{{last_name}}`, `{{full_name}}` placeholders.

### 5. Create a campaign
- Campaigns → New.
- Pick a Retell agent ID + outbound phone number (E.164).
- Build the cadence — mix voice / SMS / email steps. Examples:
  - Voice, wait 1min
  - Voice, wait 5min
  - SMS (template: "Sorry we missed you")
  - Voice, next business day at 10:00
  - Email (template: "Following up")
- Set quiet hours + max attempts.
- Save → copy the **Start** + **Stop** webhook URLs from the campaign page.

### 6. Build the GHL workflows

**Workflow A — Start calling**

1. GHL → Automation → Workflows → blank.
2. Trigger: **Contact Tag Added** → tag = `ai-callback` (or your custom tag).
3. Action: **Webhook**.
   - URL: paste the Start URL.
   - Method: POST.
   - Headers: `Content-Type: application/json`.
   - Body:
     ```json
     {
       "contact_id": "{{contact.id}}",
       "location_id": "{{location.id}}",
       "phone": "{{contact.phone}}",
       "first_name": "{{contact.first_name}}",
       "last_name": "{{contact.last_name}}",
       "email": "{{contact.email}}",
       "timezone": "{{contact.timezone}}",
       "sms_consent": "{{contact.ai_sms_consent}}",
       "email_consent": "{{contact.ai_email_consent}}"
     }
     ```
4. Save + publish.

**Workflow B — Stop calling**

1. New workflow.
2. Trigger: **Appointment Booked** OR **Contact Tag Added** with tag `stop-ai-callback`.
3. Action: Webhook → Stop URL above.
   - Body: `{ "contact_id": "{{contact.id}}", "reason": "ghl_workflow" }`

### 7. Configure Twilio number webhooks (inbound)

In Twilio Console → Phone Numbers → your number:
- **A call comes in** → Webhook → `https://<your-clone>/api/twilio/voice?campaign_id=<campaign-id>`
- **A message comes in** → Webhook → `https://<your-clone>/api/twilio/sms`

Inbound voice routes back to the same Retell agent. Inbound SMS detects `STOP` keywords and cancels future sends.

### 8. Test

Use the campaign's **Send test webhook** button (coming in v1.1) — or manually add the `ai-callback` tag to a real contact and watch the Leads page.

## Phase 2 — Private Integration Token installer (ships v1.1)

Same as Phase 1 steps 1–5, then:

- Settings → GHL PIT field → paste token → save.
- Click **Install GHL snapshot** on each campaign.
- App provisions custom fields + tags via PIT, attempts to create/patch workflows automatically. If the GHL API doesn't expose workflow write for the agency's plan, falls back to one-step manual URL paste.

## Phase 3 — OAuth marketplace app (deferred)

After product-market fit. Lets agencies one-click connect with no PIT generation.
