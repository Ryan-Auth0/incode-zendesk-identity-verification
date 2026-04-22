import { useState } from 'react'
import { Button } from '@zendeskgarden/react-buttons'
import { Tag } from '@zendeskgarden/react-tags'
import { MD, SM } from '@zendeskgarden/react-typography'
import { Notification, Title } from '@zendeskgarden/react-notifications'
import styled from 'styled-components'
import { startVerification } from '../lib/incode'

export default function FailedState({ client, ticket, onRetried }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const message = ticket.settings?.msg_failed ||
    'Verification failed. Retry or escalate per your fraud process.'

  const handleRetry = async () => {
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
      <Button isDanger isStretched onClick={handleRetry} disabled={loading}>
        {loading ? 'Retrying…' : 'Retry verification'}
      </Button>
      {error && (
        <Notification type="error" role="alert">
          <Title>Retry failed</Title>
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
