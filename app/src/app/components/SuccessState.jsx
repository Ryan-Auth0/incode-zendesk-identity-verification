import { Tag } from '@zendeskgarden/react-tags'
import { MD, SM } from '@zendeskgarden/react-typography'
import { Button } from '@zendeskgarden/react-buttons'
import styled from 'styled-components'
import HistoryPanel from './HistoryPanel'

export default function SuccessState({ client, ticket }) {
  const message = ticket.settings?.msg_success ||
    'Identity verified. You can safely proceed with sensitive actions on this ticket.'

  return (
    <Wrapper role="status" aria-live="polite">
      <Tag hue="green"><span>Verified ✓</span></Tag>
      <MD isBold>Identity verified</MD>
      <SM>{message}</SM>

      <Steps>
        <StepRow done>
          <StepIcon>✓</StepIcon>
          <StepText>
            <strong>Identity confirmed on record</strong>
            <SM>Matched to IAM directory</SM>
          </StepText>
        </StepRow>
        <StepRow done>
          <StepIcon>✓</StepIcon>
          <StepText>
            <strong>Biometric check via Incode</strong>
            <SM>Liveness + face match against ID on file</SM>
          </StepText>
        </StepRow>
        <StepRow done>
          <StepIcon>✓</StepIcon>
          <StepText>
            <strong>Result synced to ticket</strong>
            <SM>Status, score and audit trail logged</SM>
          </StepText>
        </StepRow>
      </Steps>

      <Meta>
        {ticket.verifiedAt && (
          <SM><strong>Verified at:</strong> {formatDate(ticket.verifiedAt)}</SM>
        )}
        {ticket.interviewId && (
          <SM><strong>Session ID:</strong> {ticket.interviewId}</SM>
        )}
      </Meta>

      <HistoryPanel client={client} ticket={ticket} />
    </Wrapper>
  )
}

function formatDate(value) {
  try { return new Date(value).toLocaleString() } catch { return value }
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.sm};
`
const Steps = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: ${(p) => p.theme.space.sm};
  background: #f5fcf5;
  border: 1px solid #aecfae;
  border-radius: ${(p) => p.theme.borderRadii.md};
`
const StepRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
`
const StepIcon = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #228b22;
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
const Meta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${(p) => p.theme.space.xs} ${(p) => p.theme.space.sm};
  background: ${(p) => p.theme.colors.background};
  border: 1px solid ${(p) => p.theme.colors.neutralHue};
  border-radius: ${(p) => p.theme.borderRadii.md};
`
