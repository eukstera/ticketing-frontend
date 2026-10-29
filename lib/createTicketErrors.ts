import type { FieldErrors } from '@/lib/api'

// Maps a 422 `errors` object from POST /saveRequestTicketIT onto the create
// form: keys that have a control become inline field errors (and the first one
// in form order is focused); keys without a control (e.g. service_department,
// which is fixed to IT) fall back to the form banner.

/** Controls on the form, top to bottom. */
export const CREATE_TICKET_FIELDS = [
  'type_of_concern',
  'devices',
  'name_of_area',
  'area_supervisor',
  'remarks',
  'assigned_user',
  'priority',
] as const

/** Controls on the fill-in (blank job order) form, top to bottom. */
export const FILL_TICKET_FIELDS = [
  'requestor',
  'requestor_email',
  'requested_at',
  ...CREATE_TICKET_FIELDS,
] as const

type Known = (typeof FILL_TICKET_FIELDS)[number]

// Keys the API may send under a different spelling than the form's field name.
const ALIASES: Record<string, Known> = {
  priority_id: 'priority',
  assigned_user_id: 'assigned_user',
  type_of_concern_id: 'type_of_concern',
  requester: 'requestor',
  requester_email: 'requestor_email',
}

const DEVICE_ROW = /^devices\.(\d+)\.(type|quantity)$/

export interface MappedCreateTicketErrors {
  /** Errors for keys that have a control, keyed by the form's field names (device rows keep `devices.N.type|quantity`). */
  fieldErrors: FieldErrors
  /** Message for errors with no control; '' when every error maps to a field. */
  banner: string
  /** DOM id of the first invalid control in form order, or null when only the banner applies. */
  firstElementId: string | null
}

function first(messages: string[] | undefined): string | undefined {
  return messages?.find(m => !!m)
}

/**
 * `fields` lists the controls the form has, top to bottom (default: the create
 * form). Keys outside it go to the banner, so e.g. `requestor` is a banner
 * message on Create Ticket, which has no such control.
 */
export function mapCreateTicketErrors(
  errors: FieldErrors | undefined | null,
  fallbackMessage = '',
  fields: readonly string[] = CREATE_TICKET_FIELDS
): MappedCreateTicketErrors {
  const fieldErrors: FieldErrors = {}
  let banner = ''
  let firstDeviceRow: { index: number; part: string } | null = null

  for (const [rawKey, messages] of Object.entries(errors ?? {})) {
    const message = first(messages)
    if (!message) continue

    const rowMatch = DEVICE_ROW.exec(rawKey)
    if (rowMatch) {
      fieldErrors[rawKey] = [message]
      const row = { index: Number(rowMatch[1]), part: rowMatch[2] }
      if (!firstDeviceRow || row.index < firstDeviceRow.index) firstDeviceRow = row
      // The group error shown under the list, so the message is not lost.
      if (!fieldErrors.devices) fieldErrors.devices = [`Device ${row.index + 1}: ${message}`]
      continue
    }

    const aliased = ALIASES[rawKey]
    const key = fields.includes(rawKey) ? rawKey : aliased && fields.includes(aliased) ? aliased : undefined
    if (key) {
      fieldErrors[key] = messages.filter(m => !!m)
    } else if (!banner) {
      banner = message
    }
  }

  const firstKey = fields.find(k => fieldErrors[k]?.length)
  let firstElementId: string | null = null
  if (firstKey === 'devices') {
    const row = firstDeviceRow
    firstElementId = row ? `f-devices.${row.index}.${row.part}` : 'f-devices.0.type'
  } else if (firstKey) {
    firstElementId = `f-${firstKey}`
  }

  if (!firstElementId && !banner) banner = fallbackMessage
  return { fieldErrors, banner, firstElementId }
}
