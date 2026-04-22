# Incode Identity Verification — Zendesk app (V1, private)

A Zendesk Support sidebar app that lets a help desk agent trigger Incode
biometric identity verification on the ticket requester with one click.
Results are written back to the ticket via Zendesk Integration Services
(ZIS).

This is **V1** — packaged as a **private app** for pilot customers.
Marketplace listing is a separate V2 effort.

## Architecture

- **ZAF v2 sidebar app** (`app/`) — React + Zendesk Garden, runs in
  `ticket_sidebar` of the Agent Workspace. Calls the Incode B2B API via
  `client.request({ secure: true })` so the API key stays in the Zendesk
  proxy and never reaches the iframe.
- **ZIS bundle** (`zis/`) — an inbound webhook + flow + custom action that
  receives Incode's verification callbacks and PUTs the ticket with three
  custom fields plus an internal note.
- No external infrastructure. Everything runs inside Zendesk.

## Directory structure

```
incode-zendesk-identity-verification/
├── README.md
├── app/
│   ├── src/
│   │   ├── manifest.json
│   │   ├── requirements.json
│   │   ├── index.html
│   │   ├── app/
│   │   │   ├── App.jsx
│   │   │   ├── index.jsx
│   │   │   ├── locations/TicketSideBar.jsx
│   │   │   ├── components/
│   │   │   │   ├── IdleState.jsx
│   │   │   │   ├── PendingState.jsx
│   │   │   │   ├── SuccessState.jsx
│   │   │   │   └── FailedState.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── useClient.js
│   │   │   │   └── useTicketContext.js
│   │   │   ├── lib/incode.js
│   │   │   └── contexts/
│   │   └── translations/
│   ├── package.json
│   └── vite.config.js
└── zis/
    ├── manifest.json
    ├── flow.json
    └── action.json
```

## Prerequisites

- Node ≥ 20
- npm
- `zcli` (`npm install -g @zendesk/zcli`)
- A Zendesk dev tenant (we use `d3v-incode.zendesk.com`)
- An Incode sandbox tenant with:
  - B2B API key
  - Onboarding configuration ID
  - Ability to set a webhook target URL on the flow

## App settings (install time)

| Setting                 | Type             | Notes                                                    |
| ----------------------- | ---------------- | -------------------------------------------------------- |
| `incodeApiKey`          | text (secure)    | Sent in the `x-api-key` header via ZAF proxy.            |
| `incodeEnvironment`     | text             | `sandbox` or `production` — derives the API host.        |
| `incodeConfigurationId` | text             | Incode onboarding configuration ID.                       |
| `notificationMode`      | text             | `email_and_sms`, `email_only`, or `sms_only`.            |
| `msg_pending`           | multiline        | Shown in the sidebar while waiting.                      |
| `msg_success`           | multiline        | Shown on success; also posted as an internal note.       |
| `msg_failed`            | multiline        | Shown on failure; also posted as an internal note.       |
| `zisIngestUrl`          | text (secure)    | ZIS inbound webhook URL (from `zcli zis:upload`).        |

Secure values are never exposed to the iframe — they only go out through
`client.request({ secure: true })` with `{{setting.*}}` placeholders that
the ZAF proxy substitutes server-side.

## Custom fields

Three fields are auto-provisioned on install via `requirements.json` and
removed on uninstall. The app looks them up by title on first load and
caches the IDs in `sessionStorage`:

- **Incode Verification Status** (`tagger`: `incode_pending`, `incode_success`, `incode_failed`)
- **Incode Interview ID** (`text`)
- **Incode Verified At** (`date`)

## Local development

```bash
cd app
npm install
npm run dev           # Vite on http://localhost:3000
npm run start         # zcli apps:server src (in a second terminal)
```

Open a Zendesk ticket and append `?zcli_apps=true` to the URL so the
iframe loads from your local server.

`zcli apps:server` does **not** honour `secure: true` or `default:` values
from the manifest. Put dev-time parameter values in
`app/zcli.apps.config.json` (gitignored):

```json
{
  "parameters": {
    "incodeApiKey": "...",
    "incodeEnvironment": "sandbox",
    "incodeConfigurationId": "...",
    "notificationMode": "email_and_sms",
    "zisIngestUrl": "https://d3v-incode.zendesk.com/api/services/zis/inbound_webhooks/generic/ingest/<token>"
  }
}
```

## ZIS deployment

```bash
zcli zis:bundle --path ./zis
zcli zis:upload --subdomain d3v-incode
```

The upload returns an ingest URL; paste it into Incode's onboarding flow
webhook config and into the app's `zisIngestUrl` setting.

The ZIS Connection holds the Zendesk service-account API token used to
call `/api/v2/tickets/:id.json`. It is created separately — never commit
credentials.

## Packaging for pilot distribution

```bash
cd app
npm run build
zcli apps:package --path ./dist
```

This produces `tmp/*.zip`. Pilots install it in their tenant via:

> Admin Center → Apps and integrations → Zendesk Support apps → Upload private app

At install they fill in the parameters listed above.

## Hard constraints (gotchas)

- `secure: true` on parameters (never `type: "password"` — deprecated April 29, 2026).
- `domainWhitelist` not `domains`; entries without `https://`.
- Headers must use dashes (`x-api-key`), not underscores — ZAF proxy strips `_`.
- `secure: true` and `cors: true` are mutually exclusive on `client.request` — we never set `cors: true`.
- `{{setting.*}}` placeholders work only inside `client.request()`.
  Secure settings are not returned by `client.metadata()`.
- Sidebar max width is 320 px.

## V1 test checklist

1. **Happy path.** Create a ticket, click *Start verification*, complete IDV
   on phone, confirm sidebar flips to Success within 2–3 s and the internal
   note is posted.
2. **Failed verification.** Force-fail on Incode side; verify `incode_failed`
   tag + failure note + Retry button.
3. **Field auto-provisioning.** Uninstall and reinstall — fields disappear
   and reappear.
4. **Idempotency.** Replay the same webhook via curl; ticket updates exactly once.
5. **Rate limits.** `Update Ticket` is capped at 30 per 10 min per agent —
   document as a known constraint.
6. **Header underscore.** Try `x_api_key` in code → confirm Incode rejects.
7. **A11y smoke test.** Keyboard-only nav through all four states,
   VoiceOver announces state transitions, focus ring visible, WCAG 2.1 AA
   contrast.

## V2 scope (out of scope in V1)

- Marketplace listing + Preview App submission
- Global OAuth (`zdg-` prefix) for ZIS Connection
- `X-Zendesk-Marketplace-*` headers on the ZIS action
- Brand assets, listing copy, screenshots

None of those change the app's runtime behaviour.
