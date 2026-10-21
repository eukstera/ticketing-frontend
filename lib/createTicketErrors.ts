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

type Known = (typeof CREATE_TICKET_FIELDS)[number]

// Keys the API may send under a different spelling than the form's field name.
const ALIASES: Record<string, Known> = {
  priority_id: 'priority',
  assigned_user_id: 'assigned_user',
  type_of_concern_id: 'type_of_concern',
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

export function mapCreateTicketErrors(
  errors: FieldErrors | undefined | null,
  fallbackMessage = ''
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

    const key = (CREATE_TICKET_FIELDS as readonly string[]).includes(rawKey) ? rawKey : ALIASES[rawKey]
    if (key) {
      fieldErrors[key] = messages.filter(m => !!m)
    } else if (!banner) {
      banner = message
    }
  }

  const firstKey = CREATE_TICKET_FIELDS.find(k => fieldErrors[k]?.length)
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
