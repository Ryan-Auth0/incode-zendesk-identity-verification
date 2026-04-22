# Incode Identity Verification — Zendesk app (V1, private)

A Zendesk Support sidebar app that lets a help desk agent trigger Incode
biometric identity verification on the ticket requester with one click.
Results are written back to the ticket by the app itself, which polls
Incode's status endpoint while a verification is in progress.

This is **V1** — packaged as a **private app** for pilot customers.
Marketplace listing is a separate V2 effort.

## Architecture — V1 (polling)

- **ZAF v2 sidebar app** (`app/`) — React + Zendesk Garden, runs in
  `ticket_sidebar` of the Agent Workspace. Calls the Incode B2B API via
  `client.request({ secure: true })` so the API key stays in the Zendesk
  proxy and never reaches the iframe.
- **Status flow while pending**: the sidebar polls Incode every
  `pollIntervalSeconds` (default 7) while the ticket is open in an
  agent's browser. On terminal status, it updates three custom fields
  and posts an internal note via the Zendesk ticket API.
- **No ZIS, no external infrastructure.** Everything runs inside
  Zendesk.

### Why polling in V1?

The PRD originally specified Zendesk Integration Services (ZIS) with an
inbound webhook that Incode POSTs to. Registering an ZIS integration
works via REST API, but **completing the install flow** (which is what
produces the ingest URL) requires signing an OAuth state JWT with a key
registered through the Zendesk Marketplace Partner Program — that key is
not the `jwt_public_key` accepted by the public registry API. Applying
to the Partner Program takes days-to-weeks, and V1 pilot needed to ship
this week.

Polling keeps the sidebar UX identical (4 states, chip + message, copy
button, retry) and costs 5–10 s of latency vs instant webhook. Pilot
customers won't notice. When the Partner Program is approved, V2 can
swap to the ZIS architecture — the `zis/` bundle artefacts are already
written and registered in the `d3v-incode` dev tenant.

## Directory structure

```
incode-zendesk-identity-verification/
├── README.md
├── app/                          # ZAF v2 sidebar app
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
│   │   │   │   ├── PendingState.jsx      # polls Incode every N seconds
│   │   │   │   ├── SuccessState.jsx
│   │   │   │   └── FailedState.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── useClient.js
│   │   │   │   └── useTicketContext.js   # resolves custom field IDs,
│   │   │   │                             # exposes setField + postInternalNote
│   │   │   ├── lib/incode.js             # startVerification, getStatus,
│   │   │   │                             # classifyOnboardingStatus
│   │   │   └── contexts/
│   │   └── translations/
│   ├── package.json
│   └── vite.config.js
└── zis/                          # DEFERRED TO V2 — do not deploy for pilots
    ├── manifest.json
    ├── bundle.json               # full ZIS bundle spec
    ├── deploy.sh                 # registers integration + uploads bundle
    └── README.md
```

## Prerequisites

- Node ≥ 20
- npm
- `zcli` (`npm install -g @zendesk/zcli`)
- A Zendesk dev tenant (we use `d3v-incode.zendesk.com`)
- An Incode sandbox tenant with:
  - B2B API key
  - Onboarding configuration ID

## App settings (install time)

| Setting                   | Type             | Notes                                                       |
| ------------------------- | ---------------- | ----------------------------------------------------------- |
| `incodeApiKey`            | text (secure)    | Sent in the `x-api-key` header via ZAF proxy.               |
| `incodeEnvironment`       | text             | `sandbox` or `production` — derives the API host.           |
| `incodeConfigurationId`   | text             | Incode onboarding configuration ID.                          |
| `notificationMode`        | text             | `email_and_sms`, `email_only`, or `sms_only`.               |
| `pollIntervalSeconds`     | text             | How often the sidebar polls Incode (default `7`).           |
| `maxPollDurationMinutes`  | text             | Stop polling after this long (default `30`).                |
| `msg_pending`             | multiline        | Shown in the sidebar while waiting.                         |
| `msg_success`             | multiline        | Shown on success + posted as an internal note.              |
| `msg_failed`              | multiline        | Shown on failure + posted as an internal note.              |

The Incode API key is marked `secure: true`. It is never exposed to the
iframe — it only goes out through `client.request({ secure: true })`
with the `{{setting.incodeApiKey}}` placeholder that the ZAF proxy
substitutes server-side.

## Custom fields

Three fields are auto-provisioned on install via `requirements.json`
and removed on uninstall. The app looks them up by title on first load
and caches the IDs in `sessionStorage`:

- **Incode Verification Status** (`tagger`: `incode_pending`, `incode_success`, `incode_failed`)
- **Incode Interview ID** (`text`)
- **Incode Verified At** (`date`)

## Behaviour

1. **Idle** — sidebar shows *Start verification* button. On click, the
   app POSTs to `/omni/b2b/onboarding/request-new`, stores the returned
   `interviewId` in the `Incode Interview ID` field, and sets status to
   `incode_pending`.
2. **Pending** — sidebar shows a spinner + configured message +
   *Copy status note* button. The app polls
   `GET /omni/b2b/onboarding/status/{interviewId}` every
   `pollIntervalSeconds`. Poll stops when (a) status becomes terminal,
   (b) the agent closes the ticket, or (c) `maxPollDurationMinutes`
   elapses.
3. **Success** — on success, the app sets status to `incode_success`,
   sets `Incode Verified At` to today's date, posts `msg_success` as an
   internal note, and shows the green state.
4. **Failed** — on failure, the app sets status to `incode_failed`,
   posts `msg_failed` as an internal note, and shows the red state with
   a *Retry verification* button (which starts a fresh verification
   session with a new interview ID).

Multiple agents viewing the same ticket will each poll. The PUT that
updates the ticket is idempotent on `incode_verification_status` (same
tag, same PUT), but the internal note could be posted twice. Real-world
impact: low — internal notes aren't customer-visible. If it becomes an
issue, add a check that reads the current status field before posting.

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
`app/zcli.apps.config.json` (gitignored — see `zcli.apps.config.example.json`).

## Packaging for pilot distribution

```bash
cd app
npm run build
zcli apps:package ./dist
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

1. **Happy path.** Create a ticket, click *Start verification*, complete
   IDV on phone, confirm sidebar flips to Success within ~10 s of
   completion (one poll cycle at default interval) and the internal
   note is posted.
2. **Failed verification.** Force-fail on Incode side; verify
   `incode_failed` tag + failure note + Retry button.
3. **Field auto-provisioning.** Uninstall and reinstall — fields
   disappear and reappear.
4. **Timeout.** Leave a ticket in pending state for >
   `maxPollDurationMinutes`; confirm the "Stopped checking" notice
   appears and polling halts.
5. **Rate limits.** `Update Ticket` is capped at 30 per 10 min per agent —
   document as a known constraint.
6. **Header underscore.** Try `x_api_key` in code → confirm Incode rejects.
7. **A11y smoke test.** Keyboard-only nav through all four states,
   VoiceOver announces state transitions, focus ring visible, WCAG 2.1 AA
   contrast.

## V2 plan (out of scope in V1)

- Marketplace Partner Program application + approval.
- Swap polling → ZIS webhook (the `zis/bundle.json` is ready; only the
  signed install flow is missing, and that arrives with Partner Program
  access).
- Preview App submission for customer pilots at scale.
- Global OAuth on the ZIS Connection.
- `X-Zendesk-Marketplace-*` headers on the ticket-update action.
- Brand assets, listing copy, screenshots.

None of those change the app's runtime behaviour.
