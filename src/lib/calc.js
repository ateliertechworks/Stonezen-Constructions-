import { monthKey, monthLabel, todayISO, daysSince } from './format'

const num = (v) => Number(v || 0)

/* ------------------------------------------------------------ line totals */

export function lineAmount(item, qtyKey = 'area') {
  return Math.round(num(item[qtyKey]) * num(item.rate) * 100) / 100
}

export function itemsSubtotal(items = [], qtyKey = 'area') {
  return items.reduce((sum, it) => {
    const amt = it.amount !== undefined && it.amount !== '' ? num(it.amount) : lineAmount(it, qtyKey)
    return sum + amt
  }, 0)
}

/* ------------------------------------------------------------ doc totals */

function computeTotals(doc, qtyKey) {
  const subtotal = itemsSubtotal(doc.items, qtyKey)
  const discountPct = num(doc.discount)
  const discountAmount = Math.round(subtotal * (discountPct / 100) * 100) / 100
  const taxableAmount = subtotal - discountAmount

  const gstEnabled = !!doc.gstEnabled
  const gstRate = gstEnabled ? num(doc.gst) : 0
  const gstAmount = gstEnabled ? Math.round(taxableAmount * (gstRate / 100) * 100) / 100 : 0
  const inter = doc.gstType === 'inter'
  const cgst = gstEnabled && !inter ? Math.round((gstAmount / 2) * 100) / 100 : 0
  const sgst = cgst
  const igst = gstEnabled && inter ? gstAmount : 0

  const additional = num(doc.additionalCharges)
  const preRound = taxableAmount + gstAmount + additional

  const auto = doc.autoRoundOff !== false
  const roundOff = auto ? Math.round((Math.round(preRound) - preRound) * 100) / 100 : num(doc.roundOff)
  const grandTotal = Math.round((preRound + roundOff) * 100) / 100

  return {
    subtotal, discountPct, discountAmount, taxableAmount,
    gstEnabled, gstRate, gstAmount, cgst, sgst, igst, inter,
    additional, roundOff, grandTotal,
  }
}

export const quotationTotals = (q) => computeTotals(q || {}, 'area')
export const invoiceTotals = (inv) => computeTotals(inv || {}, 'quantity')

/* ---------------------------------------------------------------- invoice */

export function invoicePaid(db, inv) {
  if (!inv) return 0
  return db.payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + num(p.amount), 0)
}

export function invoiceBalance(db, inv) {
  return Math.round((invoiceTotals(inv).grandTotal - invoicePaid(db, inv)) * 100) / 100
}

export function invoiceDisplayStatus(db, inv) {
  if (!inv) return 'Draft'
  if (inv.status === 'Cancelled') return 'Cancelled'
  const total = invoiceTotals(inv).grandTotal
  const paid = invoicePaid(db, inv)
  // A draft stops reading as a draft the moment money has actually come in.
  if (inv.status === 'Draft' && paid <= 0) return 'Draft'
  if (total > 0 && paid >= total - 0.5) return 'Paid'
  const overdue = inv.dueDate && inv.dueDate < todayISO()
  if (paid > 0) return overdue ? 'Overdue' : 'Partially Paid'
  if (overdue) return 'Overdue'
  return inv.status || 'Sent'
}

/**
 * An invoice counts towards receivables once it has been issued — or once a
 * payment has landed against it, which makes a lingering draft real anyway.
 */
export function isLiveInvoice(db, inv) {
  if (!inv || inv.status === 'Cancelled') return false
  if (inv.status !== 'Draft') return true
  return invoicePaid(db, inv) > 0
}

/* --------------------------------------------------------------- projects */

export function projectExpenses(db, projectId) {
  return db.expenses.filter((e) => e.projectId === projectId).reduce((s, e) => s + num(e.amount), 0)
}

export function projectRevenue(db, projectId) {
  return db.payments.filter((p) => p.projectId === projectId).reduce((s, p) => s + num(p.amount), 0)
}

export function projectInvoiced(db, projectId) {
  return db.invoices
    .filter((i) => i.projectId === projectId && i.status !== 'Cancelled')
    .reduce((s, i) => s + invoiceTotals(i).grandTotal, 0)
}

export function projectProfit(db, projectId) {
  return projectRevenue(db, projectId) - projectExpenses(db, projectId)
}

export function projectSummary(db, project) {
  if (!project) return null
  const expenses = projectExpenses(db, project.id)
  const revenue = projectRevenue(db, project.id)
  const invoiced = projectInvoiced(db, project.id)
  const value = num(project.value)
  return {
    value, invoiced, revenue, expenses,
    profit: revenue - expenses,
    margin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
    outstanding: Math.max(0, invoiced - revenue),
    completion: value > 0 ? Math.min(100, (revenue / value) * 100) : 0,
  }
}

/* ---------------------------------------------------------------- clients */

export function clientTotals(db, client) {
  if (!client) return null
  const id = client.id
  const quotations = db.quotations.filter((q) => q.clientId === id)
  const invoices = db.invoices.filter((i) => i.clientId === id && i.status !== 'Cancelled')
  const payments = db.payments.filter((p) => p.clientId === id)
  const projects = db.projects.filter((p) => p.clientId === id)

  const totalQuotationValue = quotations.reduce((s, q) => s + quotationTotals(q).grandTotal, 0)
  const acceptedValue = quotations.filter((q) => q.status === 'Accepted')
    .reduce((s, q) => s + quotationTotals(q).grandTotal, 0)
  const totalInvoiced = invoices.reduce((s, i) => s + invoiceTotals(i).grandTotal, 0)
  const totalPaid = payments.reduce((s, p) => s + num(p.amount), 0)
  const totalProjectValue = projects.reduce((s, p) => s + num(p.value), 0)
  const expenses = projects.reduce((s, p) => s + projectExpenses(db, p.id), 0)

  return {
    totalQuotationValue, acceptedValue, totalInvoiced, totalPaid,
    outstanding: Math.max(0, totalInvoiced - totalPaid),
    totalProjectValue, expenses, profit: totalPaid - expenses,
    counts: {
      quotations: quotations.length,
      accepted: quotations.filter((q) => q.status === 'Accepted').length,
      invoices: invoices.length,
      payments: payments.length,
      projects: projects.length,
      activeProjects: projects.filter((p) => p.status === 'In Progress').length,
    },
  }
}

/** Chronological credit/debit ledger with a running balance. */
export function ledgerForClient(db, client) {
  if (!client) return []
  const rows = []
  db.invoices
    .filter((i) => i.clientId === client.id && isLiveInvoice(db, i))
    .forEach((i) => {
      rows.push({
        date: i.date, type: 'Invoice', ref: i.id,
        particulars: i.notes || `Invoice for ${i.projectId || 'work done'}`,
        debit: invoiceTotals(i).grandTotal, credit: 0, link: `/invoices/${i.id}/preview`,
      })
    })
  db.payments
    .filter((p) => p.clientId === client.id)
    .forEach((p) => {
      rows.push({
        date: p.date, type: 'Payment', ref: p.id,
        particulars: `${p.notes || 'Payment received'}${p.reference ? ` (${p.reference})` : ''}`,
        debit: 0, credit: num(p.amount), link: '/payments',
      })
    })
  rows.sort((a, b) => (a.date === b.date ? (a.type === 'Invoice' ? -1 : 1) : a.date < b.date ? -1 : 1))
  let running = 0
  return rows.map((r) => {
    running += r.debit - r.credit
    return { ...r, balance: Math.round(running * 100) / 100 }
  })
}

/* -------------------------------------------------------------- followups */

/** Sent quotations that have not converted into an accepted deal or a project. */
export function followups(db) {
  return db.quotations
    .filter((q) => q.status === 'Sent')
    .filter((q) => {
      const project = q.projectId ? db.projects.find((p) => p.id === q.projectId) : null
      const blocked = project && ['In Progress', 'Completed'].includes(project.status)
      return !blocked
    })
    .map((q) => {
      const client = db.clients.find((c) => c.id === q.clientId)
      const since = daysSince(q.lastContact || q.date)
      const expired = q.validUntil && q.validUntil < todayISO()
      return {
        quotation: q, client, daysSinceContact: since, expired,
        value: quotationTotals(q).grandTotal,
        urgency: expired || since >= 14 ? 'high' : since >= 7 ? 'medium' : 'low',
      }
    })
    .sort((a, b) => b.daysSinceContact - a.daysSinceContact)
}

/* -------------------------------------------------------------- dashboard */

function lastMonths(count) {
  const keys = []
  const d = new Date()
  d.setDate(1)
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    keys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

export function dashboardAggregates(db) {
  const totalRevenue = db.payments.reduce((s, p) => s + num(p.amount), 0)
  const totalExpenses = db.expenses.reduce((s, e) => s + num(e.amount), 0)

  const liveInvoices = db.invoices.filter((i) => isLiveInvoice(db, i))
  const totalInvoiced = liveInvoices.reduce((s, i) => s + invoiceTotals(i).grandTotal, 0)
  const pendingPayments = liveInvoices.reduce((s, i) => s + Math.max(0, invoiceBalance(db, i)), 0)

  const keys = lastMonths(6)
  const revExp = keys.map((k) => ({
    month: monthLabel(k),
    revenue: db.payments.filter((p) => monthKey(p.date) === k).reduce((s, p) => s + num(p.amount), 0),
    expense: db.expenses.filter((e) => monthKey(e.date) === k).reduce((s, e) => s + num(e.amount), 0),
  }))

  let paid = 0, partial = 0, pending = 0
  liveInvoices.forEach((i) => {
    const st = invoiceDisplayStatus(db, i)
    if (st === 'Paid') paid += 1
    else if (st === 'Partially Paid') partial += 1
    else pending += 1
  })

  const statusOrder = ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled']
  const projectStatus = statusOrder
    .map((s) => ({ name: s, value: db.projects.filter((p) => p.status === s).length }))
    .filter((s) => s.value > 0)

  const expenseByCategory = Object.entries(
    db.expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + num(e.amount)
      return acc
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const fu = followups(db)

  return {
    totalClients: db.clients.length,
    activeClients: db.clients.filter((c) => c.status === 'Active').length,
    totalProjects: db.projects.length,
    activeProjects: db.projects.filter((p) => p.status === 'In Progress').length,
    completedProjects: db.projects.filter((p) => p.status === 'Completed').length,
    quotationsSent: db.quotations.filter((q) => q.status === 'Sent').length,
    quotationsAccepted: db.quotations.filter((q) => q.status === 'Accepted').length,
    quotationValue: db.quotations.reduce((s, q) => s + quotationTotals(q).grandTotal, 0),
    totalInvoiced,
    pendingPayments,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
    revExp,
    paymentOverview: { paid, partial, pending },
    projectStatus,
    expenseByCategory,
    recentActivity: db.activities.slice(0, 8),
    followupCount: fu.length,
    overdueCount: liveInvoices.filter((i) => invoiceDisplayStatus(db, i) === 'Overdue').length,
  }
}

/* -------------------------------------------------------------- accounts */

export function accountsSummary(db, months = 12) {
  const keys = lastMonths(months)
  const series = keys.map((k) => {
    const revenue = db.payments.filter((p) => monthKey(p.date) === k).reduce((s, p) => s + num(p.amount), 0)
    const expense = db.expenses.filter((e) => monthKey(e.date) === k).reduce((s, e) => s + num(e.amount), 0)
    return { month: monthLabel(k), revenue, expense, profit: revenue - expense }
  })
  const revenue = db.payments.reduce((s, p) => s + num(p.amount), 0)
  const expenses = db.expenses.reduce((s, e) => s + num(e.amount), 0)
  const gstCollected = db.invoices
    .filter((i) => i.gstEnabled && isLiveInvoice(db, i))
    .reduce((s, i) => s + invoiceTotals(i).gstAmount, 0)
  return { series, revenue, expenses, profit: revenue - expenses, gstCollected }
}
