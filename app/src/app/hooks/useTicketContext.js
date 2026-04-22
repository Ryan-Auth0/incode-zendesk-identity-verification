import { useCallback, useEffect, useState } from 'react'
import { useClient } from './useClient'

const FIELD_TITLES = {
  status: 'Incode Verification Status',
  interviewId: 'Incode Interview ID',
  verifiedAt: 'Incode Verified At'
}

export function useTicketContext() {
  const client = useClient()
  const [ctx, setCtx] = useState({
    loaded: false,
    ticketId: null,
    requesterEmail: null,
    requesterPhone: null,
    status: null,
    interviewId: null,
    verifiedAt: null,
    fieldIds: null,
    settings: null,
    error: null
  })

  const load = useCallback(async () => {
    try {
      const fieldIds = await resolveFieldIds(client)
      const metadata = await client.metadata()
      const keys = [
        'ticket.id',
        'ticket.requester.email',
        'ticket.requester.phone',
        `ticket.customField:custom_field_${fieldIds.status}`,
        `ticket.customField:custom_field_${fieldIds.interviewId}`,
        `ticket.customField:custom_field_${fieldIds.verifiedAt}`
      ]
      const data = await client.get(keys)

      setCtx({
        loaded: true,
        ticketId: data['ticket.id'],
        requesterEmail: data['ticket.requester.email'] || null,
        requesterPhone: data['ticket.requester.phone'] || null,
        status: data[`ticket.customField:custom_field_${fieldIds.status}`] || null,
        interviewId: data[`ticket.customField:custom_field_${fieldIds.interviewId}`] || null,
        verifiedAt: data[`ticket.customField:custom_field_${fieldIds.verifiedAt}`] || null,
        fieldIds,
        settings: metadata.settings || {},
        error: null
      })
    } catch (err) {
      setCtx((prev) => ({ ...prev, loaded: true, error: err.message || String(err) }))
    }
  }, [client])

  useEffect(() => {
    load()
  }, [load])

  const setField = useCallback(
    async (fieldKey, value) => {
      const fieldIds = ctx.fieldIds
      if (!fieldIds) return
      const id = fieldIds[fieldKey]
      if (!id) return
      await client.set(`ticket.customField:custom_field_${id}`, value)
    },
    [client, ctx.fieldIds]
  )

  const postInternalNote = useCallback(
    async (body) => {
      const { 'ticket.id': id } = await client.get('ticket.id')
      await client.request({
        url: `/api/v2/tickets/${id}.json`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({
          ticket: { comment: { body, public: false } }
        })
      })
    },
    [client]
  )

  const reload = useCallback(() => load(), [load])

  return { ...ctx, setField, postInternalNote, reload }
}

async function resolveFieldIds(client) {
  const cached = readCache()
  if (cached) return cached

  const res = await client.request({
    url: '/api/v2/ticket_fields.json',
    type: 'GET'
  })

  const byTitle = {}
  for (const field of res.ticket_fields || []) {
    byTitle[field.title] = field.id
  }

  const ids = {
    status: byTitle[FIELD_TITLES.status],
    interviewId: byTitle[FIELD_TITLES.interviewId],
    verifiedAt: byTitle[FIELD_TITLES.verifiedAt]
  }

  if (!ids.status || !ids.interviewId || !ids.verifiedAt) {
    throw new Error(
      'Incode custom fields not found. Reinstall the app to provision: ' +
      Object.values(FIELD_TITLES).join(', ')
    )
  }

  writeCache(ids)
  return ids
}

const CACHE_KEY = 'incode_field_ids_v1'

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(ids) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(ids))
  } catch {
    // sessionStorage may be unavailable in some sandbox configs — non-fatal
  }
}
