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

  return client.request({
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
}

export async function setStatus({ client, fieldIds, status }) {
  await client.set(`ticket.customField:custom_field_${fieldIds.status}`, status)
}
