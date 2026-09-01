import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { invoiceTotals } from '../../lib/calc'
import userEvent from '@testing-library/user-event'


/**
 * Converting a quotation is the money path: whatever this produces is what the
 * client is billed. The store is re-imported per test so numbering starts clean.
 */

const QUOTATION = {
  id: 'QT-2026-27-001',
  quotationNumber: 'QT-2026-27-001',
  clientId: 'CL-2026-27-001',
  projectId: 'PRJ-2026-27-001',
  title: 'Granite flooring',
  date: '2026-08-14',
  siteAddress: '12 Anna Nagar, Coimbatore',
  gstEnabled: true, gst: 18, gstType: 'intra',
  discount: 0, additionalCharges: 0, autoRoundOff: true,
  status: 'Accepted',
  paymentSchedule: [{ milestone: 'On confirmation', amount: 40000, status: 'Pending' }],
  items: [
    { sno: 1, description: 'Polished granite', unit: 'Sqft', area: 100, rate: 150, amount: 15000 },
    { sno: 2, description: 'Skirting', unit: 'Rft', area: 40, rate: 200, amount: 8000 },
    { sno: 3, description: 'Cleaning', unit: 'Lsum', area: 1, rate: 2000, amount: 2000 },
  ],
}

const SEEDED = {
  settings: {}, counters: {},
  clients: [{ id: 'CL-2026-27-001', name: 'Ravi Kumar', company: 'Kumar Estates', address: '4/221 Trichy Road', city: 'Coimbatore', pincode: '641005' }],
  projects: [{ id: 'PRJ-2026-27-001', name: 'Kumar Residence', clientId: 'CL-2026-27-001', invoiceId: '' }],
  quotations: [QUOTATION],
  invoices: [], payments: [], expenses: [], activities: [],
}

/** Quotation lines in invoice shape, without depending on the module under test. */
const quotationItemsAsInvoiceItemsFor = (q) =>
  q.items.map((it, i) => ({ sno: i + 1, description: it.description, unit: it.unit, quantity: it.area, rate: it.rate, amount: it.amount }))

async function freshStore(seed = SEEDED) {
  localStorage.clear()
  localStorage.setItem('stonezen_crm_v1', JSON.stringify(seed))
  vi.resetModules()
  return import('../../lib/store')
}

/**
 * The dialog closes over the store module it was loaded with, so it has to be
 * imported *after* `vi.resetModules()` — a top-level import would leave the
 * component writing into one store instance while the test read another.
 */
async function freshDialog(seed = SEEDED) {
  const store = await freshStore(seed)
  const { default: ConvertToInvoiceDialog } = await import('./ConvertToInvoiceDialog')
  return { ...store, ConvertToInvoiceDialog }
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
  Element.prototype.scrollIntoView ||= () => {}
  Element.prototype.hasPointerCapture ||= () => false
  Element.prototype.releasePointerCapture ||= () => {}
})

afterEach(cleanup)

/* ------------------------------------------------------------ store side */

describe('createInvoiceFromQuotation', () => {
  it('re-keys area as quantity — an invoice bills quantity, not area', async () => {
    const { createInvoiceFromQuotation } = await freshStore()
    const inv = createInvoiceFromQuotation(QUOTATION)

    expect(inv.items).toHaveLength(3)
    expect(inv.items[0]).toMatchObject({ description: 'Polished granite', quantity: 100, rate: 150, amount: 15000 })
    // A leftover `area` key would be dead weight; a missing `quantity` would
    // silently zero every line on the invoice.
    expect(inv.items[0].quantity).toBe(100)
    expect(inv.items.every((it) => it.quantity !== undefined)).toBe(true)
  })

  it('carries the client, GST and site address across', async () => {
    const { createInvoiceFromQuotation } = await freshStore()
    const inv = createInvoiceFromQuotation(QUOTATION)

    expect(inv.clientId).toBe('CL-2026-27-001')
    expect(inv.quotationId).toBe('QT-2026-27-001')
    expect(inv.gstEnabled).toBe(true)
    expect(inv.gst).toBe(18)
    expect(inv.billingAddress).toBe('4/221 Trichy Road, Coimbatore, 641005')
    expect(inv.shippingAddress).toBe('12 Anna Nagar, Coimbatore')
  })

  it('renumbers items so a removed line leaves no gap', async () => {
    const { createInvoiceFromQuotation } = await freshStore()
    const inv = createInvoiceFromQuotation(QUOTATION, {
      items: [
        { description: 'Polished granite', unit: 'Sqft', quantity: 100, rate: 150, amount: 15000 },
        { description: 'Extra work agreed on site', unit: 'Nos', quantity: 2, rate: 5000, amount: 10000 },
      ],
    })
    expect(inv.items.map((it) => it.sno)).toEqual([1, 2])
  })

  it('accepts extra line items the quotation never had', async () => {
    const { createInvoiceFromQuotation, invoiceDraftFromQuotation } = await freshStore()
    const draft = invoiceDraftFromQuotation(QUOTATION)
    const inv = createInvoiceFromQuotation(QUOTATION, {
      items: [...draft.items, { description: 'Additional skirting', unit: 'Rft', quantity: 10, rate: 200, amount: 2000 }],
      dueDate: '2026-09-30',
    })

    expect(inv.items).toHaveLength(4)
    expect(inv.items[3].description).toBe('Additional skirting')
    expect(inv.dueDate).toBe('2026-09-30')
  })

  it('claims the project invoice slot when it is free', async () => {
    const { createInvoiceFromQuotation, getState } = await freshStore()
    const inv = createInvoiceFromQuotation(QUOTATION)
    expect(getState().projects[0].invoiceId).toBe(inv.id)
  })

  // Converting a second quotation used to overwrite the pointer. PaymentDialog
  // defaults to `project.invoiceId`, so the next payment recorded from the
  // project screen would have been booked against the wrong invoice.
  it('does not steal a project invoice slot that is already taken', async () => {
    const { createInvoiceFromQuotation, getState } = await freshStore({
      ...SEEDED,
      projects: [{ ...SEEDED.projects[0], invoiceId: 'INV-2026-27-009' }],
    })
    createInvoiceFromQuotation(QUOTATION)
    expect(getState().projects[0].invoiceId).toBe('INV-2026-27-009')
  })

  // The dialog previews a total and then writes one; they have to be the same
  // number. It used to compute the preview as if round-off were always on,
  // while the saved invoice inherited the quotation's setting.
  it('carries the quotation\'s round-off setting, not a default', async () => {
    const { createInvoiceFromQuotation } = await freshStore()
    const manual = { ...QUOTATION, autoRoundOff: false, roundOff: -0.4, gstEnabled: false, items: [
      { sno: 1, description: 'Odd amount', unit: 'Sqft', area: 1, rate: 47300.4, amount: 47300.4 },
    ] }
    const inv = createInvoiceFromQuotation(manual, { items: quotationItemsAsInvoiceItemsFor(manual) })
    expect(inv.autoRoundOff).toBe(false)
    expect(inv.roundOff).toBe(-0.4)
    expect(invoiceTotals(inv).grandTotal).toBe(47300)
  })

  it('does not invent a round-off when the quotation rounds automatically', async () => {
    const { createInvoiceFromQuotation } = await freshStore()
    const inv = createInvoiceFromQuotation({ ...QUOTATION, autoRoundOff: true, roundOff: -99 })
    expect(inv.autoRoundOff).toBe(true)
    expect(inv.roundOff).toBe(0)
  })

  it('records the conversion in the activity log', async () => {
    const { createInvoiceFromQuotation, getState } = await freshStore()
    const inv = createInvoiceFromQuotation(QUOTATION)
    const texts = getState().activities.map((a) => a.text)
    expect(texts.some((t) => t.includes(`Invoice ${inv.id} generated from quotation QT-2026-27-001`))).toBe(true)
  })
})

/* ------------------------------------------------------------ dialog side */

describe('ConvertToInvoiceDialog', () => {
  it('shows every quotation line and the total before anything is saved', async () => {
    const { getState, ConvertToInvoiceDialog } = await freshDialog()
    render(<ConvertToInvoiceDialog open quotation={QUOTATION} onOpenChange={() => {}} />)

    expect(await screen.findByText('Polished granite')).toBeTruthy()
    expect(screen.getByText('Skirting')).toBeTruthy()
    expect(screen.getByText('Cleaning')).toBeTruthy()
    expect(screen.getByText('From the quotation (3)')).toBeTruthy()
    // 25,000 + 18% GST = 29,500
    expect(screen.getByText('₹29,500')).toBeTruthy()
    // Nothing is written until Create is pressed.
    expect(getState().invoices).toHaveLength(0)
  })

  it('creates the invoice only when asked, and reports it back', async () => {
    const { getState, ConvertToInvoiceDialog } = await freshDialog()
    const onCreated = vi.fn()
    render(<ConvertToInvoiceDialog open quotation={QUOTATION} onOpenChange={() => {}} onCreated={onCreated} />)

    await userEvent.click(await screen.findByRole('button', { name: /create invoice/i }))

    await waitFor(() => expect(getState().invoices).toHaveLength(1))
    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(getState().invoices[0].items).toHaveLength(3)
  })

  it('drops a line the user removes, and can put it back', async () => {
    const { ConvertToInvoiceDialog } = await freshDialog()
    render(<ConvertToInvoiceDialog open quotation={QUOTATION} onOpenChange={() => {}} />)
    await screen.findByText('Polished granite')

    await userEvent.click(screen.getAllByRole('button', { name: 'Do not bill this line' })[0])
    expect(screen.getByText('From the quotation (2)')).toBeTruthy()
    expect(screen.queryByText('Polished granite')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /restore removed/i }))
    expect(screen.getByText('From the quotation (3)')).toBeTruthy()
  })

  it('adds an extra line and bills it alongside the carried ones', async () => {
    const { getState, ConvertToInvoiceDialog } = await freshDialog()
    render(<ConvertToInvoiceDialog open quotation={QUOTATION} onOpenChange={() => {}} />)
    await screen.findByText('Polished granite')

    await userEvent.click(screen.getByRole('button', { name: /add extra item/i }))
    await userEvent.type(screen.getByLabelText('Extra line 1 description'), 'Extra work agreed on site')

    const [qty, rate] = screen.getAllByRole('spinbutton').slice(0, 2)
    await userEvent.clear(qty)
    await userEvent.type(qty, '2')
    await userEvent.clear(rate)
    await userEvent.type(rate, '5000')

    await userEvent.click(screen.getByRole('button', { name: /create invoice/i }))

    await waitFor(() => expect(getState().invoices).toHaveLength(1))
    const items = getState().invoices[0].items
    expect(items).toHaveLength(4)
    expect(items[3]).toMatchObject({ sno: 4, description: 'Extra work agreed on site', quantity: 2, rate: 5000, amount: 10000 })
  })

  // Removing a carried row and adding an extra is the case where a stale sno
  // would leave the printed invoice numbered 1, 2, 4.
  it('renumbers after a removal plus an addition', async () => {
    const { getState, ConvertToInvoiceDialog } = await freshDialog()
    render(<ConvertToInvoiceDialog open quotation={QUOTATION} onOpenChange={() => {}} />)
    await screen.findByText('Polished granite')

    await userEvent.click(screen.getAllByRole('button', { name: 'Do not bill this line' })[1])
    await userEvent.click(screen.getByRole('button', { name: /add extra item/i }))
    await userEvent.type(screen.getByLabelText('Extra line 1 description'), 'Late addition')

    await userEvent.click(screen.getByRole('button', { name: /create invoice/i }))

    await waitFor(() => expect(getState().invoices).toHaveLength(1))
    expect(getState().invoices[0].items.map((it) => it.sno)).toEqual([1, 2, 3])
    expect(getState().invoices[0].items.map((it) => it.description))
      .toEqual(['Polished granite', 'Cleaning', 'Late addition'])
  })

  it('refuses to create an invoice with nothing on it', async () => {
    const { getState, ConvertToInvoiceDialog } = await freshDialog()
    render(<ConvertToInvoiceDialog open quotation={QUOTATION} onOpenChange={() => {}} />)
    await screen.findByText('Polished granite')

    // Re-queried each time: clicking one removes its row and detaches the rest.
    let remaining = screen.queryAllByRole('button', { name: 'Do not bill this line' })
    while (remaining.length) {
      await userEvent.click(remaining[0])
      remaining = screen.queryAllByRole('button', { name: 'Do not bill this line' })
    }
    expect(screen.getByText(/add at least one line/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /create invoice/i }).disabled).toBe(true)
    expect(getState().invoices).toHaveLength(0)
  })

  it('adds the milestone block to the layout when the schedule is carried across', async () => {
    const { getState, ConvertToInvoiceDialog } = await freshDialog()
    render(<ConvertToInvoiceDialog open quotation={QUOTATION} onOpenChange={() => {}} />)
    await screen.findByText('Polished granite')

    await userEvent.click(screen.getByRole('button', { name: /create invoice/i }))
    await waitFor(() => expect(getState().invoices).toHaveLength(1))

    const inv = getState().invoices[0]
    expect(inv.paymentSchedule).toHaveLength(1)
    // Without the block the milestones would be stored and never printed.
    expect(inv.blocks.some((b) => b.type === 'payment_schedule')).toBe(true)
  })
})
