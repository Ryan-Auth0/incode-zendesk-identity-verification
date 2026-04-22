export function apiBaseFor(environment) {
  return environment === 'production'
    ? 'https://api.incode.com'
    : 'https://demo-api.incode.com'
}

export function mapNotificationType(mode) {
  switch (mode) {
    case 'email_only':
      return 'EMAIL'
    case 'sms_only':
      return 'SMS'
    case 'email_and_sms':
    default:
      return 'EMAIL_AND_SMS'
  }
}

export async function startVerification({ client, settings, ticketId, email, phone }) {
  const apiBase = apiBaseFor(settings.incodeEnvironment)

  const payload = {
    integrationReference: String(ticketId),
    loginHint: email,
    externalCustomerId: String(ticketId),
    configurationId: settings.incodeConfigurationId,
    notification: { type: mapNotificationType(settings.notificationMode) }
  }
  if (phone) payload.phone = phone

  const res = await client.request({
    url: `${apiBase}/omni/b2b/onboarding/request-new`,
    type: 'POST',
    contentType: 'application/json',
    secure: true,
    headers: {
      'x-api-key': '{{setting.incodeApiKey}}',
      'api-version': '1.0',
      'Accept': 'application/json'
    },
    data: JSON.stringify(payload)
  })

  return extractInterviewId(res)
}

export async function getStatus({ client, settings, interviewId }) {
  const apiBase = apiBaseFor(settings.incodeEnvironment)
  const res = await client.request({
    url: `${apiBase}/omni/b2b/onboarding/status/${encodeURIComponent(interviewId)}`,
    type: 'GET',
    secure: true,
    headers: {
      'x-api-key': '{{setting.incodeApiKey}}',
      'api-version': '1.0',
      'Accept': 'application/json'
    }
  })
  return normalizeStatus(res)
}

const SUCCESS_STATUSES = new Set(['SESSION_SUCCEEDED', 'ONBOARDING_FINISHED'])
const FAILED_STATUSES = new Set(['SESSION_FAILED', 'ONBOARDING_FAILED', 'REJECTED'])

export function classifyOnboardingStatus(onboardingStatus) {
  if (!onboardingStatus) return 'pending'
  if (SUCCESS_STATUSES.has(onboardingStatus)) return 'success'
  if (FAILED_STATUSES.has(onboardingStatus)) return 'failed'
  return 'pending'
}

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
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
