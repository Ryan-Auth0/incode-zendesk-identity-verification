# ZIS bundle — Incode Identity Verification

> **⚠️ Deferred to V2.** V1 pilots use polling from the ZAF sidebar app
> instead of ZIS. See the root [README](../README.md) for why. The
> artefacts here are kept so V2 can switch to webhook-driven updates
> without rewriting the flow logic.

Zendesk Integration Services (ZIS) resources that receive Incode webhook
callbacks and update the Zendesk ticket.

## Files

- `manifest.json` — bundle identity.
- `bundle.json` — the full ZIS bundle spec (one file, used directly by the
  ZIS registry API). Contains:
  - `update_ticket` — a `ZIS::Action::Http` that PUTs
    `/api/v2/tickets/{id}.json` with three custom fields + internal note.
  - `incode_verification_webhook` — a `ZIS::Flow` (Amazon States Language)
    that routes `event.data.onboardingStatus` onto success / failure /
    pending branches.
- `deploy.sh` — registers the integration, uploads the bundle, and creates
  the installation record via the ZIS REST API. Authenticates with an
  admin API token.

## Deploy (V2, after Marketplace Partner Program approval)

The script below registers the integration and uploads the bundle, which
works against the public ZIS registry API. What does NOT work without
Partner Program keys is the **OAuth install flow** that produces the
ingest URL — Zendesk's auth server rejects state JWTs signed with keys
submitted via the registry API.

```bash
export ZENDESK_SUBDOMAIN=d3v-incode
export ZENDESK_EMAIL=your-admin@example.com
export ZENDESK_API_TOKEN=<token>
./zis/deploy.sh
```

After the script finishes, two steps remain that require the Zendesk
Admin UI (because the inbound-webhook creation endpoint does not accept
API-token auth — only an integration-scoped OAuth access token):

1. **Authorize the integration** — Admin Center → Apps and integrations →
   Integrations → find **Incode Identity Verification** → Install. This
   completes the OAuth handshake that lets ZIS call `/api/v2/tickets/*`
   on behalf of this tenant.
2. **Create the inbound webhook** — Admin Center → Apps and integrations →
   Webhooks (or the ZIS section) → New inbound webhook, source system
   `incode`, event type `verification_update`, subscribed to the flow
   `zis:incode_identity_verification:flow:incode_verification_webhook`.
   Copy the returned ingest URL.

Paste that ingest URL into:

1. The ZAF app's `zisIngestUrl` setting when installing the private app.
2. Incode's onboarding flow webhook config (as the target URL).

## Expected inbound payload

```json
{
  "clientId": "...",
  "interviewId": "...",
  "externalCustomerId": "1234",
  "onboardingStatus": "SESSION_SUCCEEDED",
  "completedAt": "2026-04-22T14:03:00Z"
}
```

`externalCustomerId` is the Zendesk ticket ID (set by the app when it
calls `/omni/b2b/onboarding/request-new`).

## Status mapping

| `onboardingStatus` value                          | Branch          | Tag              |
| ------------------------------------------------- | --------------- | ---------------- |
| `SESSION_SUCCEEDED`, `ONBOARDING_FINISHED`        | `update_success`| `incode_success` |
| `SESSION_FAILED`, `ONBOARDING_FAILED`, `REJECTED` | `update_failed` | `incode_failed`  |
| anything else                                     | `update_pending`| `incode_pending` |

## Bundle-time values (`$.bundle.*`)

The flow references four bundle-level values that must be set at install
time (via the Admin UI during authorization):

- `status_field_id` — ticket field ID for "Incode Verification Status"
- `interview_field_id` — ticket field ID for "Incode Interview ID"
- `verified_at_field_id` — ticket field ID for "Incode Verified At"
- `msg_pending`, `msg_success`, `msg_failed` — agent-message strings that
  mirror the ZAF app settings of the same names

The three field IDs are produced automatically by the ZAF app's
`requirements.json` when the app is installed — look them up via
`/api/v2/ticket_fields.json` after install and paste them into the ZIS
integration's bundle-level variables.

## ZIS schema notes (learned from the registry API)

- `zis_template_version` must be `"2019-10-14"`.
- `ZIS::Action::Http` definition accepts `method`, `path`, `headers`
  only — the body is not in `definition`. The `schema` property at
  `properties` level is a JSON Schema describing the action parameters,
  and ZIS serializes those parameters as the JSON request body at
  invocation time.
- Flow state `Choices` use JSONPath variables (`$.data.*`, not
  `{{event.data.*}}`). `Parameters` on `Action` states use the
  `"key.$": "$.path"` convention to pull runtime values.
