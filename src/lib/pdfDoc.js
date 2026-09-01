/**
 * pdfmake document definitions for the quotation, invoice and ledger.
 *
 * These mirror `pdf.js`'s print HTML deliberately closely — same navy, same
 * swoosh, same box layout — because both paths are still live: this one
 * produces a real .pdf file the phone can save or share, the HTML one still
 * backs "Print / Save as PDF" on a desktop.
 *
 * Why a document definition rather than rasterising the existing HTML: the
 * output stays vector, so text is selectable and searchable, the file is tens
 * of kilobytes rather than megabytes, and pagination is handled by the
 * renderer instead of by luck. pdfmake's bundled Roboto also covers ₹ (U+20B9)
 * and − (U+2212), which the PDF standard fonts do not — with those, every
 * amount on the client's copy would have printed as a hollow box.
 */

import { formatINR, formatDate, formatDateLong, formatNum, amountInWords } from './format'

const NAVY = '#1e3a8a'
const NAVY_DARK = '#152a63'
const ACCENT = '#3b56c4'
const GRID = '#94a3b8'
const GRID_SOFT = '#cbd5e1'
const ZEBRA = '#f8fafc'
const HEAD_FILL = '#eef2ff'
const INK = '#0f172a'
const MUTED = '#475569'
const SLATE = '#334155'

/** A4 (595.28pt) less the 25.5pt side margins below. */
const CONTENT_WIDTH = 544

const str = (v) => String(v ?? '')

/* ------------------------------------------------------------- layouts */

/**
 * The bordered items table, including its totals rows.
 *
 * `bodyRows` is how many line items there are, so zebra striping can stop
 * where the totals begin — otherwise the striping walks into the totals block
 * and the grand-total bar loses its contrast. `grandRow` is an absolute row
 * index rather than "the last row": Amount Paid and Balance Due are printed
 * *below* the total, so the navy bar is not at the bottom of the table.
 */
function itemsLayout(bodyRows, grandRow = -1) {
  return {
    hLineWidth: () => 0.7,
    vLineWidth: () => 0.7,
    hLineColor: () => GRID,
    vLineColor: () => GRID,
    paddingLeft: () => 5,
    paddingRight: () => 5,
    paddingTop: () => 4,
    paddingBottom: () => 4,
    fillColor: (rowIndex) => {
      if (rowIndex === 0) return HEAD_FILL
      if (rowIndex === grandRow) return NAVY
      if (rowIndex <= bodyRows) return rowIndex % 2 === 0 ? ZEBRA : null
      return ZEBRA
    },
  }
}

const softLayout = {
  hLineWidth: () => 0.6,
  vLineWidth: () => 0.6,
  hLineColor: () => GRID_SOFT,
  vLineColor: () => GRID_SOFT,
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3,
  paddingBottom: () => 3,
  fillColor: (rowIndex) => (rowIndex === 0 ? HEAD_FILL : null),
}

/** A single rounded-looking info box: one cell, thin border, tinted fill. */
const boxLayout = {
  hLineWidth: () => 0.7,
  vLineWidth: () => 0.7,
  hLineColor: () => GRID_SOFT,
  vLineColor: () => GRID_SOFT,
  paddingLeft: () => 7,
  paddingRight: () => 7,
  paddingTop: () => 5,
  paddingBottom: () => 5,
  fillColor: () => ZEBRA,
}

/* -------------------------------------------------------------- pieces */

function swoosh() {
  return {
    svg: `<svg viewBox="0 0 800 74" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,0 L250,0 C190,26 120,46 0,58 Z" fill="${NAVY}"/>
      <path d="M0,0 L200,0 C150,34 90,56 0,72 Z" fill="${ACCENT}" opacity="0.75"/>
      <path d="M0,0 L140,0 C110,40 62,60 0,74 Z" fill="${NAVY_DARK}" opacity="0.9"/>
    </svg>`,
    width: CONTENT_WIDTH,
    margin: [0, 0, 0, 4],
  }
}

function letterhead(settings, logoDataUrl, extraRows = []) {
  const c = settings.company || {}
  const right = [
    ...(c.gstin ? [{ text: `GSTIN: ${c.gstin}`, bold: true, fontSize: 9, alignment: 'right' }] : []),
    ...(c.phone ? [{ text: str(c.phone), fontSize: 9, color: SLATE, alignment: 'right' }] : []),
    ...(c.email ? [{ text: str(c.email), fontSize: 9, color: SLATE, alignment: 'right' }] : []),
    ...extraRows.map((t) => ({ text: t, fontSize: 9, color: SLATE, alignment: 'right' })),
  ]

  return {
    columns: [
      {
        width: '*',
        stack: [
          { text: str(c.ceo || c.name).toUpperCase(), fontSize: 15, bold: true, color: INK },
          ...(c.tagline ? [{ text: c.tagline, italics: true, color: ACCENT, fontSize: 10, margin: [0, 1, 0, 0] }] : []),
          { text: str(c.designation || c.name), bold: true, fontSize: 10.5, margin: [0, 2, 0, 0], color: INK },
          ...(c.address ? [{ text: c.address, fontSize: 8.5, color: MUTED, margin: [0, 3, 0, 0] }] : []),
        ],
      },
      {
        width: 'auto',
        columns: [
          { width: 'auto', stack: right, margin: [0, 0, 10, 0] },
          // A logo that failed to load is simply absent rather than a broken box.
          logoDataUrl
            ? { width: 54, image: logoDataUrl, fit: [54, 54] }
            : { width: 0, text: '' },
        ],
      },
    ],
    columnGap: 12,
    margin: [2, 2, 2, 8],
  }
}

/** One of the bordered "Quotation To" / "Invoice Details" cards. */
function infoBox(heading, lines) {
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: heading.toUpperCase(), fontSize: 7.5, bold: true, color: NAVY, characterSpacing: 0.5, margin: [0, 0, 0, 3] },
              ...lines
                .filter((l) => l && (typeof l === 'string' ? l.trim() : l.text))
                .map((l) =>
                  typeof l === 'string'
                    ? { text: l, fontSize: 9, color: MUTED }
                    : { text: l.text, fontSize: l.strong ? 10.5 : 9, bold: !!l.strong, color: l.strong ? INK : MUTED },
                ),
            ],
          },
        ],
      ],
    },
    layout: boxLayout,
  }
}

function boxRow(boxes) {
  return {
    columns: boxes.map((b) => ({ width: '*', ...b })),
    columnGap: 9,
    margin: [0, 0, 0, 9],
  }
}

function docTitle(text) {
  return {
    table: { widths: ['*'], body: [[{ text, alignment: 'center', bold: true, fontSize: 11.5, color: '#ffffff' }]] },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 5,
      paddingBottom: () => 5,
      fillColor: () => NAVY,
    },
    margin: [0, 0, 0, 0],
  }
}

/** A titled block that must not be split across a page break. */
function section(heading, body) {
  return {
    unbreakable: true,
    margin: [0, 11, 0, 0],
    stack: [
      { text: heading.toUpperCase(), fontSize: 9, bold: true, color: NAVY, characterSpacing: 0.5, margin: [0, 0, 0, 4] },
      body,
    ],
  }
}

/** The left-ruled note panel used for notes, terms and payment terms. */
function notePanel(text) {
  return {
    table: { widths: ['*'], body: [[{ text: str(text), fontSize: 9, color: SLATE }]] },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i) => (i === 0 ? 2.5 : 0),
      vLineColor: () => ACCENT,
      paddingLeft: () => 7,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 4,
      fillColor: () => ZEBRA,
    },
  }
}

function scheduleTable(rows) {
  return {
    table: {
      widths: ['*', 110, 70],
      headerRows: 1,
      body: [
        [
          { text: 'Milestone', bold: true, fontSize: 8.5, color: INK },
          { text: 'Amount', bold: true, fontSize: 8.5, alignment: 'right', color: INK },
          { text: 'Status', bold: true, fontSize: 8.5, alignment: 'center', color: INK },
        ],
        ...rows.map((p) => [
          { text: str(p.milestone), fontSize: 9, color: SLATE },
          { text: formatINR(p.amount), fontSize: 9, alignment: 'right', color: SLATE },
          { text: str(p.status || 'Pending'), fontSize: 9, alignment: 'center', color: SLATE },
        ]),
      ],
    },
    layout: softLayout,
  }
}

/**
 * The subtotal → grand total rows that close the items table.
 *
 * Returned as table rows rather than a separate table so the column edges line
 * up with the items above them, exactly as the HTML `<tfoot>` does.
 */
function totalsRows(t, cols, extra = []) {
  const label = (text) => {
    const cell = { text, alignment: 'right', fontSize: 9.5, bold: true, color: INK, colSpan: cols - 1 }
    return [cell, ...Array.from({ length: cols - 2 }, () => ({}))]
  }
  const value = (text) => ({ text, alignment: 'right', fontSize: 9.5, bold: true, color: INK })

  const rows = []
  rows.push([...label('Subtotal'), value(formatINR(t.subtotal, true))])

  if (t.discountAmount > 0) {
    rows.push([...label(`Discount (${formatNum(t.discountPct)}%)`), value(`− ${formatINR(t.discountAmount, true)}`)])
    rows.push([...label('Taxable Amount'), value(formatINR(t.taxableAmount, true))])
  }
  if (t.gstEnabled) {
    if (t.inter) {
      rows.push([...label(`IGST @ ${formatNum(t.gstRate)}%`), value(formatINR(t.igst, true))])
    } else {
      rows.push([...label(`CGST @ ${formatNum(t.gstRate / 2)}%`), value(formatINR(t.cgst, true))])
      rows.push([...label(`SGST @ ${formatNum(t.gstRate / 2)}%`), value(formatINR(t.sgst, true))])
    }
  }
  if (t.additional) rows.push([...label('Additional Charges'), value(formatINR(t.additional, true))])
  if (Math.abs(t.roundOff) >= 0.01) {
    rows.push([...label('Round Off'), value(`${t.roundOff < 0 ? '− ' : '+ '}${formatINR(Math.abs(t.roundOff), true)}`)])
  }

  const grandIndex = rows.length
  rows.push([
    { text: 'TOTAL', alignment: 'right', bold: true, fontSize: 11, color: '#ffffff', colSpan: cols - 1 },
    ...Array.from({ length: cols - 2 }, () => ({})),
    { text: formatINR(t.grandTotal), alignment: 'right', bold: true, fontSize: 11, color: '#ffffff' },
  ])

  extra.forEach(({ text, amount }) => {
    rows.push([...label(text), value(amount)])
  })
  // `grandIndex` is relative to this block; callers offset it past the header
  // and line items to get the absolute row the navy fill belongs on.
  return { rows, grandIndex }
}

/**
 * The company / bank strip, pinned to the bottom of every page.
 *
 * It used to flow as ordinary content, which on a long invoice pushed it onto
 * a page of its own — a sheet holding nothing but bank details. Repeating it
 * per page also means a client who prints only page 2 still has the account
 * number to pay into.
 */
function footerBlock(settings, currentPage, pageCount) {
  const c = settings.company || {}
  const b = settings.banking || {}
  return {
    margin: [25.5, 8, 25.5, 0],
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 1.6, lineColor: NAVY }] },
      {
        margin: [0, 6, 0, 0],
        columns: [
          {
            width: '*',
            stack: [
              { text: str(c.name), bold: true, fontSize: 8.8, color: INK },
              { text: str(c.address || ''), fontSize: 8.8, color: SLATE },
              { text: [c.email, c.phone].filter(Boolean).join(' · '), fontSize: 8.8, color: SLATE },
            ],
          },
          {
            width: 'auto',
            alignment: 'right',
            stack: [
              { text: [{ text: `${b.bankName || 'Bank'} Account: `, bold: true, color: INK }, { text: str(b.accountNumber || '') }], fontSize: 8.8, color: SLATE },
              { text: [{ text: 'IFSC: ', bold: true, color: INK }, { text: `${str(b.ifsc || '')}${b.branch ? ` · ${b.branch}` : ''}` }], fontSize: 8.8, color: SLATE },
              ...(b.upi ? [{ text: [{ text: 'UPI: ', bold: true, color: INK }, { text: str(b.upi) }], fontSize: 8.8, color: SLATE }] : []),
            ],
          },
        ],
        columnGap: 14,
      },
      {
        text: pageCount > 1 ? `Page ${currentPage} of ${pageCount}` : '',
        alignment: 'right', fontSize: 7.5, color: '#94a3b8', margin: [0, 3, 0, 0],
      },
    ],
  }
}

function baseDoc(title, content, settings) {
  return {
    info: { title, creator: 'Stonezen OS', producer: 'Stonezen OS' },
    pageSize: 'A4',
    // The bottom margin has to clear the pinned footer strip below.
    pageMargins: [25.5, 26, 25.5, 82],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, color: INK, lineHeight: 1.2 },
    content,
    footer: (current, total) => footerBlock(settings, current, total),
  }
}

/* ----------------------------------------------------------- quotation */

export function quotationDoc(qt, client, project, settings, totals, logoDataUrl) {
  const items = qt.items || []
  const body = [
    [
      { text: 'SNo', alignment: 'center', bold: true, fontSize: 9, color: INK },
      { text: 'Description', bold: true, fontSize: 9, color: INK },
      { text: 'Unit', alignment: 'center', bold: true, fontSize: 9, color: INK },
      { text: 'Area', alignment: 'right', bold: true, fontSize: 9, color: INK },
      { text: 'Rate', alignment: 'right', bold: true, fontSize: 9, color: INK },
      { text: 'Amount', alignment: 'right', bold: true, fontSize: 9, color: INK },
    ],
    ...items.map((it, i) => [
      { text: str(it.sno || i + 1), alignment: 'center', fontSize: 9.5 },
      { text: str(it.description), fontSize: 9.5 },
      { text: str(it.unit || ''), alignment: 'center', fontSize: 9.5 },
      { text: formatNum(it.area), alignment: 'right', fontSize: 9.5 },
      { text: formatNum(it.rate), alignment: 'right', fontSize: 9.5 },
      { text: formatINR(it.amount), alignment: 'right', fontSize: 9.5 },
    ]),
  ]
  const { rows: totRows, grandIndex } = totalsRows(totals, 6)

  const content = [
    swoosh(),
    letterhead(settings, logoDataUrl),
    { text: formatDateLong(qt.date), alignment: 'right', bold: true, fontSize: 11, margin: [0, 0, 2, 9] },
    boxRow([
      infoBox('Quotation To', [
        { text: client?.company || client?.name || '—', strong: true },
        client?.contactPerson ? `Attn: ${client.contactPerson}` : '',
        qt.siteAddress || client?.address || '',
        [qt.contactNumber || client?.phone, qt.email || client?.email].filter(Boolean).join(' · '),
        qt.gstin || client?.gstin ? `GSTIN: ${qt.gstin || client.gstin}` : '',
      ]),
      infoBox('Quotation Details', [
        { text: qt.quotationNumber || qt.id, strong: true },
        `Date: ${formatDate(qt.date)}`,
        `Valid Until: ${formatDate(qt.validUntil)}`,
        project ? `Project: ${project.name}` : '',
        `Status: ${qt.status || 'Draft'}`,
      ]),
    ]),
    docTitle(qt.title || 'Quotation'),
    {
      table: { headerRows: 1, dontBreakRows: true, widths: [28, '*', 42, 58, 62, 88], body: [...body, ...totRows] },
      layout: itemsLayout(items.length, 1 + items.length + grandIndex),
    },
    { text: `Amount in words: ${amountInWords(totals.grandTotal)}`, italics: true, fontSize: 8.8, color: SLATE, margin: [0, 4, 0, 0] },
    ...(qt.notes ? [section('Notes', notePanel(qt.notes))] : []),
    ...((qt.paymentSchedule || []).length ? [section('Payment Schedule', scheduleTable(qt.paymentSchedule))] : []),
    ...(qt.terms ? [section('Terms & Conditions', notePanel(qt.terms))] : []),
    {
      text: 'Thank you for the opportunity — we look forward to working with you.',
      alignment: 'center', fontSize: 9, bold: true, color: NAVY, margin: [0, 10, 0, 0],
    },
  ]

  return baseDoc(`${qt.id} — ${qt.title || 'Quotation'}`, content, settings)
}

/* ------------------------------------------------------------- invoice */

const PILL_COLOURS = {
  Paid: ['#dcfce7', '#166534'],
  'Partially Paid': ['#fef3c7', '#92400e'],
  Overdue: ['#fee2e2', '#991b1b'],
  Draft: ['#e2e8f0', '#334155'],
  Sent: ['#dbeafe', '#1e40af'],
  Cancelled: ['#e2e8f0', '#334155'],
}

function statusPill(status) {
  const [bg, fg] = PILL_COLOURS[status] || PILL_COLOURS.Sent
  return {
    table: { widths: ['auto'], body: [[{ text: str(status).toUpperCase(), fontSize: 8, bold: true, color: fg, characterSpacing: 0.4 }]] },
    layout: {
      hLineWidth: () => 0, vLineWidth: () => 0,
      paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 2.5, paddingBottom: () => 2.5,
      fillColor: () => bg,
    },
  }
}

export function invoiceDoc(inv, client, project, settings, totals, paid = 0, balance = 0, displayStatus = 'Sent', logoDataUrl) {
  const items = inv.items || []
  const body = [
    [
      { text: 'SNo', alignment: 'center', bold: true, fontSize: 9, color: INK },
      { text: 'Description', bold: true, fontSize: 9, color: INK },
      { text: 'Unit', alignment: 'center', bold: true, fontSize: 9, color: INK },
      { text: 'Qty', alignment: 'right', bold: true, fontSize: 9, color: INK },
      { text: 'Rate', alignment: 'right', bold: true, fontSize: 9, color: INK },
      { text: 'Amount', alignment: 'right', bold: true, fontSize: 9, color: INK },
    ],
    ...items.map((it, i) => [
      { text: str(it.sno || i + 1), alignment: 'center', fontSize: 9.5 },
      { text: str(it.description), fontSize: 9.5 },
      { text: str(it.unit || ''), alignment: 'center', fontSize: 9.5 },
      { text: formatNum(it.quantity), alignment: 'right', fontSize: 9.5 },
      { text: formatNum(it.rate), alignment: 'right', fontSize: 9.5 },
      { text: formatINR(it.amount), alignment: 'right', fontSize: 9.5 },
    ]),
  ]

  const extra = []
  if (paid > 0) extra.push({ text: 'Amount Paid', amount: `− ${formatINR(paid, true)}` })
  if (paid > 0 || balance !== totals.grandTotal) extra.push({ text: 'Balance Due', amount: formatINR(balance, true) })

  const { rows: totRows, grandIndex } = totalsRows(totals, 6, extra)

  const shipsElsewhere = inv.shippingAddress && inv.shippingAddress !== inv.billingAddress

  const content = [
    swoosh(),
    letterhead(settings, logoDataUrl),
    {
      columns: [
        { width: '*', text: '' },
        { width: 'auto', ...statusPill(displayStatus) },
        { width: 'auto', text: formatDateLong(inv.date), bold: true, fontSize: 11, margin: [10, 1, 2, 0] },
      ],
      margin: [0, 0, 0, 9],
    },
    boxRow([
      infoBox('Bill To', [
        { text: client?.company || client?.name || '—', strong: true },
        client?.contactPerson ? `Attn: ${client.contactPerson}` : '',
        inv.billingAddress || client?.address || '',
        [client?.phone, client?.email].filter(Boolean).join(' · '),
        inv.gstin || client?.gstin ? `GSTIN: ${inv.gstin || client.gstin}` : '',
      ]),
      ...(shipsElsewhere ? [infoBox('Ship To / Site', [inv.shippingAddress])] : []),
      infoBox('Invoice Details', [
        { text: inv.invoiceNumber || inv.id, strong: true },
        `Date: ${formatDate(inv.date)}`,
        `Due: ${formatDate(inv.dueDate)}`,
        project ? `Project: ${project.name}` : '',
        inv.quotationId ? `Ref Quotation: ${inv.quotationId}` : '',
      ]),
    ]),
    docTitle(`TAX INVOICE${project ? ` — ${project.name}` : ''}`),
    {
      table: { headerRows: 1, dontBreakRows: true, widths: [28, '*', 42, 58, 62, 88], body: [...body, ...totRows] },
      layout: itemsLayout(items.length, 1 + items.length + grandIndex),
    },
    { text: `Amount in words: ${amountInWords(totals.grandTotal)}`, italics: true, fontSize: 8.8, color: SLATE, margin: [0, 4, 0, 0] },
    ...(inv.notes ? [section('Notes', notePanel(inv.notes))] : []),
    ...((inv.paymentSchedule || []).length ? [section('Payment Schedule', scheduleTable(inv.paymentSchedule))] : []),
    ...(inv.paymentTerms ? [section('Payment Terms', notePanel(inv.paymentTerms))] : []),
    // Signature and sign-off move as one block: split, the closing line ends up
    // alone on a page of its own, which is what the client sees printed.
    {
      margin: [0, 18, 0, 0],
      unbreakable: true,
      stack: [
        { text: `For ${settings.company?.name || ''}`, alignment: 'right', fontSize: 9, color: SLATE },
        { text: 'Authorised Signatory', alignment: 'right', fontSize: 9, color: SLATE, margin: [0, 14, 0, 0] },
        { text: 'Thank you for your business.', alignment: 'center', fontSize: 9, bold: true, color: NAVY, margin: [0, 10, 0, 0] },
      ],
    },
  ]

  return baseDoc(`${inv.id} — Tax Invoice`, content, settings)
}

/* -------------------------------------------------------------- ledger */

export function ledgerDoc(client, rows, settings, totals, logoDataUrl) {
  const body = [
    [
      { text: 'Date', alignment: 'center', bold: true, fontSize: 9, color: INK },
      { text: 'Type', alignment: 'center', bold: true, fontSize: 9, color: INK },
      { text: 'Particulars', bold: true, fontSize: 9, color: INK },
      { text: 'Debit', alignment: 'right', bold: true, fontSize: 9, color: INK },
      { text: 'Credit', alignment: 'right', bold: true, fontSize: 9, color: INK },
      { text: 'Balance', alignment: 'right', bold: true, fontSize: 9, color: INK },
    ],
    ...(rows.length
      ? rows.map((r) => [
          { text: formatDate(r.date), alignment: 'center', fontSize: 9 },
          { text: str(r.type), alignment: 'center', fontSize: 9 },
          { text: `${str(r.ref)} — ${str(r.particulars)}`, fontSize: 9 },
          { text: r.debit ? formatINR(r.debit) : '—', alignment: 'right', fontSize: 9 },
          { text: r.credit ? formatINR(r.credit) : '—', alignment: 'right', fontSize: 9 },
          { text: formatINR(r.balance), alignment: 'right', fontSize: 9 },
        ])
      : [[{ text: 'No transactions', colSpan: 6, alignment: 'center', fontSize: 9.5, color: MUTED }, {}, {}, {}, {}, {}]]),
  ]

  const content = [
    swoosh(),
    letterhead(settings, logoDataUrl),
    { text: 'Statement of Account', alignment: 'right', bold: true, fontSize: 11, margin: [0, 0, 2, 9] },
    boxRow([
      infoBox('Client', [
        { text: client.company || client.name, strong: true },
        client.address || '',
        client.phone || '',
      ]),
      infoBox('Summary', [
        `Total Invoiced: ${formatINR(totals.totalInvoiced)}`,
        `Total Received: ${formatINR(totals.totalPaid)}`,
        { text: `Outstanding: ${formatINR(totals.outstanding)}`, strong: true },
      ]),
    ]),
    {
      table: { headerRows: 1, dontBreakRows: true, widths: [64, 58, '*', 74, 74, 80], body },
      layout: itemsLayout(Math.max(rows.length, 1)),
    },
  ]

  return baseDoc(`Statement — ${client.name}`, content, settings)
}
