import { useState } from 'react'
import { Button } from '@zendeskgarden/react-buttons'
import { MD, SM } from '@zendeskgarden/react-typography'
import { Notification, Title } from '@zendeskgarden/react-notifications'
import styled from 'styled-components'
import { startVerification } from '../lib/incode'

export default function IdleState({ client, ticket, onStarted }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const missingEmail = !ticket.requesterEmail

  const handleStart = async () => {
    setLoading(true)
    setError(null)
    try {
      const { interviewId } = await startVerification({
        client,
        settings: ticket.settings,
        ticketId: ticket.ticketId,
        email: ticket.requesterEmail,
        phone: ticket.requesterPhone
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
      <SM>
        Send the requester a secure link to verify their identity with Incode. They will
        receive an SMS and email with instructions.
      </SM>
      <Button
        isPrimary
        isStretched
        onClick={handleStart}
        disabled={loading || missingEmail}
        aria-describedby={missingEmail ? 'missing-email-help' : undefined}
      >
        {loading ? 'Starting…' : 'Start verification'}
      </Button>
      {missingEmail && (
        <SM id="missing-email-help">
          Requester has no email on file. Add one before starting verification.
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

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.sm};
`

function friendlyError(err) {
  if (!err) return 'Unknown error'
  if (err.status === 401 || err.status === 403) {
    return 'Authentication failed. Check the Incode API key in app settings.'
  }
  if (err.status === 429) {
    return 'Rate limit reached. Wait a moment and try again.'
  }
  if (err.responseJSON?.message) return err.responseJSON.message
  if (err.statusText) return err.statusText
  return err.message || String(err)
}
