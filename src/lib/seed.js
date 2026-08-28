/**
 * Realistic sample data for Stonezen Constructions (Coimbatore, Tamil Nadu).
 * Values are in INR. Dates are ISO (yyyy-mm-dd).
 */

export const DEFAULT_SETTINGS = {
  company: {
    name: 'Stonezen Constructions',
    tagline: 'Building Consultant & Contractor',
    ceo: 'ER. B. Dhanasundaran',
    designation: 'CEO — Stonezen Constructions',
    address: '2E, Ruthira Residency, Peelamedu, Coimbatore - 641004, Tamil Nadu',
    phone: '+91 9597912002',
    email: 'stonezenconstructions@gmail.com',
    gstin: '33BOBPD4858P1ZN',
    website: '',
    logo: '',
    state: 'Tamil Nadu',
    stateCode: '33',
  },
  banking: {
    accountNumber: '19200100009625',
    ifsc: 'FDRL0001920',
    bankName: 'Federal Bank',
    branch: 'Peelamedu, Coimbatore',
    upi: '919597912002@federal',
  },
  docs: {
    quotationPrefix: 'QT',
    invoicePrefix: 'INV',
    paymentPrefix: 'PAY',
    expensePrefix: 'EXP',
    clientPrefix: 'CL',
    projectPrefix: 'PRJ',
    defaultGst: 18,
    defaultPaymentTerms: 'Payment due within 15 days of invoice date. Delayed payments attract 1.5% interest per month.',
    defaultValidityDays: 30,
    defaultTerms:
      'Rates are inclusive of labour and material as described.\nAny additional work beyond this scope will be charged separately.\nWater and electricity to be provided at site by the client.\nQuotation valid for 30 days from the date of issue.',
  },
}

export const EXPENSE_CATEGORIES = [
  'Material', 'Labour', 'Transport', 'Equipment Rental', 'Sub-contractor',
  'Site Utilities', 'Permits & Approvals', 'Fuel', 'Miscellaneous',
]

export const PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'NEFT/RTGS', 'Card']
export const UNITS = ['Sqft', 'Cft', 'Rft', 'Nos', 'Lsum', 'Kg', 'Ton', 'Bag', 'Day', 'Load']

export const CLIENT_STATUSES = ['Active', 'Prospect', 'Inactive', 'Archived']
export const PROJECT_STATUSES = ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled']
export const QUOTATION_STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired']
export const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled']

/**
 * Record ids from the sample dataset that shipped with earlier builds.
 *
 * Kept only so an install that already loaded that data can clear it once —
 * see `purgeDemoRecords` in store.js. Numbers issued now use the financial-year
 * format (CL-2026-27-001), so none of these can collide with a real record.
 */
export const DEMO_RECORD_IDS = new Set([
  'CL-2026-001', 'CL-2026-002', 'CL-2026-003', 'CL-2026-004', 'CL-2026-005',
  'PRJ-2026-001', 'PRJ-2026-002', 'PRJ-2026-003', 'PRJ-2026-004', 'PRJ-2026-005',
  'QT-2026-001', 'QT-2026-002', 'QT-2026-003', 'QT-2026-004',
  'QT-2026-005', 'QT-2026-006', 'QT-2026-007', 'QT-2026-008',
  'INV-2026-001', 'INV-2026-002', 'INV-2026-003', 'INV-2026-004', 'INV-2026-005',
  'PAY-2026-001', 'PAY-2026-002', 'PAY-2026-003', 'PAY-2026-004', 'PAY-2026-005',
  'PAY-2026-006', 'PAY-2026-007', 'PAY-2026-008', 'PAY-2026-009', 'PAY-2026-010',
  'PAY-2026-011', 'PAY-2026-012', 'PAY-2026-013', 'PAY-2026-014', 'PAY-2026-015',
  'EXP-2026-001', 'EXP-2026-002', 'EXP-2026-003', 'EXP-2026-004', 'EXP-2026-005',
  'EXP-2026-006', 'EXP-2026-007', 'EXP-2026-008', 'EXP-2026-009', 'EXP-2026-010',
])

/**
 * A new install starts empty.
 *
 * `settings` is the real company profile, not sample data — the letterhead,
 * GSTIN and bank details a document cannot be issued without.
 */
export const SEED = {
  settings: DEFAULT_SETTINGS,
  counters: {},
  clients: [],
  projects: [],
  quotations: [],
  invoices: [],
  payments: [],
  expenses: [],
  activities: [],
}
