import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@zendeskgarden/react-loaders'
import { Tag } from '@zendeskgarden/react-tags'
import { MD, SM } from '@zendeskgarden/react-typography'
import { Notification, Title } from '@zendeskgarden/react-notifications'
import styled from 'styled-components'
import { classifyOnboardingStatus, getStatus } from '../lib/incode'

// Fallback poll interval — only used if webhook hasn't fired after 15s
const FALLBACK_POLL_INTERVAL_MS = 15_000
const MAX_DURATION_MS = 30 * 60 * 1000

export default function PendingState({ client, ticket }) {
  const [pollError, setPollError]     = useState(null)
  const [timedOut, setTimedOut]       = useState(false)
  const [lastChecked, setLastChecked] = useState(null)
  const cancelledRef                  = useRef(false)
  const message = ticket.settings?.msg_pending || 'Verification in progress.'

  useEffect(() => {
    if (!ticket.interviewId) return

    cancelledRef.current = false
    const deadline = Date.now() + MAX_DURATION_MS
    let timer = null

    async function poll() {
      if (cancelledRef.current) return
      if (Date.now() > deadline) { setTimedOut(true); return }

      try {
        const { onboardingStatus, completedAt } = await getStatus({
          client,
          settings: ticket.settings,
          interviewId: ticket.interviewId
        })
        setLastChecked(new Date())
        setPollError(null)

        const classification = classifyOnboardingStatus(onboardingStatus)
        if (classification !== 'pending') {
          cancelledRef.current = true
          await applyTerminalStatus({ ticket, classification, completedAt })
          await ticket.reload()
          return
        }
      } catch (err) {
        setPollError(err.message || String(err))
      }

      timer = setTimeout(poll, FALLBACK_POLL_INTERVAL_MS)
    }

    // Give webhook 15 seconds to fire before starting fallback polling
    timer = setTimeout(poll, FALLBACK_POLL_INTERVAL_MS)

    return () => {
      cancelledRef.current = true
      if (timer) clearTimeout(timer)
    }
  }, [client, ticket, ticket.interviewId])

  return (
    <Wrapper role="status" aria-live="polite">
      <Header>
        <Tag hue="yellow"><span>Pending</span></Tag>
        <Spinner size="20" aria-label="Verification in progress" />
      </Header>

      <MD isBold>Awaiting customer action</MD>
      <SM>{message}</SM>

      <Steps>
        <StepRow active>
          <StepDot active />
          <SM>Verification link sent</SM>
        </StepRow>
        <StepRow>
          <StepDot />
          <SM>Biometric check via Incode</SM>
        </StepRow>
        <StepRow>
          <StepDot />
          <SM>Result synced to ticket</SM>
        </StepRow>
      </Steps>

      {lastChecked && (
        <SM style={{ color: '#68737d' }}>
          Last checked {lastChecked.toLocaleTimeString()}
        </SM>
      )}

      {pollError && (
        <Notification type="warning" role="alert">
          <Title>Status check failed</Title>
          {pollError} — retrying automatically.
        </Notification>
      )}

      {timedOut && (
        <Notification type="warning" role="alert">
          <Title>Stopped checking</Title>
          No update after 30 minutes. Reload the sidebar to resume.
        </Notification>
      )}
    </Wrapper>
  )
}

async function applyTerminalStatus({ ticket, classification, completedAt }) {
  const statusMap = {
    success:       'incode_success',
    failed:        'incode_failed',
    manual_review: 'incode_manual_review'
  }
  await ticket.setField('status', statusMap[classification] || 'incode_failed')

  if (classification === 'success') {
    await ticket.setField('verifiedAt', formatDateOnly(completedAt || new Date().toISOString()))
    await ticket.postInternalNote(ticket.settings?.msg_success || 'Identity verified.')
  } else if (classification === 'manual_review') {
    await ticket.postInternalNote('⚠️ Incode verification requires manual review for this requester.')
  } else {
    await ticket.postInternalNote(ticket.settings?.msg_failed || 'Verification failed.')
  }
}

function formatDateOnly(iso) {
  try { return new Date(iso).toISOString().slice(0, 10) } catch { return iso }
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
const Steps = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: ${(p) => p.theme.space.sm};
  background: ${(p) => p.theme.colors.background};
  border: 1px solid ${(p) => p.theme.colors.neutralHue};
  border-radius: ${(p) => p.theme.borderRadii.md};
`
const StepRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: ${(p) => (p.active ? 1 : 0.45)};
`
const StepDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => (p.active ? '#1f73b7' : '#c8c8c8')};
`
