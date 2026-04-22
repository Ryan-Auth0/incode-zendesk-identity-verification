import { useEffect, useRef, useState } from 'react'
import { Button } from '@zendeskgarden/react-buttons'
import { Spinner } from '@zendeskgarden/react-loaders'
import { Tag } from '@zendeskgarden/react-tags'
import { MD, SM } from '@zendeskgarden/react-typography'
import { Notification, Title } from '@zendeskgarden/react-notifications'
import styled from 'styled-components'
import { classifyOnboardingStatus, getStatus } from '../lib/incode'

const DEFAULT_INTERVAL_SECONDS = 7
const DEFAULT_MAX_DURATION_MINUTES = 30

export default function PendingState({ client, ticket }) {
  const [pollError, setPollError] = useState(null)
  const [timedOut, setTimedOut] = useState(false)
  const [lastChecked, setLastChecked] = useState(null)
  const cancelledRef = useRef(false)

  const intervalSeconds = parseInt(ticket.settings?.pollIntervalSeconds, 10) || DEFAULT_INTERVAL_SECONDS
  const maxDurationMinutes = parseInt(ticket.settings?.maxPollDurationMinutes, 10) || DEFAULT_MAX_DURATION_MINUTES
  const message = ticket.settings?.msg_pending || 'Verification in progress.'

  useEffect(() => {
    if (!ticket.interviewId) return

    cancelledRef.current = false
    const deadline = Date.now() + maxDurationMinutes * 60 * 1000
    let timer = null

    async function tick() {
      if (cancelledRef.current) return

      if (Date.now() > deadline) {
        setTimedOut(true)
        return
      }

      try {
        const { onboardingStatus, completedAt } = await getStatus({
          client,
          settings: ticket.settings,
          interviewId: ticket.interviewId
        })
        setLastChecked(new Date())
        setPollError(null)

        const classification = classifyOnboardingStatus(onboardingStatus)

        if (classification === 'success' || classification === 'failed') {
          cancelledRef.current = true
          await applyTerminalStatus({
            ticket,
            classification,
            completedAt: completedAt || new Date().toISOString()
          })
          await ticket.reload()
          return
        }
      } catch (err) {
        setPollError(err.message || String(err))
      }

      timer = setTimeout(tick, intervalSeconds * 1000)
    }

    tick()

    return () => {
      cancelledRef.current = true
      if (timer) clearTimeout(timer)
    }
  }, [client, ticket, ticket.interviewId, intervalSeconds, maxDurationMinutes])

  const handleCopy = async () => {
    const link = `Ticket #${ticket.ticketId} — verification in progress for ${ticket.requesterEmail || 'requester'}`
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // clipboard not available in iframe on some browsers; silently ignore
    }
  }

  return (
    <Wrapper role="status" aria-live="polite">
      <Header>
        <Tag hue="yellow"><span>Pending</span></Tag>
        <Spinner size="24" aria-label="Verification in progress" />
      </Header>
      <MD isBold>Awaiting customer action</MD>
      <SM>{message}</SM>
      {!ticket.interviewId && (
        <SM>No interview ID on ticket yet. Try Start verification again.</SM>
      )}
      {lastChecked && (
        <SM aria-live="polite">
          Last checked {lastChecked.toLocaleTimeString()} · checking every {intervalSeconds}s
        </SM>
      )}
      {pollError && (
        <Notification type="warning" role="alert">
          <Title>Status check failed</Title>
          {pollError} · Retrying in {intervalSeconds}s.
        </Notification>
      )}
      {timedOut && (
        <Notification type="warning" role="alert">
          <Title>Stopped checking</Title>
          No update after {maxDurationMinutes} minutes. Reload the sidebar to resume.
        </Notification>
      )}
      <Button isBasic onClick={handleCopy}>Copy status note</Button>
    </Wrapper>
  )
}

async function applyTerminalStatus({ ticket, classification, completedAt }) {
  if (classification === 'success') {
    await ticket.setField('status', 'incode_success')
    await ticket.setField('verifiedAt', formatDateOnly(completedAt))
    const msg = ticket.settings?.msg_success || 'Identity verified.'
    await ticket.postInternalNote(msg)
    return
  }
  if (classification === 'failed') {
    await ticket.setField('status', 'incode_failed')
    const msg = ticket.settings?.msg_failed || 'Verification failed.'
    await ticket.postInternalNote(msg)
  }
}

function formatDateOnly(iso) {
  try {
    const d = new Date(iso)
    return d.toISOString().slice(0, 10)
  } catch {
    return iso
  }
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
