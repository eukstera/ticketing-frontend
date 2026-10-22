// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveBlob } from '@/lib/download'

const createObjectURL = vi.fn(() => 'blob:fake-url')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  Object.assign(window.URL, { createObjectURL, revokeObjectURL })
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('saveBlob', () => {
  it('clicks a temporary link carrying the filename, then cleans up', () => {
    const clicks: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this)
    })

    expect(saveBlob(new Blob(['docx']), 'JO 10-003-26.docx')).toBe(true)

    expect(clicks).toHaveLength(1)
    expect(clicks[0].download).toBe('JO 10-003-26.docx')
    expect(clicks[0].href).toBe('blob:fake-url')
    expect(document.querySelector('a')).toBeNull() // link removed again
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })

  it('returns false instead of throwing when the browser refuses, and still frees the URL', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(saveBlob(new Blob(['docx']), 'x.docx')).toBe(false)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })

  it('returns false when no object URL can be made', () => {
    createObjectURL.mockImplementationOnce(() => {
      throw new Error('no blob urls')
    })
    expect(saveBlob(new Blob(['docx']), 'x.docx')).toBe(false)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })
})
