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
      // A restored backup carries its own counters authoritatively — merging the
      // sample data's counters underneath would start a new company at 006.
      counters: parsed.counters ? { ...parsed.counters } : { ...base.counters },
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

/** Set while applying a change that arrived from another tab, so we don't echo it back. */
let applyingRemote = false

/** Raised when the browser refuses to store any more (quota exhausted). */
let lastPersistError = null

function notify() {
  listeners.forEach((l) => l())
}

function persist() {
  if (applyingRemote) return
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    lastPersistError = null
  } catch (e) {
    // Out of quota, or storage blocked entirely (private mode, blocked cookies).
    // The in-memory state is still correct; the user needs to know it isn't saved.
    lastPersistError = e
    console.error('Stonezen: could not persist to localStorage', e)
    window.dispatchEvent(new CustomEvent('stonezen:persist-failed', { detail: e }))
  }
}

export function getPersistError() {
  return lastPersistError
}

export function getState() {
  return state
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Batches every write inside `fn` into a single persist + notify.
 *
 * Creating a record used to write three separate times (number, record,
 * activity), each serialising the whole database. Nested calls collapse into
 * the outermost one.
 */
let batchDepth = 0
let batchDirty = false

export function batch(fn) {
  batchDepth += 1
  try {
    return fn()
  } finally {
    batchDepth -= 1
    if (batchDepth === 0 && batchDirty) {
      batchDirty = false
      persist()
      notify()
    }
  }
}

export function setState(updater) {
  const next = typeof updater === 'function' ? updater(state) : updater
  state = { ...state, ...next }
  if (batchDepth > 0) {
    batchDirty = true
    return state
  }
  persist()
  notify()
  return state
}

/**
 * Adopts a change written by another tab.
 *
 * Every write serialises the whole database, so without this the last tab to
 * save would silently overwrite the other's work. Re-hydrating and notifying
 * *without* persisting is what stops the two tabs writing back and forth
 * forever.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || e.newValue === null) return
    applyingRemote = true
    try {
      state = hydrate(e.newValue)
      notify()
    } finally {
      applyingRemote = false
    }
  })
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

/**
 * The Indian financial year label for a date, e.g. "2026-27" for 12 Aug 2026.
 *
 * GST rule 46(b) requires a consecutive series unique to a financial year, and
 * the Indian FY runs April to March — a calendar year is the wrong boundary.
 */
export function financialYear(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const startYear = d.getMonth() >= 3 ? y : y - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

function counterKey(type, fy) {
  return `${type}:${fy}`
}

/**
 * The next sequence number for a type within the current financial year.
 *
 * Counters are keyed per FY so the series restarts at 001 each April. Legacy
 * un-keyed counters written by an earlier build seed the first FY they are
 * seen in, so an existing install never reuses a number it has already issued.
 */
function nextSeq(type, fy) {
  const keyed = state.counters[counterKey(type, fy)]
  if (keyed !== undefined) return keyed + 1
  const legacy = state.counters[type]
  return (legacy || 0) + 1
}

/**
 * Hyphens, not the conventional slashes: this string doubles as the record id
 * and therefore as a React Router path param, and a slash would split the route.
 */
function formatNumber(type, fy, n) {
  const prefix = state.settings.docs[PREFIX_KEY[type]] || type.slice(0, 2).toUpperCase()
  return `${prefix}-${fy}-${String(n).padStart(3, '0')}`
}

/**
 * Generates the next document number and consumes it, e.g. QT/2026-27/009.
 *
 * The number is allocated at the moment of saving, never when a builder opens
 * a draft — two drafts open at once must not preview the same number.
 */
export function nextNumber(type) {
  const fy = financialYear()
  const n = nextSeq(type, fy)
  setState((s) => ({ counters: { ...s.counters, [counterKey(type, fy)]: n, [type]: n } }))
  return formatNumber(type, fy, n)
}

/**
 * The number a document *would* get, for display in a builder before saving.
 *
 * Deliberately does not consume the counter. Callers must treat this as
 * provisional and let `nextNumber` allocate the real one on save.
 */
export function peekNumber(type) {
  const fy = financialYear()
  return formatNumber(type, fy, nextSeq(type, fy))
}

export function addActivity(text, type = 'general') {
  const entry = { id: uid('ACT'), date: new Date().toISOString(), type, text }
  setState((s) => ({ activities: [entry, ...s.activities].slice(0, 200) }))
  return entry
}

/* ---------------------------------------------------------------- generic */

function makeCrud(collection, { type, label, activityType }) {
  // Each of these used to persist the entire database once per inner write.
  const add = (payload) =>
    batch(() => {
      const id = payload.id || nextNumber(type)
      const record = { ...payload, id }
      setState((s) => ({ [collection]: [record, ...s[collection]] }))
      addActivity(`${label} ${id} created${payload.name ? ` — ${payload.name}` : ''}`, activityType)
      return record
    })
  const update = (id, patch) => {
    setState((s) => ({
      [collection]: s[collection].map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
    return state[collection].find((r) => r.id === id)
  }
  const remove = (id) =>
    batch(() => {
      setState((s) => ({ [collection]: s[collection].filter((r) => r.id !== id) }))
      addActivity(`${label} ${id} deleted`, activityType)
    })
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
/**
 * Whether a client can be deleted outright, and why not if they cannot.
 *
 * Money that has actually been received is a financial record: it must survive
 * the client row that happens to point at it. A client with payments or issued
 * invoices is archived instead, which keeps the books reconcilable.
 */
export function clientDeletionBlockers(id) {
  const payments = state.payments.filter((p) => p.clientId === id).length
  const invoices = state.invoices.filter((i) => i.clientId === id && i.status !== 'Draft').length
  const reasons = []
  if (payments) reasons.push(`${payments} recorded payment${payments > 1 ? 's' : ''}`)
  if (invoices) reasons.push(`${invoices} issued invoice${invoices > 1 ? 's' : ''}`)
  return reasons
}

export function archiveClient(id) {
  clientCrud.update(id, { status: 'Archived', archivedAt: new Date().toISOString() })
  addActivity(`Client ${id} archived — financial records kept`, 'client')
}

export function restoreClient(id) {
  clientCrud.update(id, { status: 'Active', archivedAt: '' })
  addActivity(`Client ${id} restored`, 'client')
}

/**
 * Deletes a client that carries no financial history.
 *
 * Refuses when payments or issued invoices exist — callers should check
 * `clientDeletionBlockers` first and offer archiving instead. Drafts and
 * quotations, which represent no money, are detached rather than deleted so
 * nothing is silently destroyed.
 */
export function deleteClient(id) {
  const blockers = clientDeletionBlockers(id)
  if (blockers.length) {
    archiveClient(id)
    return { ok: false, archived: true, reasons: blockers }
  }
  setState((s) => ({
    projects: s.projects.map((p) => (p.clientId === id ? { ...p, clientId: '' } : p)),
    quotations: s.quotations.map((q) => (q.clientId === id ? { ...q, clientId: '' } : q)),
    invoices: s.invoices.map((i) => (i.clientId === id ? { ...i, clientId: '' } : i)),
  }))
  clientCrud.remove(id)
  return { ok: true }
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
