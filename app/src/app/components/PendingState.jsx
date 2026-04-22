import { useState } from 'react'
import { Button } from '@zendeskgarden/react-buttons'
import { Spinner } from '@zendeskgarden/react-loaders'
import { Tag } from '@zendeskgarden/react-tags'
import { MD, SM } from '@zendeskgarden/react-typography'
import styled from 'styled-components'

export default function PendingState({ ticket }) {
  const [copied, setCopied] = useState(false)
  const message = ticket.settings?.msg_pending ||
    'Verification in progress. The customer has been sent a secure link.'

  const handleCopy = async () => {
    const link = `Ticket #${ticket.ticketId} — verification in progress for ${ticket.requesterEmail || 'requester'}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Wrapper role="status" aria-live="polite">
      <Header>
        <Tag hue="yellow">
          <span>Pending</span>
        </Tag>
        <Spinner size="24" aria-label="Verification in progress" />
      </Header>
      <MD isBold>Awaiting customer action</MD>
      <SM>{message}</SM>
      <Button isBasic onClick={handleCopy} aria-live="polite">
        {copied ? 'Copied' : 'Copy status note'}
      </Button>
    </Wrapper>
  )
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.sm};
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space.sm};
`
