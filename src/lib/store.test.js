import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The store reads localStorage at module load, so each test re-imports it with
 * a fresh module registry rather than sharing one hydrated instance.
 */
async function freshStore(seedState) {
  localStorage.clear()
  if (seedState) localStorage.setItem('stonezen_crm_v1', JSON.stringify(seedState))
  vi.resetModules()
  return import('./store')
}

beforeEach(() => localStorage.clear())

/** A genuinely empty book, so numbering starts from zero rather than the sample data. */
const EMPTY = {
  settings: {}, counters: {},
  clients: [], projects: [], quotations: [], invoices: [],
  payments: [], expenses: [], activities: [],
}

/* ------------------------------------------------- financial year series */

describe('financial year', () => {
  it('runs April to March', async () => {
    const { financialYear } = await freshStore()
    expect(financialYear(new Date('2026-04-01'))).toBe('2026-27')
    expect(financialYear(new Date('2026-12-31'))).toBe('2026-27')
    expect(financialYear(new Date('2027-03-31'))).toBe('2026-27')
  })

  it('puts January back into the previous financial year', async () => {
    const { financialYear } = await freshStore()
    expect(financialYear(new Date('2027-01-15'))).toBe('2026-27')
  })

  it('rolls to a new series on 1 April', async () => {
    const { financialYear } = await freshStore()
    expect(financialYear(new Date('2027-04-01'))).toBe('2027-28')
  })
})

describe('document numbering', () => {
  it('issues a consecutive series inside one financial year', async () => {
    const { nextNumber, financialYear } = await freshStore(EMPTY)
    const fy = financialYear()
    expect(nextNumber('invoice')).toBe(`INV-${fy}-001`)
    expect(nextNumber('invoice')).toBe(`INV-${fy}-002`)
    expect(nextNumber('invoice')).toBe(`INV-${fy}-003`)
  })

  it('keeps a separate series per document type', async () => {
    const { nextNumber, financialYear } = await freshStore(EMPTY)
    const fy = financialYear()
    nextNumber('invoice')
    expect(nextNumber('quotation')).toBe(`QT-${fy}-001`)
  })

  it('never puts a slash in the number, which doubles as a route param', async () => {
    const { nextNumber } = await freshStore(EMPTY)
    expect(nextNumber('invoice')).not.toContain('/')
  })

  it('peeking does not consume the number', async () => {
    const { peekNumber, nextNumber } = await freshStore(EMPTY)
    const peeked = peekNumber('invoice')
    expect(peekNumber('invoice')).toBe(peeked)
    expect(nextNumber('invoice')).toBe(peeked)
  })

  it('two open drafts do not both keep the peeked number', async () => {
    // Both builders preview 001; only the one that saves first may keep it.
    const { peekNumber, nextNumber } = await freshStore(EMPTY)
    const draftA = peekNumber('invoice')
    const draftB = peekNumber('invoice')
    expect(draftA).toBe(draftB)
    expect(nextNumber('invoice')).toBe(draftA)
    expect(nextNumber('invoice')).not.toBe(draftB)
  })

  it('continues past a legacy counter rather than reissuing a used number', async () => {
    const { nextNumber, financialYear } = await freshStore({ ...EMPTY, counters: { invoice: 7 } })
    expect(nextNumber('invoice')).toBe(`INV-${financialYear()}-008`)
  })
})

/* -------------------------------------------------------- delete safety */

describe('client deletion', () => {
  const withClient = (extra = {}) => ({
    clients: [{ id: 'CL-1', name: 'Ramesh', status: 'Active' }],
    projects: [], quotations: [], invoices: [], payments: [], expenses: [], activities: [],
    ...extra,
  })

  it('deletes a client who carries no financial history', async () => {
    const { deleteClient, getState } = await freshStore(withClient())
    expect(deleteClient('CL-1').ok).toBe(true)
    expect(getState().clients).toHaveLength(0)
  })

  it('refuses to delete a client with recorded payments', async () => {
    const s = await freshStore(withClient({
      payments: [{ id: 'PAY-1', clientId: 'CL-1', amount: 5000 }],
    }))
    const res = s.deleteClient('CL-1')
    expect(res.ok).toBe(false)
    expect(res.archived).toBe(true)
    expect(s.getState().payments).toHaveLength(1)
  })

  it('never destroys received money', async () => {
    const s = await freshStore(withClient({
      payments: [{ id: 'PAY-1', clientId: 'CL-1', amount: 5000 }],
      invoices: [{ id: 'INV-1', clientId: 'CL-1', status: 'Sent' }],
    }))
    s.deleteClient('CL-1')
    expect(s.getState().payments[0].amount).toBe(5000)
    expect(s.getState().invoices).toHaveLength(1)
  })

  it('archives instead, keeping the client visible in the ledger', async () => {
    const s = await freshStore(withClient({
      payments: [{ id: 'PAY-1', clientId: 'CL-1', amount: 1 }],
    }))
    s.deleteClient('CL-1')
    expect(s.getState().clients[0].status).toBe('Archived')
  })

  it('reports why a client cannot be deleted', async () => {
    const s = await freshStore(withClient({
      payments: [{ id: 'PAY-1', clientId: 'CL-1', amount: 1 }],
      invoices: [{ id: 'INV-1', clientId: 'CL-1', status: 'Sent' }],
    }))
    expect(s.clientDeletionBlockers('CL-1')).toEqual(['1 recorded payment', '1 issued invoice'])
  })

  it('does not count an unissued draft invoice as a blocker', async () => {
    const s = await freshStore(withClient({
      invoices: [{ id: 'INV-1', clientId: 'CL-1', status: 'Draft' }],
    }))
    expect(s.clientDeletionBlockers('CL-1')).toEqual([])
  })

  it('unlinks rather than deletes the quotations of a deletable client', async () => {
    const s = await freshStore(withClient({
      quotations: [{ id: 'QT-1', clientId: 'CL-1' }],
    }))
    s.deleteClient('CL-1')
    expect(s.getState().quotations).toHaveLength(1)
    expect(s.getState().quotations[0].clientId).toBe('')
  })

  it('restores an archived client', async () => {
    const s = await freshStore(withClient({ payments: [{ id: 'P', clientId: 'CL-1', amount: 1 }] }))
    s.deleteClient('CL-1')
    s.restoreClient('CL-1')
    expect(s.getState().clients[0].status).toBe('Active')
  })
})

/* -------------------------------------------------------- write batching */

describe('write batching', () => {
  it('persists once per record created, not once per inner write', async () => {
    const s = await freshStore(EMPTY)
    const spy = vi.spyOn(localStorage, 'setItem')
    s.addClient({ name: 'Test' })
    // Number allocation, the record itself and the activity entry are one write.
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('still writes the allocated number and the record together', async () => {
    const s = await freshStore(EMPTY)
    const created = s.addClient({ name: 'Test' })
    const stored = JSON.parse(localStorage.getItem('stonezen_crm_v1'))
    expect(stored.clients[0].id).toBe(created.id)
    expect(stored.counters[`client:${s.financialYear()}`]).toBe(1)
  })
})

/* ------------------------------------------------------ cross-tab sync */

describe('cross-tab sync', () => {
  it('adopts a change written by another tab', async () => {
    const s = await freshStore()
    const remote = { ...s.getState(), clients: [{ id: 'CL-9', name: 'From other tab' }] }
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'stonezen_crm_v1', newValue: JSON.stringify(remote),
    }))
    expect(s.getState().clients[0].name).toBe('From other tab')
  })

  it('does not write back when adopting a remote change', async () => {
    const s = await freshStore()
    const remote = { ...s.getState(), clients: [{ id: 'CL-9', name: 'Remote' }] }
    const spy = vi.spyOn(localStorage, 'setItem')
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'stonezen_crm_v1', newValue: JSON.stringify(remote),
    }))
    // Echoing the write back is what makes two tabs ping-pong forever.
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('notifies subscribers so open screens repaint', async () => {
    const s = await freshStore()
    const listener = vi.fn()
    s.subscribe(listener)
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'stonezen_crm_v1', newValue: JSON.stringify(s.getState()),
    }))
    expect(listener).toHaveBeenCalled()
  })

  it('ignores unrelated keys', async () => {
    const s = await freshStore()
    const listener = vi.fn()
    s.subscribe(listener)
    window.dispatchEvent(new StorageEvent('storage', { key: 'something_else', newValue: '{}' }))
    expect(listener).not.toHaveBeenCalled()
  })
})
