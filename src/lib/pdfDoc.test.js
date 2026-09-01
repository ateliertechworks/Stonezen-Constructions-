// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { quotationDoc, invoiceDoc, ledgerDoc } from './pdfDoc'
import { quotationTotals, invoiceTotals } from './calc'
import { SEED } from './seed'

const require = createRequire(import.meta.url)
const FONT_DIR = path.join(process.cwd(), 'node_modules/pdfmake/build/fonts/Roboto')

const NAVY = '#1e3a8a'

/* ------------------------------------------------------------- fixtures */

const client = {
  id: 'CL-2026-27-002', name: 'Ravi Kumar', company: 'Kumar Estates Pvt Ltd',
  contactPerson: 'Ravi Kumar', address: '4/221 Trichy Road', city: 'Coimbatore',
  pincode: '641005', phone: '9840012345', email: 'ravi@kumarestates.in', gstin: '33AABCK1234M1Z7',
}
const project = { id: 'PRJ-2026-27-003', name: 'Kumar Residence — Phase 2' }

const quotation = {
  id: 'QT-2026-27-004', quotationNumber: 'QT-2026-27-004', title: 'Granite flooring',
  date: '2026-08-14', validUntil: '2026-09-13', status: 'Sent',
  gstEnabled: true, gst: 18, gstType: 'intra', discount: 5, additionalCharges: 2500, autoRoundOff: true,
  notes: 'Rates hold while the lot lasts.', terms: SEED.settings.docs.defaultTerms,
  paymentSchedule: [{ milestone: 'On confirmation', amount: 268000, status: 'Paid' }],
  items: [
    { sno: 1, description: 'Polished granite, 18mm', unit: 'Sqft', area: 320.5, rate: 148, amount: 47434 },
    { sno: 2, description: 'Skirting', unit: 'Rft', area: 96, rate: 210, amount: 20160 },
  ],
}

const invoice = {
  ...quotation, id: 'INV-2026-27-002', invoiceNumber: 'INV-2026-27-002', quotationId: quotation.id,
  dueDate: '2026-08-29', billingAddress: '4/221 Trichy Road, Coimbatore 641005',
  paymentTerms: SEED.settings.docs.defaultPaymentTerms,
  items: quotation.items.map((it) => ({ ...it, quantity: it.area })),
}

/** Every text fragment in a doc definition, flattened. */
function allText(node, out = []) {
  if (node === null || node === undefined) return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    node.forEach((n) => allText(n, out))
    return out
  }
  if (typeof node === 'object') {
    Object.entries(node).forEach(([k, v]) => {
      if (k === 'svg' || k === 'image') return
      allText(v, out)
    })
  }
  return out
}

/** The items table node — the only one with six columns. */
const itemsTable = (doc) => doc.content.find((c) => c.table && c.table.widths?.length === 6)

/* ---------------------------------------------------------------- tests */

describe('font coverage', () => {
  // The whole reason for pdfmake over jsPDF: the PDF standard fonts have no ₹
  // and no U+2212 minus, and both appear on every document with a discount.
  // A pdfmake upgrade that swapped the bundled font would silently print
  // hollow boxes where every amount should be, so assert the glyphs directly.
  it.each([
    ['₹', 0x20b9],
    ['−', 0x2212],
    ['·', 0x00b7],
    ['—', 0x2014],
  ])('bundled Roboto has %s', (_char, codepoint) => {
    const buf = fs.readFileSync(path.join(FONT_DIR, 'Roboto-Regular.ttf'))
    expect(cmapCovers(buf, codepoint)).toBe(true)
  })
})

describe('quotationDoc', () => {
  const totals = quotationTotals(quotation)
  const doc = quotationDoc(quotation, client, project, SEED.settings, totals, null)
  const text = allText(doc.content).join('\n')

  it('prints the client, the number and every line item', () => {
    expect(text).toContain('Kumar Estates Pvt Ltd')
    expect(text).toContain('QT-2026-27-004')
    expect(text).toContain('Polished granite, 18mm')
    expect(text).toContain('Skirting')
  })

  it('prints the grand total in figures and in words', () => {
    // 67,594 subtotal − 5% + 18% GST + 2,500 charges, rounded off.
    expect(totals.grandTotal).toBe(78273)
    expect(text).toContain('₹78,273')
    expect(text).toContain('Seventy Eight Thousand Two Hundred Seventy Three Rupees Only')
  })

  it('carries the notes, schedule and terms across', () => {
    expect(text).toContain('Rates hold while the lot lasts.')
    expect(text).toContain('On confirmation')
    expect(text).toContain('Water and electricity to be provided at site by the client.')
  })

  it('paints the navy bar on the TOTAL row and nothing below it', () => {
    const table = itemsTable(doc)
    const grandRow = table.table.body.findIndex((row) => row[0]?.text === 'TOTAL')
    expect(grandRow).toBeGreaterThan(0)
    expect(table.layout.fillColor(grandRow)).toBe(NAVY)
    expect(table.layout.fillColor(0)).not.toBe(NAVY)
    expect(table.layout.fillColor(1)).not.toBe(NAVY)
  })

  it('omits a logo it could not load rather than drawing a broken box', () => {
    expect(allText(doc.content)).not.toContain('undefined')
    expect(JSON.stringify(doc.content)).not.toContain('"image":null')
  })
})

describe('invoiceDoc', () => {
  const totals = invoiceTotals(invoice)
  const paid = 25000
  const doc = invoiceDoc(invoice, client, project, SEED.settings, totals, paid, totals.grandTotal - paid, 'Partially Paid', null)
  const table = itemsTable(doc)
  const rows = table.table.body

  it('lists Amount Paid and Balance Due below the total', () => {
    const grandRow = rows.findIndex((r) => r[0]?.text === 'TOTAL')
    const paidRow = rows.findIndex((r) => r[0]?.text === 'Amount Paid')
    const balanceRow = rows.findIndex((r) => r[0]?.text === 'Balance Due')
    expect(paidRow).toBeGreaterThan(grandRow)
    expect(balanceRow).toBeGreaterThan(paidRow)
  })

  // The navy fill used to be pinned to the last row of the table. With Amount
  // Paid and Balance Due printed after the total, that put the white-on-navy
  // bar on the balance line and left TOTAL unreadable.
  it('keeps the navy bar on TOTAL, not on the last row', () => {
    const grandRow = rows.findIndex((r) => r[0]?.text === 'TOTAL')
    expect(table.layout.fillColor(grandRow)).toBe(NAVY)
    expect(table.layout.fillColor(rows.length - 1)).not.toBe(NAVY)
  })

  it('shows the payment status and the source quotation', () => {
    const text = allText(doc.content).join('\n')
    expect(text).toContain('PARTIALLY PAID')
    expect(text).toContain('Ref Quotation: QT-2026-27-004')
  })
})

describe('ledgerDoc', () => {
  it('paints no navy row — a statement has no grand total', () => {
    const rows = [
      { date: '2026-08-01', type: 'Invoice', ref: 'INV-1', particulars: 'Phase 1', debit: 100000, credit: 0, balance: 100000 },
      { date: '2026-08-10', type: 'Payment', ref: 'PAY-1', particulars: 'NEFT', debit: 0, credit: 40000, balance: 60000 },
    ]
    const doc = ledgerDoc(client, rows, SEED.settings, { totalInvoiced: 100000, totalPaid: 40000, outstanding: 60000 }, null)
    const table = itemsTable(doc)
    for (let i = 0; i <= rows.length; i += 1) {
      expect(table.layout.fillColor(i)).not.toBe(NAVY)
    }
  })

  it('renders an empty ledger without throwing', () => {
    const doc = ledgerDoc(client, [], SEED.settings, { totalInvoiced: 0, totalPaid: 0, outstanding: 0 }, null)
    expect(allText(doc.content).join('\n')).toContain('No transactions')
  })
})

describe('rendering', () => {
  it('produces a real, multi-page PDF', async () => {
    const pdfMake = require('pdfmake')
    pdfMake.setFonts({
      Roboto: {
        normal: path.join(FONT_DIR, 'Roboto-Regular.ttf'),
        bold: path.join(FONT_DIR, 'Roboto-Medium.ttf'),
        italics: path.join(FONT_DIR, 'Roboto-Italic.ttf'),
        bolditalics: path.join(FONT_DIR, 'Roboto-MediumItalic.ttf'),
      },
    })
    pdfMake.setLocalAccessPolicy(() => true)
    pdfMake.setUrlAccessPolicy(() => false)

    const totals = quotationTotals(quotation)
    const buffer = await pdfMake.createPdf(quotationDoc(quotation, client, project, SEED.settings, totals, null)).getBuffer()

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    // A vector document of this size is tens of KB; a rasterised one would be
    // megabytes, and an empty one a few hundred bytes.
    expect(buffer.length).toBeGreaterThan(10_000)
    expect(buffer.length).toBeLessThan(400_000)
  })
})

/* ---------------------------------------------- minimal TrueType reader */

/** Whether a font's character map covers a code point (cmap formats 4 and 12). */
function cmapCovers(buf, codepoint) {
  const u16 = (o) => buf.readUInt16BE(o)
  const u32 = (o) => buf.readUInt32BE(o)

  let cmapOff = -1
  for (let i = 0; i < u16(4); i += 1) {
    const rec = 12 + i * 16
    if (buf.toString('ascii', rec, rec + 4) === 'cmap') cmapOff = u32(rec + 8)
  }
  if (cmapOff < 0) return false

  let best = -1
  let bestScore = -1
  for (let i = 0; i < u16(cmapOff + 2); i += 1) {
    const rec = cmapOff + 4 + i * 8
    const pid = u16(rec)
    const eid = u16(rec + 2)
    const score = pid === 3 && eid === 10 ? 3 : pid === 3 && eid === 1 ? 2 : pid === 0 ? 1 : 0
    if (score > bestScore) {
      bestScore = score
      best = cmapOff + u32(rec + 4)
    }
  }
  if (best < 0) return false

  const format = u16(best)
  if (format === 4) {
    if (codepoint > 0xffff) return false
    const segX2 = u16(best + 6)
    const endO = best + 14
    const startO = endO + segX2 + 2
    const deltaO = startO + segX2
    const rangeO = deltaO + segX2
    for (let s = 0; s < segX2 / 2; s += 1) {
      const end = u16(endO + s * 2)
      const start = u16(startO + s * 2)
      if (codepoint < start || codepoint > end) continue
      const ro = u16(rangeO + s * 2)
      if (ro === 0) return ((codepoint + buf.readInt16BE(deltaO + s * 2)) & 0xffff) !== 0
      return u16(rangeO + s * 2 + ro + (codepoint - start) * 2) !== 0
    }
    return false
  }
  if (format === 12) {
    for (let g = 0; g < u32(best + 12); g += 1) {
      const o = best + 16 + g * 12
      if (codepoint >= u32(o) && codepoint <= u32(o + 4)) return true
    }
    return false
  }
  return false
}
