import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Deleting a client detaches their projects and documents rather than deleting
 * them, which leaves records pointing at a client that no longer exists. Every
 * list page looks the client up by id, so each one has to survive the lookup
 * coming back empty — asserting the stored `clientId` is `''` proves nothing
 * about whether the screen still renders.
 */

const seed = {
  settings: {}, counters: {},
  clients: [{ id: 'CL-1', name: 'Ramesh', company: 'Ramesh Builders', status: 'Active' }],
  projects: [{ id: 'PRJ-1', clientId: 'CL-1', name: 'Site A', status: 'In Progress', value: 100000 }],
  quotations: [{ id: 'QT-1', clientId: 'CL-1', status: 'Draft', title: 'Quote A', items: [] }],
  invoices: [{ id: 'INV-1', clientId: 'CL-1', status: 'Draft', items: [] }],
  payments: [], expenses: [], activities: [],
}

async function storeWith(state) {
  localStorage.clear()
  localStorage.setItem('stonezen_crm_v1', JSON.stringify(state))
  const { vi } = await import('vitest')
  vi.resetModules()
  return import('../lib/store')
}

beforeEach(() => {
  localStorage.clear()
  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false, addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })
  }
  window.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} }
})

afterEach(cleanup)

const show = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('list pages survive a detached client', () => {
  it('renders Projects without the deleted client', async () => {
    const store = await storeWith(seed)
    store.deleteClient('CL-1')
    const Projects = (await import('./Projects')).default

    show(<Projects />)
    expect(screen.getByText('Site A')).toBeTruthy()
    expect(screen.queryByText('Ramesh Builders')).toBeNull()
  })

  it('renders Quotations without the deleted client', async () => {
    const store = await storeWith(seed)
    store.deleteClient('CL-1')
    const Quotations = (await import('./Quotations')).default

    show(<Quotations />)
    expect(screen.getAllByText(/QT-1/).length).toBeGreaterThan(0)
  })

  it('renders Invoices without the deleted client', async () => {
    const store = await storeWith(seed)
    store.deleteClient('CL-1')
    const Invoices = (await import('./Invoices')).default

    show(<Invoices />)
    expect(screen.getAllByText(/INV-1/).length).toBeGreaterThan(0)
  })

  it('keeps the records themselves rather than deleting them', async () => {
    const store = await storeWith(seed)
    store.deleteClient('CL-1')
    const db = store.getState()
    expect(db.projects).toHaveLength(1)
    expect(db.quotations).toHaveLength(1)
    expect(db.invoices).toHaveLength(1)
    expect(db.clients).toHaveLength(0)
  })
})
