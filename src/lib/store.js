import { SEED, DEFAULT_SETTINGS } from './seed'
import { uid, sortBy } from './utils'

const KEY = 'stonezen_crm_v1'

const COLLECTIONS = ['clients', 'projects', 'quotations', 'invoices', 'payments', 'expenses', 'activities']

function emptyState() {
  return JSON.parse(JSON.stringify(SEED))
}

function hydrate(raw) {
  const base = emptyState()
  if (!raw) return base
  try {
    const parsed = JSON.parse(raw)
    return {
      settings: {
        company: { ...base.settings.company, ...(parsed.settings?.company || {}) },
        banking: { ...base.settings.banking, ...(parsed.settings?.banking || {}) },
        docs: { ...base.settings.docs, ...(parsed.settings?.docs || {}) },
      },
      counters: { ...base.counters, ...(parsed.counters || {}) },
      ...COLLECTIONS.reduce((acc, c) => {
        acc[c] = Array.isArray(parsed[c]) ? parsed[c] : base[c]
        return acc
      }, {}),
    }
  } catch {
    return base
  }
}

let state = hydrate(typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null)
const listeners = new Set()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Stonezen: could not persist to localStorage', e)
  }
}

export function getState() {
  return state
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setState(updater) {
  const next = typeof updater === 'function' ? updater(state) : updater
  state = { ...state, ...next }
  persist()
  listeners.forEach((l) => l())
  return state
}

export function resetData() {
  state = emptyState()
  persist()
  listeners.forEach((l) => l())
}

export function clearData() {
  const base = emptyState()
  state = {
    settings: base.settings,
    counters: { client: 0, project: 0, quotation: 0, invoice: 0, payment: 0, expense: 0 },
    clients: [], projects: [], quotations: [], invoices: [], payments: [], expenses: [], activities: [],
  }
  persist()
  listeners.forEach((l) => l())
}

export function exportData() {
  return JSON.stringify(state, null, 2)
}

export function importData(json) {
  state = hydrate(typeof json === 'string' ? json : JSON.stringify(json))
  persist()
  listeners.forEach((l) => l())
}

const PREFIX_KEY = {
  client: 'clientPrefix', project: 'projectPrefix', quotation: 'quotationPrefix',
  invoice: 'invoicePrefix', payment: 'paymentPrefix', expense: 'expensePrefix',
}

/** Generates the next document number, e.g. QT-2026-009, and bumps the counter. */
export function nextNumber(type) {
  const prefix = state.settings.docs[PREFIX_KEY[type]] || type.slice(0, 2).toUpperCase()
  const n = (state.counters[type] || 0) + 1
  setState((s) => ({ counters: { ...s.counters, [type]: n } }))
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`
}

/** Peek at the next number without consuming it (for builder previews). */
export function peekNumber(type) {
  const prefix = state.settings.docs[PREFIX_KEY[type]] || type.slice(0, 2).toUpperCase()
  const n = (state.counters[type] || 0) + 1
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`
}

export function addActivity(text, type = 'general') {
  const entry = { id: uid('ACT'), date: new Date().toISOString(), type, text }
  setState((s) => ({ activities: [entry, ...s.activities].slice(0, 200) }))
  return entry
}

/* ---------------------------------------------------------------- generic */

function makeCrud(collection, { type, label, activityType }) {
  const add = (payload) => {
    const id = payload.id || nextNumber(type)
    const record = { ...payload, id }
    setState((s) => ({ [collection]: [record, ...s[collection]] }))
    addActivity(`${label} ${id} created${payload.name ? ` — ${payload.name}` : ''}`, activityType)
    return record
  }
  const update = (id, patch) => {
    setState((s) => ({
      [collection]: s[collection].map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
    return state[collection].find((r) => r.id === id)
  }
  const remove = (id) => {
    setState((s) => ({ [collection]: s[collection].filter((r) => r.id !== id) }))
    addActivity(`${label} ${id} deleted`, activityType)
  }
  return { add, update, remove }
}

const clientCrud = makeCrud('clients', { type: 'client', label: 'Client', activityType: 'client' })
const projectCrud = makeCrud('projects', { type: 'project', label: 'Project', activityType: 'project' })
const quotationCrud = makeCrud('quotations', { type: 'quotation', label: 'Quotation', activityType: 'quotation' })
const invoiceCrud = makeCrud('invoices', { type: 'invoice', label: 'Invoice', activityType: 'invoice' })
const paymentCrud = makeCrud('payments', { type: 'payment', label: 'Payment', activityType: 'payment' })
const expenseCrud = makeCrud('expenses', { type: 'expense', label: 'Expense', activityType: 'expense' })

/* ---------------------------------------------------------------- clients */

export function addClient(data) {
  return clientCrud.add({
    name: '', company: '', contactPerson: '', phone: '', whatsapp: '', email: '',
    address: '', city: '', state: 'Tamil Nadu', pincode: '', gstin: '', pan: '',
    status: 'Active', notes: '', createdDate: new Date().toISOString().slice(0, 10),
    ...data,
  })
}
export const updateClient = clientCrud.update
export function deleteClient(id) {
  // Detach dependent records rather than orphaning them silently.
  setState((s) => ({
    projects: s.projects.filter((p) => p.clientId !== id),
    quotations: s.quotations.filter((q) => q.clientId !== id),
    invoices: s.invoices.filter((i) => i.clientId !== id),
    payments: s.payments.filter((p) => p.clientId !== id),
  }))
  clientCrud.remove(id)
}

/* --------------------------------------------------------------- projects */

export function addProject(data) {
  return projectCrud.add({
    clientId: '', name: '', siteAddress: '', startDate: '', expectedCompletion: '',
    actualCompletion: '', value: 0, quotationId: '', invoiceId: '', manager: '',
    status: 'Planning', notes: '', ...data,
  })
}
export const updateProject = projectCrud.update
export function deleteProject(id) {
  setState((s) => ({
    expenses: s.expenses.filter((e) => e.projectId !== id),
    quotations: s.quotations.map((q) => (q.projectId === id ? { ...q, projectId: '' } : q)),
    invoices: s.invoices.map((i) => (i.projectId === id ? { ...i, projectId: '' } : i)),
  }))
  projectCrud.remove(id)
}

/* ------------------------------------------------------------- quotations */

export function blankQuotation(overrides = {}) {
  const d = state.settings.docs
  const today = new Date().toISOString().slice(0, 10)
  const valid = new Date()
  valid.setDate(valid.getDate() + (d.defaultValidityDays || 30))
  return {
    clientId: '', projectId: '', quotationNumber: peekNumber('quotation'),
    date: today, validUntil: valid.toISOString().slice(0, 10),
    title: '', siteAddress: '', gstin: '', contactNumber: '', email: '',
    gstEnabled: false, gst: d.defaultGst ?? 18, gstType: 'intra',
    discount: 0, additionalCharges: 0, autoRoundOff: true, roundOff: 0,
    terms: d.defaultTerms || '', notes: '',
    items: [{ sno: 1, description: '', unit: 'Sqft', area: 0, rate: 0, amount: 0 }],
    paymentSchedule: [],
    status: 'Draft', lastContact: '', nextFollowup: '',
    ...overrides,
  }
}

export function addQuotation(data) {
  const id = data.id || nextNumber('quotation')
  return quotationCrud.add({ ...blankQuotation(), ...data, id, quotationNumber: id })
}
export const updateQuotation = quotationCrud.update
export function deleteQuotation(id) {
  setState((s) => ({
    projects: s.projects.map((p) => (p.quotationId === id ? { ...p, quotationId: '' } : p)),
    invoices: s.invoices.map((i) => (i.quotationId === id ? { ...i, quotationId: '' } : i)),
  }))
  quotationCrud.remove(id)
}

/* --------------------------------------------------------------- invoices */

export function blankInvoice(overrides = {}) {
  const d = state.settings.docs
  const today = new Date().toISOString().slice(0, 10)
  const due = new Date()
  due.setDate(due.getDate() + 15)
  return {
    clientId: '', projectId: '', quotationId: '', invoiceNumber: peekNumber('invoice'),
    date: today, dueDate: due.toISOString().slice(0, 10),
    billingAddress: '', shippingAddress: '', gstin: '',
    gstEnabled: false, gst: d.defaultGst ?? 18, gstType: 'intra',
    discount: 0, additionalCharges: 0, autoRoundOff: true, roundOff: 0,
    paymentTerms: d.defaultPaymentTerms || '', notes: '',
    items: [{ sno: 1, description: '', unit: 'Sqft', quantity: 0, rate: 0, amount: 0 }],
    status: 'Draft',
    ...overrides,
  }
}

export function addInvoice(data) {
  const id = data.id || nextNumber('invoice')
  return invoiceCrud.add({ ...blankInvoice(), ...data, id, invoiceNumber: id })
}
export const updateInvoice = invoiceCrud.update
export function deleteInvoice(id) {
  setState((s) => ({
    projects: s.projects.map((p) => (p.invoiceId === id ? { ...p, invoiceId: '' } : p)),
    payments: s.payments.map((p) => (p.invoiceId === id ? { ...p, invoiceId: '' } : p)),
  }))
  invoiceCrud.remove(id)
}

/** Converts an accepted quotation into a draft invoice (items carried across). */
export function createInvoiceFromQuotation(q) {
  const client = state.clients.find((c) => c.id === q.clientId)
  const inv = addInvoice({
    clientId: q.clientId,
    projectId: q.projectId,
    quotationId: q.id,
    billingAddress: client?.address ? `${client.address}, ${client.city} ${client.pincode}` : q.siteAddress,
    shippingAddress: q.siteAddress,
    gstin: q.gstin || client?.gstin || '',
    gstEnabled: !!q.gstEnabled,
    gst: q.gst,
    gstType: q.gstType || 'intra',
    discount: q.discount || 0,
    additionalCharges: q.additionalCharges || 0,
    autoRoundOff: q.autoRoundOff !== false,
    notes: `Generated from quotation ${q.id}.`,
    status: 'Draft',
    items: (q.items || []).map((it, i) => ({
      sno: i + 1,
      description: it.description,
      unit: it.unit,
      quantity: Number(it.area || 0),
      rate: Number(it.rate || 0),
      amount: Number(it.amount || 0),
    })),
  })
  if (q.projectId) updateProject(q.projectId, { invoiceId: inv.id })
  addActivity(`Invoice ${inv.id} generated from quotation ${q.id}`, 'invoice')
  return inv
}

/* --------------------------------------------------------- payments/spend */

export function addPayment(data) {
  const rec = paymentCrud.add({
    clientId: '', projectId: '', invoiceId: '', date: new Date().toISOString().slice(0, 10),
    amount: 0, method: 'Bank Transfer', reference: '', notes: '', type: 'Received', ...data,
  })
  return rec
}
export const updatePayment = paymentCrud.update
export const deletePayment = paymentCrud.remove

export function addExpense(data) {
  return expenseCrud.add({
    projectId: '', date: new Date().toISOString().slice(0, 10), category: 'Material',
    description: '', vendor: '', amount: 0, paymentMethod: 'Cash', notes: '', ...data,
  })
}
export const updateExpense = expenseCrud.update
export const deleteExpense = expenseCrud.remove

/* --------------------------------------------------------------- settings */

export function updateSettings(patch) {
  setState((s) => ({
    settings: {
      company: { ...s.settings.company, ...(patch.company || {}) },
      banking: { ...s.settings.banking, ...(patch.banking || {}) },
      docs: { ...s.settings.docs, ...(patch.docs || {}) },
    },
  }))
  addActivity('Company settings updated', 'settings')
}

export function resetSettings() {
  setState({ settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) })
}

/* --------------------------------------------------------------- lookups */

export const findClient = (db, id) => db.clients.find((c) => c.id === id) || null
export const findProject = (db, id) => db.projects.find((p) => p.id === id) || null
export const findQuotation = (db, id) => db.quotations.find((q) => q.id === id) || null
export const findInvoice = (db, id) => db.invoices.find((i) => i.id === id) || null

export { sortBy }
