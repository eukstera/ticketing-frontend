// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import JobOrderMenu from '@/components/department-tickets/JobOrderMenu'
import { getJobOrderFormat, setJobOrderFormat } from '@/lib/jobOrderFormat'

let container: HTMLDivElement
let root: Root | null = null
const onDownload = vi.fn()

function render(props: { busy?: boolean } = {}) {
  act(() => {
    root = createRoot(container)
    root.render(<JobOrderMenu ticketNumber="10-005-2026" busy={props.busy} onDownload={onDownload} />)
  })
}

const main = () => container.querySelector<HTMLButtonElement>('button[aria-label^="Download job order"]')!
const caret = () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!
const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
const items = (role: string) => Array.from(document.querySelectorAll<HTMLElement>(`[role="${role}"]`))
const byText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('[role^="menuitem"]')).find(el => el.textContent?.includes(text))!

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}
function key(el: Element, k: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  })
}

beforeEach(() => {
  localStorage.clear()
  setJobOrderFormat('xlsx')
  onDownload.mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  container.remove()
  document.body.innerHTML = ''
})

describe('JobOrderMenu split button', () => {
  it('renders a main button and a caret that is a closed menu button', () => {
    render()
    expect(main().textContent).toContain('Download JO')
    expect(main().getAttribute('aria-label')).toBe('Download job order 10-005-2026 as Excel')
    expect(caret().getAttribute('aria-haspopup')).toBe('menu')
    expect(caret().getAttribute('aria-expanded')).toBe('false')
    expect(caret().getAttribute('aria-label')).toBe('Job order format options 10-005-2026')
    expect(menu()).toBeNull()
  })

  it('stays on one line at the small size, like the other action buttons', () => {
    render()
    for (const b of [main(), caret()]) {
      expect(b.className).toContain('whitespace-nowrap')
      expect(b.className).toContain('!text-xs')
    }
  })

  it('downloads the preferred format right away: Excel by default, PDF once preferred', () => {
    render()
    click(main())
    expect(onDownload).toHaveBeenLastCalledWith('xlsx')

    act(() => setJobOrderFormat('pdf'))
    expect(main().getAttribute('aria-label')).toBe('Download job order 10-005-2026 as PDF')
    click(main())
    expect(onDownload).toHaveBeenLastCalledWith('pdf')
  })
})

describe('JobOrderMenu menu', () => {
  it('opens from the caret with both formats and the preference, and focuses the first item', () => {
    render()
    click(caret())

    expect(caret().getAttribute('aria-expanded')).toBe('true')
    expect(caret().getAttribute('aria-controls')).toBe(menu()?.id)
    expect(items('menuitem').map(el => el.textContent)).toEqual(['Download as Excel (.xlsx)', 'Download as PDF'])
    const radios = items('menuitemradio')
    expect(radios.map(el => [el.textContent, el.getAttribute('aria-checked')])).toEqual([
      ['Excel', 'true'],
      ['PDF', 'false'],
    ])
    expect(document.activeElement).toBe(items('menuitem')[0])
  })

  it('renders outside the table (portalled to the body), so a scrolling table cannot clip it', () => {
    render()
    click(caret())
    expect(container.contains(menu())).toBe(false)
    expect(menu()?.parentElement).toBe(document.body)
    expect(menu()?.style.position).toBe('fixed')
  })

  it('downloads the other format once without changing the preference, and returns focus', () => {
    render()
    click(caret())
    click(byText('Download as PDF'))

    expect(onDownload).toHaveBeenCalledWith('pdf')
    expect(getJobOrderFormat()).toBe('xlsx')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(caret())
  })

  it('changes the preferred format (kept for next time) and returns focus', () => {
    render()
    click(caret())
    click(items('menuitemradio').find(el => el.textContent === 'PDF')!)

    expect(getJobOrderFormat()).toBe('pdf')
    expect(localStorage.getItem('job-order-format')).toBe('pdf')
    expect(onDownload).not.toHaveBeenCalled()
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(caret())
    expect(main().getAttribute('aria-label')).toContain('as PDF')
  })

  it('closes on Escape and gives focus back to the caret', () => {
    render()
    click(caret())
    key(document.activeElement!, 'Escape')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(caret())
  })

  it('moves with the arrow keys, Home and End, wrapping around', () => {
    render()
    click(caret())
    const all = Array.from(document.querySelectorAll<HTMLElement>('[role^="menuitem"]'))
    expect(all).toHaveLength(4)

    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(all[1])
    key(document.activeElement!, 'End')
    expect(document.activeElement).toBe(all[3])
    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(all[0])
    key(document.activeElement!, 'ArrowUp')
    expect(document.activeElement).toBe(all[3])
    key(document.activeElement!, 'Home')
    expect(document.activeElement).toBe(all[0])
  })

  it('closes when the user clicks elsewhere', () => {
    render()
    click(caret())
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(menu()).toBeNull()
  })

  it('toggles from the caret', () => {
    render()
    click(caret())
    expect(menu()).not.toBeNull()
    click(caret())
    expect(menu()).toBeNull()
  })

  it('disables both segments while a download runs, and shows no menu', () => {
    render({ busy: true })
    expect(main().disabled).toBe(true)
    expect(caret().disabled).toBe(true)
    expect(main().textContent).toContain('Downloading…')
    click(main())
    click(caret())
    expect(onDownload).not.toHaveBeenCalled()
    expect(menu()).toBeNull()
  })
})
