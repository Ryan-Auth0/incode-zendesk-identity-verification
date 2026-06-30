import { useEffect, useRef } from 'react'
import { useClient } from '../hooks/useClient'
import { useTicketContext } from '../hooks/useTicketContext'
import { Spinner } from '@zendeskgarden/react-loaders'
import { Notification, Title } from '@zendeskgarden/react-notifications'
import { SM } from '@zendeskgarden/react-typography'
import { Tag } from '@zendeskgarden/react-tags'
import { MD } from '@zendeskgarden/react-typography'
import styled from 'styled-components'
import IdleState from '../components/IdleState'
import PendingState from '../components/PendingState'
import SuccessState from '../components/SuccessState'
import FailedState from '../components/FailedState'
import HistoryPanel from '../components/HistoryPanel'

const STATE_BY_STATUS = {
  incode_pending:       'pending',
  incode_success:       'success',
  incode_failed:        'failed',
  incode_manual_review: 'manual_review'
}

const TicketSideBar = () => {
  const client = useClient()
  const ticket = useTicketContext()
  const containerRef = useRef(null)

  useEffect(() => {
    if (!ticket.loaded || !containerRef.current) return
    const height = Math.max(containerRef.current.scrollHeight + 16, 120)
    client.invoke('resize', { width: '100%', height: `${height}px` })
  }, [client, ticket])

  if (!ticket.loaded) {
    return (
      <Wrapper ref={containerRef}>
        <Centered><Spinner size="32" aria-label="Loading" /></Centered>
      </Wrapper>
    )
  }

  if (ticket.error) {
    return (
      <Wrapper ref={containerRef}>
        <Notification type="error" role="alert">
          <Title>Setup required</Title>
          <SM>{ticket.error}</SM>
        </Notification>
      </Wrapper>
    )
  }

  const state = STATE_BY_STATUS[ticket.status] || 'idle'

  return (
    <Wrapper ref={containerRef}>
      {state === 'idle'          && <IdleState    client={client} ticket={ticket} />}
      {state === 'pending'       && <PendingState client={client} ticket={ticket} />}
      {state === 'success'       && <SuccessState client={client} ticket={ticket} />}
      {state === 'failed'        && <FailedState  client={client} ticket={ticket} />}
      {state === 'manual_review' && <ManualReviewState client={client} ticket={ticket} />}
    </Wrapper>
  )
}

function ManualReviewState({ client, ticket }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Tag hue="yellow"><span>Manual Review</span></Tag>
      <MD isBold>Review required</MD>
      <SM>
        Incode flagged this session for manual review. Do not proceed until the review
        is complete. Check the Incode dashboard for details.
      </SM>
      {ticket.interviewId && (
        <SM><strong>Session ID:</strong> {ticket.interviewId}</SM>
      )}
      <HistoryPanel client={client} ticket={ticket} />
    </div>
  )
}

const Wrapper = styled.div`
  padding: ${(p) => p.theme.space.sm};
  max-width: 320px;
`
const Centered = styled.div`
  display: flex;
  justify-content: center;
  padding: ${(p) => p.theme.space.md};
`

export default TicketSideBar
