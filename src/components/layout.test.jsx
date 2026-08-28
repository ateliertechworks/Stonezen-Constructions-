import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

import Layout from './Layout'

/**
 * Structural checks for the redesigned chrome.
 *
 * These cannot judge whether it *looks* like the reference, but they do pin the
 * parts that silently break: the flattened navigation, the amber active pill,
 * the collapse toggle and the New menu.
 */

beforeEach(() => {
  localStorage.clear()
  window.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView ||= () => {}
  Element.prototype.hasPointerCapture ||= () => false
  Element.prototype.releasePointerCapture ||= () => {}
})

afterEach(cleanup)

const at = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<div>screen</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

/** The desktop rail, ignoring the duplicate mobile drawer copy. */
const desktopNav = () => screen.getAllByRole('navigation')[0]

describe('sidebar navigation', () => {
  it('shows the seven modules the product is organised around', () => {
    at()
    const nav = within(desktopNav())
    for (const label of ['Dashboard', 'Clients', 'Projects', 'Settings']) {
      expect(nav.getByRole('link', { name: new RegExp(`^${label}$`, 'i') })).toBeTruthy()
    }
    // Billing and Accounts are parents, not links.
    expect(nav.getByRole('button', { name: /^Billing$/i })).toBeTruthy()
    expect(nav.getByRole('button', { name: /^Accounts$/i })).toBeTruthy()
    // Follow-ups carries a pending count in its accessible name.
    expect(nav.getByRole('link', { name: /^Follow-ups/i })).toBeTruthy()
  })

  it('keeps Quotations and Invoices under Billing', async () => {
    const user = userEvent.setup()
    at()
    const nav = within(desktopNav())
    await user.click(nav.getByRole('button', { name: /^Billing$/i }))
    expect(nav.getByRole('link', { name: /^Quotations$/i })).toBeTruthy()
    expect(nav.getByRole('link', { name: /^Invoices$/i })).toBeTruthy()
  })

  it('keeps the money screens under Accounts', () => {
    at('/accounts/payments')
    const nav = within(desktopNav())
    expect(nav.getByRole('link', { name: /financial overview/i })).toBeTruthy()
    expect(nav.getByRole('link', { name: /^Payments$/i })).toBeTruthy()
    expect(nav.getByRole('link', { name: /^Expenses$/i })).toBeTruthy()
    expect(nav.getByRole('link', { name: /ledger/i })).toBeTruthy()
  })

  it('opens the group that owns the current route', () => {
    at('/invoices')
    expect(within(desktopNav()).getByRole('button', { name: /^Billing$/i, expanded: true })).toBeTruthy()
  })

  it('leaves an unrelated group closed', () => {
    at('/invoices')
    expect(within(desktopNav()).getByRole('button', { name: /^Accounts$/i, expanded: false })).toBeTruthy()
  })

  it('offers no link to a screen that does not exist', () => {
    at()
    const nav = within(desktopNav())
    for (const missing of ['Site Visits', 'Tasks', 'Team', 'Reports']) {
      expect(nav.queryByRole('link', { name: new RegExp(missing, 'i') })).toBeNull()
    }
  })

  it('marks the current screen with the amber pill', () => {
    at('/clients')
    const link = within(desktopNav()).getByRole('link', { name: /^clients$/i })
    expect(link.className).toContain('bg-amber-400')
  })

  it('marks the active child rather than the open parent', () => {
    at('/invoices')
    const nav = within(desktopNav())
    expect(nav.getByRole('link', { name: /^Invoices$/i }).className).toContain('bg-amber-400')
    expect(nav.getByRole('button', { name: /^Billing$/i }).className).not.toContain('bg-amber-400')
  })

  it('leaves other items unhighlighted', () => {
    at('/clients')
    const link = within(desktopNav()).getByRole('link', { name: /^projects$/i })
    expect(link.className).not.toContain('bg-amber-400')
  })

  it('shows the two-line Stonezen OS / Constructions wordmark', () => {
    at()
    expect(screen.getAllByText('Stonezen OS').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Constructions').length).toBeGreaterThan(0)
  })
})

describe('collapsing the sidebar', () => {
  it('collapses and expands from the chevron', async () => {
    const user = userEvent.setup()
    at()
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /expand sidebar/i }))
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeTruthy()
  })

  it('remembers the choice for next time', async () => {
    const user = userEvent.setup()
    at()
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))
    expect(localStorage.getItem('stonezen_sidebar_collapsed_v1')).toBe('1')
  })

  it('keeps the links reachable while collapsed', async () => {
    const user = userEvent.setup()
    at()
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))
    expect(within(desktopNav()).getByRole('link', { name: /clients/i })).toBeTruthy()
  })

  it('widens the rail when a group is clicked, since a submenu needs the room', async () => {
    const user = userEvent.setup()
    at()
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))
    await user.click(within(desktopNav()).getByRole('button', { name: /^Billing$/i }))
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeTruthy()
    expect(within(desktopNav()).getByRole('link', { name: /^Quotations$/i })).toBeTruthy()
  })
})

describe('topbar', () => {
  it('has a labelled search box', () => {
    at()
    expect(screen.getByLabelText(/search/i)).toBeTruthy()
  })

  it('opens the New menu with the real create flows', async () => {
    const user = userEvent.setup()
    at()
    await user.click(screen.getByRole('button', { name: /^new$/i }))
    expect(await screen.findByRole('menuitem', { name: /new quotation/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /new invoice/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /new client/i })).toBeTruthy()
  })

  it('names the notification bell for screen readers', () => {
    at()
    expect(screen.getByRole('button', { name: /follow-ups/i })).toBeTruthy()
  })
})
