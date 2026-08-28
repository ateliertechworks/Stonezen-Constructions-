import { describe, it, expect } from 'vitest'
import {
  lineAmount, itemsSubtotal, quotationTotals, invoiceTotals,
  invoicePaid, invoiceBalance, invoiceDisplayStatus, isLiveInvoice,
  projectSummary, clientTotals, ledgerForClient, followups,
  dashboardAggregates, accountsSummary,
} from './calc'
import { todayISO, addDaysISO } from './format'

/**
 * These pin the money math down before anything else in the codebase moves.
 * Every figure the business quotes, bills and reports flows through calc.js,
 * so a change here that nobody notices is a change on a client's invoice.
 */

const db = (over = {}) => ({
  clients: [], projects: [], quotations: [], invoices: [],
  payments: [], expenses: [], activities: [], ...over,
})

const inv = (over = {}) => ({
  id: 'INV-001', clientId: 'C1', projectId: 'P1', status: 'Sent',
  date: '2026-01-10', dueDate: '2026-02-10',
  gstEnabled: false, gst: 18, gstType: 'intra',
  discount: 0, additionalCharges: 0, autoRoundOff: true,
  items: [{ sno: 1, description: 'Work', unit: 'Sqft', quantity: 100, rate: 50, amount: 5000 }],
  ...over,
})

/* ------------------------------------------------------------ line totals */

describe('line amounts', () => {
  it('multiplies quantity by rate and rounds to paise', () => {
    expect(lineAmount({ area: 10, rate: 33.333 })).toBe(333.33)
  })

  it('reads the quantity from the key the document type uses', () => {
    expect(lineAmount({ quantity: 4, rate: 25 }, 'quantity')).toBe(100)
  })

  it('treats blank and missing values as zero rather than NaN', () => {
    expect(lineAmount({ area: '', rate: 50 })).toBe(0)
    expect(lineAmount({})).toBe(0)
  })

  it('prefers a stored amount over recomputing it', () => {
    // A user who overrides a line total must not have it silently recalculated.
    expect(itemsSubtotal([{ area: 10, rate: 10, amount: 250 }])).toBe(250)
  })

  it('falls back to computing when amount is blank', () => {
    expect(itemsSubtotal([{ area: 10, rate: 10, amount: '' }])).toBe(100)
  })
})

/* ----------------------------------------------------------- doc totals */

describe('document totals', () => {
  it('runs subtotal -> discount -> GST -> charges -> round-off in order', () => {
    const t = invoiceTotals(inv({
      items: [{ quantity: 1, rate: 10000, amount: 10000 }],
      discount: 10, gstEnabled: true, gst: 18, additionalCharges: 500,
    }))
    expect(t.subtotal).toBe(10000)
    expect(t.discountAmount).toBe(1000)
    expect(t.taxableAmount).toBe(9000)
    expect(t.gstAmount).toBe(1620)
    expect(t.grandTotal).toBe(11120)
  })

  it('splits GST into equal CGST and SGST within a state', () => {
    const t = invoiceTotals(inv({ gstEnabled: true, gst: 18, gstType: 'intra' }))
    expect(t.cgst).toBe(450)
    expect(t.sgst).toBe(450)
    expect(t.igst).toBe(0)
    expect(t.cgst + t.sgst).toBe(t.gstAmount)
  })

  it('applies the whole GST as IGST across states', () => {
    const t = invoiceTotals(inv({ gstEnabled: true, gst: 18, gstType: 'inter' }))
    expect(t.igst).toBe(900)
    expect(t.cgst).toBe(0)
    expect(t.sgst).toBe(0)
  })

  it('charges no tax when GST is switched off, whatever the rate says', () => {
    const t = invoiceTotals(inv({ gstEnabled: false, gst: 18 }))
    expect(t.gstAmount).toBe(0)
    expect(t.grandTotal).toBe(5000)
  })

  it('rounds the grand total to the nearest rupee when auto round-off is on', () => {
    const t = invoiceTotals(inv({
      items: [{ quantity: 1, rate: 1000.4, amount: 1000.4 }], autoRoundOff: true,
    }))
    expect(t.grandTotal).toBe(1000)
    expect(t.roundOff).toBe(-0.4)
  })

  it('honours a manual round-off when auto is off', () => {
    const t = invoiceTotals(inv({
      items: [{ quantity: 1, rate: 1000.4, amount: 1000.4 }],
      autoRoundOff: false, roundOff: 5,
    }))
    expect(t.grandTotal).toBe(1005.4)
  })

  it('reads quotation quantities from area and invoice quantities from quantity', () => {
    const shared = { gstEnabled: false, discount: 0, additionalCharges: 0 }
    expect(quotationTotals({ ...shared, items: [{ area: 2, rate: 100 }] }).subtotal).toBe(200)
    expect(invoiceTotals({ ...shared, items: [{ quantity: 2, rate: 100 }] }).subtotal).toBe(200)
  })

  it('survives an empty or absent document', () => {
    expect(quotationTotals(null).grandTotal).toBe(0)
    expect(invoiceTotals(undefined).grandTotal).toBe(0)
  })
})

/* -------------------------------------------------------------- invoices */

describe('invoice payment tracking', () => {
  const paid = (amount) => ({ id: 'PAY-1', invoiceId: 'INV-001', clientId: 'C1', amount })

  it('sums only the payments booked against that invoice', () => {
    const d = db({ payments: [paid(2000), { ...paid(500), invoiceId: 'INV-002' }] })
    expect(invoicePaid(d, inv())).toBe(2000)
  })

  it('reports the outstanding balance', () => {
    expect(invoiceBalance(db({ payments: [paid(2000)] }), inv())).toBe(3000)
  })

  it('reads as Paid once the balance is within rounding tolerance', () => {
    const d = db({ payments: [paid(4999.6)] })
    expect(invoiceDisplayStatus(d, inv())).toBe('Paid')
  })

  it('reads as Partially Paid when some money has arrived and it is not yet due', () => {
    const d = db({ payments: [paid(2000)] })
    expect(invoiceDisplayStatus(d, inv({ dueDate: addDaysISO(todayISO(), 30) }))).toBe('Partially Paid')
  })

  it('reads as Overdue past the due date', () => {
    expect(invoiceDisplayStatus(db(), inv({ dueDate: '2020-01-01' }))).toBe('Overdue')
  })

  it('stops reading as a draft once money has actually come in', () => {
    const d = db({ payments: [paid(1000)] })
    const notYetDue = inv({ status: 'Draft', dueDate: addDaysISO(todayISO(), 30) })
    expect(invoiceDisplayStatus(d, notYetDue)).toBe('Partially Paid')
  })

  it('keeps an untouched draft a draft', () => {
    expect(invoiceDisplayStatus(db(), inv({ status: 'Draft' }))).toBe('Draft')
  })

  it('never overrides a cancelled invoice', () => {
    const d = db({ payments: [paid(5000)] })
    expect(invoiceDisplayStatus(d, inv({ status: 'Cancelled' }))).toBe('Cancelled')
  })

  it('counts an issued invoice towards receivables but not a bare draft', () => {
    expect(isLiveInvoice(db(), inv({ status: 'Sent' }))).toBe(true)
    expect(isLiveInvoice(db(), inv({ status: 'Draft' }))).toBe(false)
    expect(isLiveInvoice(db(), inv({ status: 'Cancelled' }))).toBe(false)
  })

  it('counts a draft that has been paid against', () => {
    const d = db({ payments: [paid(100)] })
    expect(isLiveInvoice(d, inv({ status: 'Draft' }))).toBe(true)
  })
})

/* -------------------------------------------------------------- projects */

describe('project summary', () => {
  const d = db({
    payments: [{ projectId: 'P1', amount: 60000 }, { projectId: 'P2', amount: 999 }],
    expenses: [{ projectId: 'P1', amount: 25000 }],
    invoices: [inv({ items: [{ quantity: 1, rate: 80000, amount: 80000 }] })],
  })
  const s = projectSummary(d, { id: 'P1', value: 100000 })

  it('counts only the money attached to that project', () => {
    expect(s.revenue).toBe(60000)
    expect(s.expenses).toBe(25000)
    expect(s.profit).toBe(35000)
  })

  it('computes margin against collections', () => {
    expect(s.margin).toBeCloseTo(58.33, 2)
  })

  it('reports outstanding as invoiced less collected, never negative', () => {
    expect(s.outstanding).toBe(20000)
    const over = projectSummary(db({ payments: [{ projectId: 'P1', amount: 999999 }] }), { id: 'P1', value: 1 })
    expect(over.outstanding).toBe(0)
  })

  it('caps completion at 100 percent and avoids dividing by zero', () => {
    expect(projectSummary(d, { id: 'P1', value: 1000 }).completion).toBe(100)
    expect(projectSummary(d, { id: 'P1', value: 0 }).completion).toBe(0)
  })

  it('excludes cancelled invoices from the invoiced figure', () => {
    const withCancelled = db({ invoices: [inv({ status: 'Cancelled' })] })
    expect(projectSummary(withCancelled, { id: 'P1', value: 0 }).invoiced).toBe(0)
  })
})

/* --------------------------------------------------------------- clients */

describe('client totals and ledger', () => {
  const client = { id: 'C1', name: 'Ramesh' }
  const d = db({
    clients: [client],
    projects: [{ id: 'P1', clientId: 'C1', status: 'In Progress', value: 100000 }],
    quotations: [
      { id: 'QT-1', clientId: 'C1', status: 'Accepted', items: [{ area: 1, rate: 50000, amount: 50000 }] },
      { id: 'QT-2', clientId: 'C1', status: 'Sent', items: [{ area: 1, rate: 20000, amount: 20000 }] },
    ],
    invoices: [inv({ id: 'INV-001', date: '2026-01-10' })],
    payments: [{ id: 'PAY-1', clientId: 'C1', invoiceId: 'INV-001', date: '2026-01-20', amount: 2000 }],
    expenses: [{ projectId: 'P1', amount: 1000 }],
  })

  it('separates accepted quotation value from total quoted', () => {
    const t = clientTotals(d, client)
    expect(t.totalQuotationValue).toBe(70000)
    expect(t.acceptedValue).toBe(50000)
  })

  it('reports outstanding as invoiced less paid', () => {
    expect(clientTotals(d, client).outstanding).toBe(3000)
  })

  it('counts projects, quotations and payments', () => {
    const c = clientTotals(d, client).counts
    expect(c).toMatchObject({ quotations: 2, accepted: 1, invoices: 1, payments: 1, projects: 1, activeProjects: 1 })
  })

  it('builds a chronological ledger with a running balance', () => {
    const rows = ledgerForClient(d, client)
    expect(rows.map((r) => r.type)).toEqual(['Invoice', 'Payment'])
    expect(rows[0].debit).toBe(5000)
    expect(rows[0].balance).toBe(5000)
    expect(rows[1].credit).toBe(2000)
    expect(rows[1].balance).toBe(3000)
  })

  it('places an invoice before a payment booked the same day', () => {
    const sameDay = db({
      invoices: [inv({ date: '2026-03-01' })],
      payments: [{ id: 'PAY-9', clientId: 'C1', date: '2026-03-01', amount: 100 }],
    })
    expect(ledgerForClient(sameDay, client).map((r) => r.type)).toEqual(['Invoice', 'Payment'])
  })
})

/* ------------------------------------------------------------- followups */

describe('followups', () => {
  const base = {
    id: 'QT-1', clientId: 'C1', status: 'Sent', date: '2026-01-01',
    items: [{ area: 1, rate: 1000, amount: 1000 }],
  }

  it('lists sent quotations only', () => {
    const d = db({ quotations: [base, { ...base, id: 'QT-2', status: 'Accepted' }] })
    expect(followups(d).map((f) => f.quotation.id)).toEqual(['QT-1'])
  })

  it('drops a quotation whose project is already underway', () => {
    const d = db({
      quotations: [{ ...base, projectId: 'P1' }],
      projects: [{ id: 'P1', status: 'In Progress' }],
    })
    expect(followups(d)).toHaveLength(0)
  })

  it('marks an expired quotation as high urgency', () => {
    const d = db({ quotations: [{ ...base, date: todayISO(), validUntil: '2020-01-01' }] })
    expect(followups(d)[0].urgency).toBe('high')
    expect(followups(d)[0].expired).toBe(true)
  })

  it('escalates urgency with silence', () => {
    const at = (days) => db({ quotations: [{ ...base, date: addDaysISO(todayISO(), -days) }] })
    expect(followups(at(2))[0].urgency).toBe('low')
    expect(followups(at(9))[0].urgency).toBe('medium')
    expect(followups(at(20))[0].urgency).toBe('high')
  })

  it('measures silence from the last contact rather than the quotation date', () => {
    const d = db({ quotations: [{ ...base, date: addDaysISO(todayISO(), -30), lastContact: todayISO() }] })
    expect(followups(d)[0].daysSinceContact).toBe(0)
  })
})

/* ------------------------------------------------------- rollup reports */

describe('dashboard and accounts rollups', () => {
  const d = db({
    clients: [{ id: 'C1', status: 'Active' }, { id: 'C2', status: 'Inactive' }],
    projects: [{ id: 'P1', status: 'In Progress' }, { id: 'P2', status: 'Completed' }],
    invoices: [inv({ id: 'INV-001', gstEnabled: true, gst: 18 })],
    payments: [{ invoiceId: 'INV-001', amount: 1000, date: todayISO() }],
    expenses: [{ amount: 400, category: 'Material', date: todayISO() }],
  })

  it('reports revenue, expenses and net profit', () => {
    const a = dashboardAggregates(d)
    expect(a.totalRevenue).toBe(1000)
    expect(a.totalExpenses).toBe(400)
    expect(a.netProfit).toBe(600)
    expect(a.margin).toBeCloseTo(60, 5)
  })

  it('counts pending payments from live invoices only', () => {
    expect(dashboardAggregates(d).pendingPayments).toBe(4900)
  })

  it('leaves margin at zero rather than dividing by zero revenue', () => {
    expect(dashboardAggregates(db()).margin).toBe(0)
  })

  it('counts active clients and projects separately from totals', () => {
    const a = dashboardAggregates(d)
    expect(a.totalClients).toBe(2)
    expect(a.activeClients).toBe(1)
    expect(a.activeProjects).toBe(1)
    expect(a.completedProjects).toBe(1)
  })

  it('returns a six month revenue series ending this month', () => {
    expect(dashboardAggregates(d).revExp).toHaveLength(6)
    expect(dashboardAggregates(d).revExp.at(-1).revenue).toBe(1000)
  })

  it('sums GST only from live, GST-enabled invoices', () => {
    expect(accountsSummary(d).gstCollected).toBe(900)
    const draft = db({ invoices: [inv({ status: 'Draft', gstEnabled: true })] })
    expect(accountsSummary(draft).gstCollected).toBe(0)
  })

  it('returns the requested number of months', () => {
    expect(accountsSummary(d, 12).series).toHaveLength(12)
  })
})
