import { useState } from 'react'
import { Button } from '@zendeskgarden/react-buttons'
import { Field, Input, Label, Select } from '@zendeskgarden/react-forms'
import { Tag } from '@zendeskgarden/react-tags'
import { MD, SM } from '@zendeskgarden/react-typography'
import { Notification, Title } from '@zendeskgarden/react-notifications'
import styled from 'styled-components'
import { startVerification } from '../lib/incode'
import HistoryPanel from './HistoryPanel'

export default function FailedState({ client, ticket, onRetried }) {
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState(null)
  const [corporateEmail, setCorporateEmail] = useState(ticket.requesterEmail || '')
  const [deliveryEmail, setDeliveryEmail]   = useState(ticket.requesterEmail || '')
  const [phone, setPhone]                   = useState(ticket.requesterPhone || '')
  const [deliveryMethod, setDeliveryMethod] = useState('SMS')
  const [deliveryEmailTouched, setDeliveryEmailTouched] = useState(false)

  const message = ticket.settings?.msg_failed ||
    'Verification failed. Retry or escalate per your fraud process.'

  const handleCorporateEmailChange = (val) => {
    setCorporateEmail(val)
    if (!deliveryEmailTouched) setDeliveryEmail(val)
  }

  const needsEmail = deliveryMethod === 'EMAIL' || deliveryMethod === 'EMAIL_AND_SMS'
  const needsPhone = deliveryMethod === 'SMS'   || deliveryMethod === 'EMAIL_AND_SMS'
  const canSubmit  = corporateEmail.trim() &&
    (!needsEmail || deliveryEmail.trim()) &&
    (!needsPhone || phone.trim())

  const handleRetry = async () => {
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
      if (interviewId) await ticket.setField('interviewId', interviewId)
      await ticket.setField('status', 'incode_pending')
      await ticket.setField('verifiedAt', '')
      await ticket.reload()
      onRetried?.(interviewId)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Wrapper role="status" aria-live="polite">
      <Tag hue="red"><span>Failed</span></Tag>
      <MD isBold>Verification failed</MD>
      <SM>{message}</SM>

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

      <Button isDanger isStretched onClick={handleRetry} disabled={loading || !canSubmit}>
        {loading ? 'Sending…' : 'Retry verification'}
      </Button>

      {error && (
        <Notification type="error" role="alert">
          <Title>Retry failed</Title>
          {error}
        </Notification>
      )}

      <HistoryPanel client={client} ticket={ticket} />
    </Wrapper>
  )
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.sm};
`
