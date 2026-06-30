import { useState } from 'react'
import { Button } from '@zendeskgarden/react-buttons'
import { Field, Input, Label, Select } from '@zendeskgarden/react-forms'
import { MD, SM } from '@zendeskgarden/react-typography'
import { Notification, Title } from '@zendeskgarden/react-notifications'
import styled from 'styled-components'
import { startVerification } from '../lib/incode'

export default function IdleState({ client, ticket, onStarted }) {
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState(null)
  const [corporateEmail, setCorporateEmail] = useState(ticket.requesterEmail || '')
  const [deliveryEmail, setDeliveryEmail]   = useState(ticket.requesterEmail || '')
  const [phone, setPhone]                   = useState(ticket.requesterPhone || '')
  const [deliveryMethod, setDeliveryMethod] = useState('SMS')

  // When corporate email changes and delivery email hasn't been manually edited,
  // keep them in sync
  const [deliveryEmailTouched, setDeliveryEmailTouched] = useState(false)
  const handleCorporateEmailChange = (val) => {
    setCorporateEmail(val)
    if (!deliveryEmailTouched) setDeliveryEmail(val)
  }

  const needsEmail = deliveryMethod === 'EMAIL' || deliveryMethod === 'EMAIL_AND_SMS'
  const needsPhone = deliveryMethod === 'SMS'   || deliveryMethod === 'EMAIL_AND_SMS'
  const canSubmit  = corporateEmail.trim() &&
    (!needsEmail || deliveryEmail.trim()) &&
    (!needsPhone || phone.trim())

  const handleStart = async () => {
    setLoading(true)
    setError(null)
    try {
      const { interviewId } = await startVerification({
        client,
        settings:       ticket.settings,
        ticketId:       ticket.ticketId,
        email:          corporateEmail.trim(),
        deliveryEmail:  needsEmail ? deliveryEmail.trim() : undefined,
        phone:          needsPhone ? (phone.trim() || null) : null,
        deliveryMethod
      })

      if (interviewId) {
        await ticket.setField('interviewId', interviewId)
      }
      await ticket.setField('status', 'incode_pending')
      await ticket.reload()
      onStarted?.(interviewId)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Wrapper>
      <MD isBold>Identity verification</MD>
      <SM>Send the requester a secure link to verify their identity with Incode.</SM>

      <Field>
        <Label>Corporate email (used for identity matching)</Label>
        <Input
          type="email"
          value={corporateEmail}
          onChange={(e) => handleCorporateEmailChange(e.target.value)}
          placeholder="employee@company.com"
        />
      </Field>

      <Field>
        <Label>Delivery method</Label>
        <Select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)}>
          <option value="SMS">SMS</option>
          <option value="EMAIL">Email</option>
          <option value="EMAIL_AND_SMS">SMS &amp; Email</option>
        </Select>
      </Field>

      {needsPhone && (
        <Field>
          <Label>Mobile phone number</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
          />
        </Field>
      )}

      {needsEmail && (
        <Field>
          <Label>Delivery email</Label>
          <Input
            type="email"
            value={deliveryEmail}
            onChange={(e) => { setDeliveryEmail(e.target.value); setDeliveryEmailTouched(true) }}
            placeholder="employee@company.com"
          />
          {deliveryEmail !== corporateEmail && (
            <SM style={{ color: '#68737d', marginTop: 2 }}>
              Link will be sent to this address, not the corporate email.
            </SM>
          )}
        </Field>
      )}

      <VerificationSteps />

      <Button
        isPrimary
        isStretched
        onClick={handleStart}
        disabled={loading || !canSubmit}
      >
        {loading ? 'Sending…' : 'Send verification link'}
      </Button>

      {!canSubmit && !loading && (
        <SM style={{ color: '#d93f4c' }}>
          {!corporateEmail.trim()
            ? 'Corporate email is required for identity matching.'
            : needsPhone && !phone.trim()
            ? 'Phone number is required for SMS delivery.'
            : 'Delivery email is required for email delivery.'}
        </SM>
      )}

      {error && (
        <Notification type="error" role="alert">
          <Title>Could not start verification</Title>
          {error}
        </Notification>
      )}
    </Wrapper>
  )
}

function VerificationSteps() {
  return (
    <StepsWrapper>
      <SM isBold style={{ marginBottom: 4 }}>Verification steps</SM>
      {STEPS.map((step, i) => (
        <Step key={i}>
          <StepNumber>{i + 1}</StepNumber>
          <StepText>
            <strong>{step.title}</strong>
            <SM>{step.description}</SM>
          </StepText>
        </Step>
      ))}
    </StepsWrapper>
  )
}

const STEPS = [
  { title: 'Identity confirmed on record',  description: 'Matched to IAM directory' },
  { title: 'Biometric check via Incode',    description: 'Liveness + face match against ID on file' },
  { title: 'Result synced to ticket',       description: 'Status, score and audit trail logged' }
]

function friendlyError(err) {
  if (!err) return 'Unknown error'
  if (err.status === 401 || err.status === 403)
    return 'Authentication failed. Check the Incode credentials in app settings.'
  if (err.status === 429)
    return 'Rate limit reached. Wait a moment and try again.'
  if (err.responseJSON?.message) return err.responseJSON.message
  if (err.statusText) return err.statusText
  return err.message || String(err)
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.sm};
`

const StepsWrapper = styled.div`
  background: ${(p) => p.theme.colors.background};
  border: 1px solid ${(p) => p.theme.colors.neutralHue};
  border-radius: ${(p) => p.theme.borderRadii.md};
  padding: ${(p) => p.theme.space.sm};
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.xs};
`

const Step = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${(p) => p.theme.space.xs};
`

const StepNumber = styled.div`
  min-width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #1f73b7;
  color: white;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
`

const StepText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`
