// ---------------------------------------------------------------------------
// Incode B2B API helpers — v2
// Auth: OAuth 2.0 Client Credentials → Bearer token + x-api-key on every call
// ---------------------------------------------------------------------------

export function apiBaseFor(environment) {
  return environment === 'production'
    ? 'https://saas-api.incodesmile.com'
    : 'https://demo-api.incodesmile.com'
}

export function authBaseFor(environment) {
  return environment === 'production'
    ? 'https://auth.incode.com'
    : 'https://auth.demo.incode.com'
}

// ---------------------------------------------------------------------------
// OAuth — fetch a short-lived Bearer token using client credentials
// ---------------------------------------------------------------------------
export async function fetchBearerToken({ client, settings }) {
  const authBase = authBaseFor(settings.incodeEnvironment)

  const metadata = await client.metadata()
  const clientId     = metadata.settings.incodeClientId
  const clientSecret = metadata.settings.incodeClientSecret

  if (!clientId || !clientSecret) {
    throw new Error('Missing Incode Client ID or Client Secret in app settings.')
  }

  const res = await client.request({
    url: `${authBase}/oauth2/token`,
    type: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    data: `grant_type=client_credentials&scope=openid&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
    cors: true,
    headers: {
      Accept: 'application/json'
    }
  })

  const body = typeof res === 'string' ? safeJsonParse(res) : res
  const token = body?.access_token
  if (!token) throw new Error('Failed to obtain Incode Bearer token. Check Client ID and Client Secret.')
  return token
}

// ---------------------------------------------------------------------------
// Start verification — sends the IDV link via SMS, email, or both
// deliveryMethod: 'SMS' | 'EMAIL' | 'EMAIL_AND_SMS'
// ---------------------------------------------------------------------------
export async function startVerification({
  client,
  settings,
  ticketId,
  email,
  deliveryEmail,
  phone,
  deliveryMethod = 'EMAIL_AND_SMS'
}) {
  const token = await fetchBearerToken({ client, settings })
  const apiBase = apiBaseFor(settings.incodeEnvironment)

  // corporateEmail (email) is used for identity matching via loginHint
  // deliveryEmail overrides where the link is sent if different from corporate email
  const payload = {
    integrationReference: settings.incodeIntegrationReference || String(ticketId),
    externalCustomerId: String(ticketId),
    loginHint: email,
    notification: {
      type: deliveryMethod,
      ...(deliveryEmail && deliveryEmail !== email ? { email: deliveryEmail } : {}),
      ...(phone && deliveryMethod !== 'EMAIL' ? { phone } : {})
    }
  }

  if (settings.incodeLinkExpiryMinutes) {
    payload.linkExpiryMinutes = parseInt(settings.incodeLinkExpiryMinutes, 10)
  }

  const res = await client.request({
    url: `${apiBase}/omni/b2b/onboarding/request-new`,
    type: 'POST',
    contentType: 'application/json',
    secure: true,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': '{{setting.incodeApiKey}}',
      'api-version': '1.0',
      Accept: 'application/json'
    },
    data: JSON.stringify(payload)
  })

  return extractInterviewId(res)
}

// ---------------------------------------------------------------------------
// Get session status — called by webhook handler or as fallback poll
// ---------------------------------------------------------------------------
export async function getStatus({ client, settings, interviewId }) {
  const token = await fetchBearerToken({ client, settings })
  const apiBase = apiBaseFor(settings.incodeEnvironment)

  const res = await client.request({
    url: `${apiBase}/omni/b2b/onboarding/status/${encodeURIComponent(interviewId)}`,
    type: 'GET',
    secure: true,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': '{{setting.incodeApiKey}}',
      'api-version': '1.0',
      Accept: 'application/json'
    }
  })

  return normalizeStatus(res)
}

// ---------------------------------------------------------------------------
// Get all sessions for a requester (for history panel)
// Uses the requester email as the external customer identifier
// ---------------------------------------------------------------------------
export async function getSessionHistory({ client, settings, email }) {
  const token = await fetchBearerToken({ client, settings })
  const apiBase = apiBaseFor(settings.incodeEnvironment)

  try {
    const res = await client.request({
      url: `${apiBase}/omni/b2b/onboarding/sessions?loginHint=${encodeURIComponent(email)}&limit=20`,
      type: 'GET',
      secure: true,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': '{{setting.incodeApiKey}}',
        'api-version': '1.0',
        Accept: 'application/json'
      }
    })
    const body = typeof res === 'string' ? safeJsonParse(res) : res
    return body?.sessions || body?.data || body || []
  } catch {
    // History is non-critical — return empty if endpoint unavailable
    return []
  }
}

// ---------------------------------------------------------------------------
// Status classification
// ---------------------------------------------------------------------------
const SUCCESS_STATUSES = new Set(['SESSION_SUCCEEDED', 'ONBOARDING_FINISHED'])
const FAILED_STATUSES  = new Set(['SESSION_FAILED', 'ONBOARDING_FAILED', 'REJECTED'])
const REVIEW_STATUSES  = new Set(['SESSION_PENDING_REVIEW', 'PENDING_REVIEW', 'MANUAL_REVIEW'])

export function classifyOnboardingStatus(onboardingStatus) {
  if (!onboardingStatus) return 'pending'
  if (SUCCESS_STATUSES.has(onboardingStatus)) return 'success'
  if (FAILED_STATUSES.has(onboardingStatus))  return 'failed'
  if (REVIEW_STATUSES.has(onboardingStatus))  return 'manual_review'
  return 'pending'
}

// ---------------------------------------------------------------------------
// Webhook event classification (mirrors classifyOnboardingStatus)
// ---------------------------------------------------------------------------
export function classifyWebhookEvent(eventType) {
  if (!eventType) return null
  if (SUCCESS_STATUSES.has(eventType)) return 'success'
  if (FAILED_STATUSES.has(eventType))  return 'failed'
  if (REVIEW_STATUSES.has(eventType))  return 'manual_review'
  if (eventType === 'SESSION_STARTED') return 'pending'
  return null
}

// ---------------------------------------------------------------------------
// Delivery method helpers
// ---------------------------------------------------------------------------
export function deliveryMethodLabel(method) {
  switch (method) {
    case 'SMS':           return 'SMS'
    case 'EMAIL':         return 'Email'
    case 'EMAIL_AND_SMS': return 'SMS & Email'
    default:              return method
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function extractInterviewId(res) {
  if (!res) return { interviewId: null, raw: res }
  const body = typeof res === 'string' ? safeJsonParse(res) : res
  const interviewId =
    body?.interviewId ||
    body?.interview_id ||
    body?.data?.interviewId ||
    body?.session?.interviewId ||
    null
  return { interviewId, raw: body }
}

function normalizeStatus(res) {
  const body = typeof res === 'string' ? safeJsonParse(res) : res
  if (!body) return { onboardingStatus: null, completedAt: null, raw: body }
  const onboardingStatus =
    body.onboardingStatus ||
    body.status ||
    body.data?.onboardingStatus ||
    null
  const completedAt =
    body.completedAt ||
    body.completed_at ||
    body.data?.completedAt ||
    null
  return { onboardingStatus, completedAt, raw: body }
}

function safeJsonParse(s) {
  try { return JSON.parse(s) } catch { return null }
}