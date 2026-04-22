#!/usr/bin/env bash
# Registers the Incode ZIS integration and uploads the bundle.
#
# Prereqs: the following env vars must be set (export them before running):
#   ZENDESK_SUBDOMAIN     e.g. d3v-incode
#   ZENDESK_EMAIL         admin email on that tenant
#   ZENDESK_API_TOKEN     API token from Admin Center → Apps and integrations → APIs → Zendesk API
#
# Usage:
#   ./zis/deploy.sh
#
# After this script:
#   1. Go to Admin Center → Apps and integrations → Connections (or Integrations,
#      depending on your tenant) and authorize the "Incode Identity Verification"
#      integration via OAuth. This creates the Zendesk connection ZIS uses to
#      write ticket updates.
#   2. Create the inbound webhook + subscription via the Admin UI, or via
#      `POST /api/services/zis/inbound_webhooks/generic` using an OAuth bearer
#      token from an integration-scoped client. The returned ingest URL goes
#      into: (a) the app's `zisIngestUrl` parameter at install time and (b)
#      Incode's onboarding flow webhook config.
#
# This script is idempotent-ish: re-running will re-register and re-upload.
set -euo pipefail

: "${ZENDESK_SUBDOMAIN:?must be set}"
: "${ZENDESK_EMAIL:?must be set}"
: "${ZENDESK_API_TOKEN:?must be set}"

BASE="https://${ZENDESK_SUBDOMAIN}.zendesk.com"
AUTH="${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}"
INTEGRATION="incode_identity_verification"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Registering integration $INTEGRATION"
curl -fsS -u "$AUTH" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"description\":\"Receives Incode verification webhooks and updates the ticket\",\"jwt_public_key\":\"\"}" \
  "$BASE/api/services/zis/registry/$INTEGRATION" \
  | python3 -m json.tool || true

echo
echo "==> Uploading bundle"
curl -fsS -u "$AUTH" \
  -X POST -H "Content-Type: application/json" \
  --data @"$SCRIPT_DIR/bundle.json" \
  "$BASE/api/services/zis/registry/$INTEGRATION/bundles" \
  && echo "bundle uploaded" || echo "bundle upload failed"

echo
echo "==> Creating installation record"
curl -fsS -u "$AUTH" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$INTEGRATION\",\"name\":\"${INTEGRATION}_install\"}" \
  "$BASE/api/services/zis/registry/$INTEGRATION/installations" \
  | python3 -m json.tool || true

echo
echo "==> Done. Next steps (manual, one-time per tenant):"
echo "   1. Authorize the integration via OAuth in Admin Center."
echo "   2. Create the inbound webhook for source_system=incode,"
echo "      event_type=verification_update, bound to flow"
echo "      zis:$INTEGRATION:flow:incode_verification_webhook."
echo "   3. Copy the returned ingest URL into the app's zisIngestUrl"
echo "      setting and into Incode's onboarding flow webhook config."
