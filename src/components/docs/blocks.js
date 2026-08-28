import {
  Building2, FileText, User, Hammer, Table2, Calculator, CalendarClock,
  StickyNote, Scale, Landmark, Heading1, Type, Minus, MoveVertical, PenLine,
} from 'lucide-react'
import { uid } from '../../lib/utils'

/**
 * A document is an ordered list of blocks. Data blocks (items, totals, …) pull
 * from the live quotation/invoice record; content blocks (heading, text) carry
 * their own props. This keeps the layout editable without duplicating data.
 */
export const BLOCK_TYPES = {
  branding: {
    label: 'Company Letterhead',
    description: 'Logo, name, GSTIN and contact details',
    icon: Building2, group: 'Structure', dataDriven: true,
    props: { showLogo: true, showGstin: true, showAddress: true, showTagline: true },
  },
  metadata: {
    label: 'Document Details',
    description: 'Number, date, validity / due date and status',
    icon: FileText, group: 'Structure', dataDriven: true,
    props: { showStatus: true, showProject: true },
  },
  client_details: {
    label: 'Client Details',
    description: 'Bill-to block with address and GSTIN',
    icon: User, group: 'Structure', dataDriven: true,
    props: { heading: '', showGstin: true, showContact: true },
  },
  project_details: {
    label: 'Project Details',
    description: 'Linked project name, site and timeline',
    icon: Hammer, group: 'Structure', dataDriven: true,
    props: { heading: 'Project', showTimeline: true },
  },
  items: {
    label: 'Line Items Table',
    description: 'Scope of work with unit, quantity, rate and amount',
    icon: Table2, group: 'Content', dataDriven: true, required: true,
    props: { title: '', zebra: true, showUnit: true, showSno: true },
  },
  totals: {
    label: 'Totals & Tax',
    description: 'Subtotal, discount, GST split, round-off, grand total',
    icon: Calculator, group: 'Content', dataDriven: true, required: true,
    props: { showWords: true },
  },
  payment_schedule: {
    label: 'Payment Schedule',
    description: 'Milestone-wise payment plan',
    icon: CalendarClock, group: 'Content', dataDriven: true,
    props: { heading: 'Payment schedule', showStatus: true },
  },
  notes: {
    label: 'Notes',
    description: 'Free-text notes from the document record',
    icon: StickyNote, group: 'Content', dataDriven: true,
    props: { heading: 'Notes' },
  },
  terms: {
    label: 'Terms & Conditions',
    description: 'Terms from the document record',
    icon: Scale, group: 'Content', dataDriven: true,
    props: { heading: 'Terms & Conditions' },
  },
  bank_info: {
    label: 'Bank Details',
    description: 'Account number, IFSC and UPI for payment',
    icon: Landmark, group: 'Footer', dataDriven: true,
    props: { heading: 'Payment details', showUpi: true },
  },
  signature: {
    label: 'Signature',
    description: 'Authorised signatory line',
    icon: PenLine, group: 'Footer',
    props: { text: 'Authorised Signatory', align: 'right' },
  },
  heading: {
    label: 'Heading',
    description: 'A custom section heading',
    icon: Heading1, group: 'Custom',
    props: { text: 'Section heading', size: 'md', align: 'left' },
  },
  text: {
    label: 'Text Block',
    description: 'A custom paragraph',
    icon: Type, group: 'Custom',
    props: { text: 'Write anything here…', align: 'left', emphasis: 'normal' },
  },
  divider: {
    label: 'Divider',
    description: 'Horizontal rule',
    icon: Minus, group: 'Custom',
    props: { thickness: 1, color: 'slate' },
  },
  spacer: {
    label: 'Spacer',
    description: 'Vertical breathing room',
    icon: MoveVertical, group: 'Custom',
    props: { height: 16 },
  },
}

export const BLOCK_GROUPS = ['Structure', 'Content', 'Footer', 'Custom']

export function makeBlock(type, overrides = {}) {
  const def = BLOCK_TYPES[type]
  if (!def) throw new Error(`Unknown block type: ${type}`)
  return {
    id: uid('blk'),
    type,
    visible: true,
    props: { ...def.props, ...(overrides.props || {}) },
    ...overrides,
  }
}

export function defaultBlocks(kind = 'quotation') {
  const order =
    kind === 'invoice'
      ? ['branding', 'metadata', 'client_details', 'items', 'totals', 'notes', 'terms', 'bank_info', 'signature']
      // Quotations carry no signature line — invoices still do.
      : ['branding', 'metadata', 'client_details', 'project_details', 'items', 'totals', 'notes', 'payment_schedule', 'terms', 'bank_info']
  return order.map((t) => makeBlock(t))
}

export function duplicateBlock(block) {
  return { ...block, id: uid('blk'), props: { ...block.props } }
}

export function normalizeBlocks(blocks, kind) {
  if (!Array.isArray(blocks) || blocks.length === 0) return defaultBlocks(kind)
  return blocks.filter((b) => b && BLOCK_TYPES[b.type]).map((b) => ({ ...b, props: { ...BLOCK_TYPES[b.type].props, ...b.props } }))
}
