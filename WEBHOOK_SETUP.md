# Incode → Zendesk Webhook Setup

This guide configures Zendesk to receive real-time status events from Incode
(`SESSION_STARTED`, `SESSION_SUCCEEDED`, `SESSION_FAILED`, `SESSION_PENDING_REVIEW`)
and update the ticket automatically — no polling required.

---

## Step 1 — Create the Zendesk Webhook endpoint

1. Go to **Admin Center → Apps and integrations → Webhooks**
2. Click **Create webhook**
3. Fill in:
   - **Name:** `Incode Identity Verification`
   - **Endpoint URL:** `https://{your-subdomain}.zendesk.com/api/v2/tickets/update_many.json`
   - **HTTP method:** `POST`
   - **Request format:** `JSON`
   - **Authentication:** None (we validate via secret header instead)
4. Under **Custom headers**, add:
   - Header name: `x-incode-secret`
   - Header value: *(copy the Webhook Secret from your Incode dashboard — same pattern as Jira)*
5. Click **Create webhook**
6. Copy the **Webhook URL** Zendesk generates — you'll paste this into the Incode dashboard

---

## Step 2 — Register the webhook in Incode

1. In the Incode dashboard go to **Configuration → Webhooks**
2. Add the Zendesk webhook URL from Step 1
3. Subscribe to these events:
   - `SESSION_STARTED`
   - `SESSION_SUCCEEDED`
   - `SESSION_FAILED`
   - `SESSION_PENDING_REVIEW`
4. Under **Webhook Custom Headers**, add:
   - Key: `x-incode-secret`
   - Value: *(the Webhook Secret shown in your Incode dashboard)*
5. Save

---

## Step 3 — Create a Zendesk Action Flow to handle events

Because Zendesk webhooks receive a raw POST, you need an **Action Flow** to
parse the Incode payload and update the ticket's custom fields.

1. Go to **Admin Center → Apps and integrations → Action flows**
2. Click **Create action flow**
3. **Trigger:** Webhook received → select `Incode Identity Verification`
4. **Actions** (add in order):

   **Action 1 — Validate secret**
   - Type: Condition
   - If: `{{webhook.headers.x-incode-secret}}` equals `{{your_webhook_secret}}`
   - If false: Stop

   **Action 2 — Map event to status**
   - Type: Set variable `incode_status`
   - Value (use Switch/Condition logic):
     - `SESSION_STARTED`        → `incode_pending`
     - `SESSION_SUCCEEDED`      → `incode_success`
     - `SESSION_FAILED`         → `incode_failed`
     - `SESSION_PENDING_REVIEW` → `incode_manual_review`

   **Action 3 — Update ticket**
   - Type: Update ticket
   - Ticket ID: `{{webhook.body.integrationReference}}` *(this is the Zendesk ticket ID)*
   - Custom field: `Incode Verification Status` → `{{incode_status}}`
   - Custom field: `Incode Interview ID` → `{{webhook.body.interviewId}}`

   **Action 4 — Post internal note (on terminal events only)**
   - Type: Condition → if `incode_status` is `incode_success` or `incode_failed`
   - Add comment (internal): `Incode verification status updated to {{incode_status}}`

5. Save and activate the flow

---

## Step 4 — Test the webhook

In the Incode dashboard, use the **Send test event** button on your webhook.
Check the Zendesk ticket — the `Incode Verification Status` field should update
within seconds, and the sidebar will reflect the new state on next load.

---

## Payload reference

Incode sends a JSON body like this:

```json
{
  "event":               "SESSION_SUCCEEDED",
  "interviewId":         "abc123",
  "integrationReference": "12345",
  "onboardingStatus":    "SESSION_SUCCEEDED",
  "completedAt":         "2026-06-03T18:00:00Z",
  "loginHint":           "employee@company.com"
}
```

`integrationReference` = the Zendesk ticket ID (set when the verification was started).
