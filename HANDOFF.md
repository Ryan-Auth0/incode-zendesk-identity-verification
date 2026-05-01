# Incode Identity Verification — Zendesk app · V1 handoff

**Last updated:** 2026-05-01
**Owner during build:** Harsha Balakrishnan (harsha.balakrishnan@incode.com)
**Dev tenant:** `d3v-incode.zendesk.com` (Suite Enterprise sandbox)
**Repo:** local only at `/Users/harsha/Desktop/Claude Code/incode-zendesk-identity-verification` (not yet on GitHub)
**Latest commit:** `31b89f6` — *Pivot V1 from ZIS webhook to sidebar polling*

This document is the single-page status of the project. The
[root README](./README.md) covers architecture and setup; this doc
covers **what state the project is in right now and what's left to do**.

---

## TL;DR

V1 ships as a **private Zendesk Support app** that does identity
verification end-to-end. The app is **code-complete, lints clean,
builds clean, and is packaged**. It has not yet been installed in the
dev tenant or tested end-to-end on a real ticket — that's the immediate
next step for whoever picks this up.

The original architecture (ZIS inbound webhook) was replaced with
**sidebar polling** because the ZIS install flow requires a Zendesk
Marketplace Partner Program account to sign OAuth state JWTs — see
[Why ZIS was deferred](#why-zis-was-deferred) below. The ZIS
artefacts are kept in the repo for V2.

---

## Status by component

### 1. ZAF sidebar app (`app/`)

**Status: code-complete, packaged, NOT YET TESTED ON A REAL TICKET.**

- [x] React + Zendesk Garden scaffold via `zcli apps:new --scaffold=react`
- [x] Four sidebar states: `IdleState`, `PendingState`, `SuccessState`, `FailedState`
- [x] `useTicketContext` hook resolves custom field IDs by title, exposes
      `setField`, `postInternalNote`, `reload`
- [x] `lib/incode.js` — `startVerification`, `getStatus`, `classifyOnboardingStatus`,
      `apiBaseFor`, `mapNotificationType`. API host derived from
      `incodeEnvironment` setting (no hardcoded URLs)
- [x] Calls Incode B2B API via `client.request({ secure: true })` with
      `{{setting.incodeApiKey}}` placeholder — secret never exposed to iframe
- [x] `requirements.json` auto-provisions three custom ticket fields
- [x] `manifest.json` is V1-correct: `private: true`, `singleInstall: true`,
      `domainWhitelist`, all secure params use `type: "text"` + `secure: true`
      (no deprecated `type: "password"`)
- [x] `npm run lint` clean (`--max-warnings 0`)
- [x] `npm run build` clean
- [x] `zcli apps:package ./dist` produces a valid zip (validates against
      tenant remotely)

**Latest packaged artifact:** `app/dist/tmp/app-20260422164349809.zip`
(regenerate any time with `npm run build && zcli apps:package ./dist`).

### 2. ZIS bundle (`zis/`)

**Status: registered in `d3v-incode` tenant but NOT INSTALLED. Deferred to V2.**

- [x] Integration `incode_identity_verification` registered (id 48492885298452)
- [x] Integration `incode_idv` registered with our public key (id 48493464322452)
- [x] Bundle (`bundle.json`) uploaded — `update_ticket` action +
      `incode_verification_webhook` flow are live in the registry
- [x] Installation record created (id 54427, uuid
      `44acf146-7972-4737-881c-21eaba81861c`) — empty shell, no connections
- [x] `deploy.sh` script that re-runs registration + upload
- [ ] OAuth install flow → BLOCKED on Marketplace Partner Program (see
      [Why ZIS was deferred](#why-zis-was-deferred))
- [ ] Inbound webhook creation → blocked downstream of OAuth install

The flow logic itself was validated by the ZIS schema validator (HTTP
200 on bundle upload), so when V2 picks this up, the only missing piece
is the OAuth signing key.

### 3. Documentation

- [x] Root [README.md](./README.md) — architecture, setup, settings,
      packaging, testing, V2 plan
- [x] [`zis/README.md`](./zis/README.md) — V2 deferral banner, deploy
      instructions, schema notes learned from probing the ZIS API
- [x] `app/zcli.apps.config.example.json` — template for dev-time
      parameter values (gitignored: real `zcli.apps.config.json`)
- [x] This handoff doc

### 4. Source control

- [x] `git init -b main` with `.gitignore` covering `node_modules/`,
      `dist/`, `tmp/`, `zcli.apps.config.json`, `.env*`
- [x] Two commits on `main`:
  - `6306289` Initial V1 scaffold (ZIS-based)
  - `31b89f6` Pivot V1 from ZIS webhook to sidebar polling
- [ ] Not yet pushed to GitHub — user wanted local-only until ready

---

## What's left to do

In priority order:

### Immediate (whoever picks this up)

1. **Install the packaged app in `d3v-incode`**
   - Admin Center → Apps and integrations → Zendesk Support apps →
     Upload private app
   - Upload `app/dist/tmp/app-20260422164349809.zip`
   - Fill in app settings:
     - `incodeApiKey` — sandbox API key (request from Incode B2B team
       if not on hand)
     - `incodeEnvironment` — `sandbox`
     - `incodeConfigurationId` — sandbox onboarding config ID
     - `notificationMode` — `email_and_sms`
     - `pollIntervalSeconds` — `7`
     - `maxPollDurationMinutes` — `30`
     - The three `msg_*` fields can be left at default
   - Confirm the three custom ticket fields appear (Admin → Tickets → Fields)

2. **End-to-end happy-path test**
   - Create a Zendesk ticket with a real email + phone in the requester record
   - Open the ticket; sidebar should show **Idle** state
   - Click **Start verification**
   - Requester should receive SMS + email with a verification link
   - Confirm sidebar flips to **Pending** with a spinner and "Last
     checked HH:MM:SS · checking every 7s"
   - Complete IDV on the phone
   - Within ~7s sidebar should flip to **Success** with green tag,
     verified date, interview ID
   - Confirm internal note posted on the ticket

3. **Likely first issue to fix: the Incode status endpoint URL**
   - I guessed `GET /omni/b2b/onboarding/status/{interviewId}` based on
     standard Incode API patterns — this may be wrong
   - If the polling step fails with 404 or similar, check Incode B2B
     API docs (or the Jira integration at
     `https://github.com/Ryan-Auth0/incode-jira-identity-verification`)
     for the correct endpoint
   - Update `app/src/app/lib/incode.js` `getStatus` function — only
     the URL line needs to change

4. **Verify the response shape**
   - `extractInterviewId` and `normalizeStatus` in `lib/incode.js` try
     several common field names (`interviewId`, `interview_id`, nested
     under `data` or `session`, etc.)
   - If neither succeeds, log the raw response from Incode and adjust
     the field name lookup

### Soon after

5. **Failure path test** — force-fail on Incode side, confirm
   `incode_failed` tag + failure note + Retry button
6. **Field auto-provisioning test** — uninstall and reinstall the app,
   confirm fields disappear and reappear
7. **Idempotency / multi-agent test** — open the same ticket in two
   browsers as two agents, complete verification, confirm the internal
   note is posted only once (or twice — see [Known issues](#known-issues))
8. **Accessibility smoke test** — keyboard-only nav through all four
   states, VoiceOver announces transitions, focus ring visible, WCAG
   2.1 AA contrast

### Pilot

9. **Capture screenshots of all four sidebar states + a demo video**
   for V2 Marketplace assets
10. **Pilot with one external customer** — share the zip + this
    document; have them install in their tenant and run through the
    same test checklist
11. **Rotate the API token** that was used during build
    (`T7blMZoZ6TopTVoNm8s5Odral3SHLqijN5oc4tPl`) — created for `zcli-dev`
    in `d3v-incode`, no longer needed

### V2

12. **Apply to Zendesk Marketplace Partner Program** — that's the
    blocker for ZIS install
13. **Once approved**, swap polling → ZIS webhook (the bundle is
    ready; only the signed install URL is missing)
14. **Preview App submission** for customer pilots at scale
15. **Marketplace listing** — brand assets, listing copy, screenshots,
    `X-Zendesk-Marketplace-*` headers on the ticket-update action

---

## Why ZIS was deferred

The PRD specified ZIS (Zendesk Integration Services) so that Incode
could POST verification results directly to a Zendesk-hosted ingest
URL, with a ZIS Flow updating the ticket. That architecture is correct
and we got most of the way there:

- ✅ Integration registered via `POST /api/services/zis/registry/...`
- ✅ Bundle (action + flow) uploaded and validated
- ❌ OAuth install flow rejected — every state JWT we signed got
  `signature is invalid`

After multiple attempts (HS256 with the OAuth client secret, RS256
with our own RSA keypair submitted as `jwt_public_key`, registering a
fresh integration with our key from the start), the conclusion is that
**Zendesk's auth server uses a key registered through the Marketplace
Partner Program — not the `jwt_public_key` accepted by the public
registry API**. The public field appears to be a display artefact;
verification uses a separate, partner-program-issued key.

Without Partner Program access, the install flow can't complete →
no ZIS connection → no inbound webhook → no ingest URL.

**Polling is the V1 workaround.** The sidebar polls Incode's status
endpoint while in the pending state and updates the ticket itself.
Same UX, ~7 s of latency vs instant webhook.

---

## Known issues

1. **Incode status endpoint is a guess** — `GET /omni/b2b/onboarding/status/{interviewId}`
   may need correction (see *What's left to do · 3*).
2. **Multi-agent duplicate notes** — if two agents have the same ticket
   open during a status transition, both browsers may post the internal
   note. Low impact (notes aren't customer-visible). Fix: check
   current status field before posting.
3. **`zcli apps:server` doesn't honour `secure: true` or `default:`** —
   put dev values in `app/zcli.apps.config.json` (gitignored).
4. **Polling stops when the agent closes the ticket.** When they
   reopen, the pending state resumes — first poll happens immediately.
   Documented; intentional.
5. **API token used during build (`T7blMZoZ6TopTVoNm8s5Odral3SHLqijN5oc4tPl`)
   was pasted into chat history.** Rotate before sharing repo or
   transcripts externally.

---

## Architecture diagrams

### V1 — what's shipping

```
agent's browser              Zendesk                         Incode
─────────────────            ─────────                       ──────
sidebar (iframe) ─────────►  ZAF proxy ─────secure────────►  /omni/b2b/onboarding/request-new
                                                              ◄─── { interviewId }
sidebar polls every 7s ──►   ZAF proxy ─────secure────────►  /omni/b2b/onboarding/status/{id}
                                                              ◄─── { onboardingStatus, completedAt }
sidebar (on terminal status):
  client.set(field, value)   updates ticket fields locally
  client.request(PUT /api/v2/tickets/{id})  posts internal note
```

### V2 — what's queued

```
agent's browser              Zendesk                         Incode
─────────────────            ─────────                       ──────
sidebar (iframe) ─────────►  ZAF proxy ─────secure────────►  /omni/b2b/onboarding/request-new
                                                              ◄─── { interviewId }
                             ZIS inbound webhook   ◄─────── Incode posts on status change
                                  │
                                  ▼
                             ZIS Flow (incode_verification_webhook)
                                  │
                                  ▼
                             update_ticket action (PUT /api/v2/tickets/{id})
```

---

## Key files reference

| Path                                        | Purpose                                     |
| ------------------------------------------- | ------------------------------------------- |
| `app/src/manifest.json`                     | App identity + parameters + domain whitelist |
| `app/src/requirements.json`                 | Auto-provisioned custom ticket fields       |
| `app/src/app/locations/TicketSideBar.jsx`   | Routes to one of four state components      |
| `app/src/app/components/IdleState.jsx`      | Start button + missing-email guard          |
| `app/src/app/components/PendingState.jsx`   | Polling loop + terminal-status handling     |
| `app/src/app/components/SuccessState.jsx`   | Green chip + verified-at + interview-id     |
| `app/src/app/components/FailedState.jsx`    | Red chip + Retry button                     |
| `app/src/app/hooks/useTicketContext.js`     | Field resolution + setField + postInternalNote |
| `app/src/app/lib/incode.js`                 | Incode API calls + status classification    |
| `zis/bundle.json`                           | V2 ZIS bundle (registered, not installed)   |
| `zis/deploy.sh`                             | V2 ZIS register + upload script             |

---

## Contact / handoff

If you're picking this up:

1. Read this doc, then the [root README](./README.md).
2. Skim the two latest commits (`git log --oneline -2`).
3. Run the immediate checklist above. Most likely you'll need to
   adjust the Incode status endpoint path on the first poll attempt.
4. The original PRD and handoff brief are in Notion (links were in
   the kickoff brief — page IDs `3494c3caef4981568e49ff33e786aea8`
   and `3494c3caef49816c9a94cd63e1c90786`).
