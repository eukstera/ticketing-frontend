import { describe, expect, it } from 'vitest'
import { FILL_TICKET_FIELDS, mapCreateTicketErrors } from './createTicketErrors'

describe('mapCreateTicketErrors', () => {
  it('maps each key that has a control inline and focuses the first in form order', () => {
    const r = mapCreateTicketErrors({
      priority: ['The selected priority is inactive.'],
      assigned_user: ['The selected assignee is inactive.'],
      type_of_concern: ['The selected concern type is inactive.'],
    })
    expect(r.fieldErrors.priority).toEqual(['The selected priority is inactive.'])
    expect(r.fieldErrors.assigned_user).toEqual(['The selected assignee is inactive.'])
    expect(r.fieldErrors.type_of_concern).toEqual(['The selected concern type is inactive.'])
    expect(r.banner).toBe('')
    // type_of_concern comes first on the form, whatever order the API listed them in
    expect(r.firstElementId).toBe('f-type_of_concern')
  })

  it('sends keys without a control (service_department) to the banner', () => {
    const r = mapCreateTicketErrors({ service_department: ['The selected department is inactive.'] })
    expect(r.fieldErrors).toEqual({})
    expect(r.banner).toBe('The selected department is inactive.')
    expect(r.firstElementId).toBeNull()
  })

  it('keeps inline errors and still shows the banner for the unmapped ones', () => {
    const r = mapCreateTicketErrors({
      priority: ['Inactive priority.'],
      service_department: ['Inactive department.'],
    })
    expect(r.fieldErrors.priority).toEqual(['Inactive priority.'])
    expect(r.banner).toBe('Inactive department.')
    expect(r.firstElementId).toBe('f-priority')
  })

  it('accepts *_id spellings for the matching control', () => {
    const r = mapCreateTicketErrors({ priority_id: ['Inactive.'], assigned_user_id: ['Inactive.'] })
    expect(Object.keys(r.fieldErrors).sort()).toEqual(['assigned_user', 'priority'])
    expect(r.firstElementId).toBe('f-assigned_user')
  })

  it('focuses the failing device row and mirrors its message on the devices group', () => {
    const r = mapCreateTicketErrors({
      'devices.2.quantity': ['Must be at least 1.'],
      'devices.1.type': ['Required.'],
    })
    expect(r.fieldErrors['devices.1.type']).toEqual(['Required.'])
    expect(r.fieldErrors.devices?.[0]).toMatch(/^Device \d+: /)
    expect(r.firstElementId).toBe('f-devices.1.type')
  })

  it('focuses the first device input for a plain devices error', () => {
    const r = mapCreateTicketErrors({ devices: ['Add at least one device.'] })
    expect(r.firstElementId).toBe('f-devices.0.type')
  })

  it('uses the fallback message only when nothing else explains the failure', () => {
    expect(mapCreateTicketErrors({}, 'Failed to create ticket').banner).toBe('Failed to create ticket')
    expect(mapCreateTicketErrors(undefined, 'Failed to create ticket').banner).toBe('Failed to create ticket')
    expect(mapCreateTicketErrors({ remarks: ['Required.'] }, 'Failed').banner).toBe('')
  })

  it('ignores empty message lists', () => {
    const r = mapCreateTicketErrors({ remarks: [], priority: [''] }, 'Failed')
    expect(r.fieldErrors).toEqual({})
    expect(r.firstElementId).toBeNull()
    expect(r.banner).toBe('Failed')
  })
})

describe('mapCreateTicketErrors for the fill-in form', () => {
  it('maps requestor, requestor_email and requested_at, and focuses the first in form order', () => {
    const r = mapCreateTicketErrors(
      {
        remarks: ['Required.'],
        requested_at: ['Must be now or earlier.'],
        requestor_email: ['Invalid email.'],
        requestor: ['Too long.'],
      },
      '',
      FILL_TICKET_FIELDS
    )
    expect(Object.keys(r.fieldErrors).sort()).toEqual(['remarks', 'requested_at', 'requestor', 'requestor_email'])
    expect(r.banner).toBe('')
    expect(r.firstElementId).toBe('f-requestor')
  })

  it('focuses the date when it is the first failing control', () => {
    const r = mapCreateTicketErrors({ requested_at: ['Future.'], priority: ['Inactive.'] }, '', FILL_TICKET_FIELDS)
    expect(r.firstElementId).toBe('f-requested_at')
  })

  it('accepts the requester spelling', () => {
    const r = mapCreateTicketErrors({ requester: ['Required.'] }, '', FILL_TICKET_FIELDS)
    expect(r.fieldErrors.requestor).toEqual(['Required.'])
  })

  it('sends keys without a control to the banner', () => {
    const r = mapCreateTicketErrors({ service_department: ['Inactive.'] }, '', FILL_TICKET_FIELDS)
    expect(r.banner).toBe('Inactive.')
    expect(r.firstElementId).toBeNull()
  })

  it('on the create form, requestor has no control and goes to the banner', () => {
    const r = mapCreateTicketErrors({ requestor: ['Too long.'] })
    expect(r.fieldErrors).toEqual({})
    expect(r.banner).toBe('Too long.')
  })
})
