import { Tag } from '@zendeskgarden/react-tags'
import { MD, SM } from '@zendeskgarden/react-typography'
import styled from 'styled-components'

export default function SuccessState({ ticket }) {
  const message = ticket.settings?.msg_success ||
    'Identity verified. You can safely proceed with sensitive actions on this ticket.'

  return (
    <Wrapper role="status" aria-live="polite">
      <Tag hue="green">
        <span>Verified</span>
      </Tag>
      <MD isBold>Identity verified</MD>
      <SM>{message}</SM>
      {ticket.verifiedAt && (
        <SM>
          <strong>Verified at:</strong> {formatDate(ticket.verifiedAt)}
        </SM>
      )}
      {ticket.interviewId && (
        <SM>
          <strong>Interview ID:</strong> {ticket.interviewId}
        </SM>
      )}
    </Wrapper>
  )
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.sm};
`
