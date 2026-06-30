import { useEffect, useState } from 'react'
import { SM } from '@zendeskgarden/react-typography'
import { Spinner } from '@zendeskgarden/react-loaders'
import { Tag } from '@zendeskgarden/react-tags'
import styled from 'styled-components'
import { getSessionHistory, classifyOnboardingStatus } from '../lib/incode'

export default function HistoryPanel({ client, ticket }) {
  const [sessions, setSessions] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [open, setOpen]         = useState(false)

  useEffect(() => {
    if (!open || !ticket.requesterEmail) return
    setLoading(true)
    getSessionHistory({
      client,
      settings: ticket.settings,
      email: ticket.requesterEmail
    })
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [open, client, ticket.requesterEmail, ticket.settings])

  const count = sessions?.length ?? 0

  return (
    <Wrapper>
      <ToggleRow onClick={() => setOpen((o) => !o)}>
        <SM isBold>History {count > 0 && `(${count})`}</SM>
        <Arrow>{open ? '▲' : '▼'}</Arrow>
      </ToggleRow>

      {open && (
        <HistoryList>
          {loading && (
            <Centered><Spinner size="20" aria-label="Loading history" /></Centered>
          )}
          {!loading && (!sessions || sessions.length === 0) && (
            <SM style={{ color: '#68737d', padding: '8px 0' }}>
              No previous sessions found for this requester.
            </SM>
          )}
          {!loading && sessions && sessions.map((session, i) => (
            <HistoryItem key={session.interviewId || session.sessionId || i}>
              <HistoryHeader>
                <StatusTag classification={classifyOnboardingStatus(session.onboardingStatus || session.status)} />
                <SM style={{ color: '#68737d' }}>
                  {session.createdAt || session.startedAt
                    ? formatDate(session.createdAt || session.startedAt)
                    : 'Unknown date'}
                </SM>
              </HistoryHeader>
              {(session.interviewId || session.sessionId) && (
                <SM style={{ color: '#68737d', fontSize: '11px' }}>
                  ID: {session.interviewId || session.sessionId}
                </SM>
              )}
            </HistoryItem>
          ))}
        </HistoryList>
      )}
    </Wrapper>
  )
}

function StatusTag({ classification }) {
  const hueMap = {
    success:       'green',
    failed:        'red',
    manual_review: 'yellow',
    pending:       'yellow'
  }
  const labelMap = {
    success:       'Verified',
    failed:        'Failed',
    manual_review: 'Review',
    pending:       'Pending'
  }
  return (
    <Tag hue={hueMap[classification] || 'grey'}>
      <span>{labelMap[classification] || classification}</span>
    </Tag>
  )
}

function formatDate(value) {
  try { return new Date(value).toLocaleString() } catch { return value }
}

const Wrapper = styled.div`
  border: 1px solid ${(p) => p.theme.colors.neutralHue};
  border-radius: ${(p) => p.theme.borderRadii.md};
  overflow: hidden;
`
const ToggleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${(p) => p.theme.space.xs} ${(p) => p.theme.space.sm};
  cursor: pointer;
  background: ${(p) => p.theme.colors.background};
  &:hover { background: #f3f4f6; }
`
const Arrow = styled.span`
  font-size: 10px;
  color: #68737d;
`
const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: #e9ebed;
  max-height: 240px;
  overflow-y: auto;
`
const HistoryItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: ${(p) => p.theme.space.xs} ${(p) => p.theme.space.sm};
  background: white;
`
const HistoryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space.xs};
`
const Centered = styled.div`
  display: flex;
  justify-content: center;
  padding: ${(p) => p.theme.space.sm};
`
