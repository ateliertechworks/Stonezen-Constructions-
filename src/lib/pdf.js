/**
 * PDF generation via a hidden iframe + window.print().
 *
 * html2canvas is deliberately avoided: it cannot resolve Tailwind's
 * layered/oklch colour tokens and renders blank or mis-coloured pages.
 * Printing a self-contained document with inline CSS gives crisp, selectable,
 * correctly paginated A4 output in every browser.
 */

import { formatINR, formatDate, formatDateLong, formatNum, amountInWords } from './format'
import logoMark from '../../image/logo-mark.png'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const nl2br = (s) => esc(s).replace(/\n/g, '<br/>')

const NAVY = '#1e3a8a'
const NAVY_DARK = '#152a63'
const ACCENT = '#3b56c4'

/* --------------------------------------------------------------- printing */

export function generateDocumentPDF(htmlContent, filename = 'document') {
  return new Promise((resolve) => {
    const existing = document.getElementById('stonezen-print-frame')
    if (existing) existing.remove()

    const iframe = document.createElement('iframe')
    iframe.id = 'stonezen-print-frame'
    iframe.setAttribute('title', filename)
    Object.assign(iframe.style, {
      position: 'fixed', right: '0', bottom: '0',
      width: '0', height: '0', border: '0', visibility: 'hidden',
    })
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(htmlContent)
    doc.close()

    const fire = () => {
      try {
        iframe.contentWindow.document.title = filename
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      } catch (e) {
        console.error('Stonezen: print failed', e)
      }
      // Keep the frame around long enough for the browser to spool the job.
      setTimeout(() => {
        iframe.remove()
        resolve()
      }, 1500)
    }

    /**
     * Wait for the letterhead artwork before printing.
     *
     * A fixed delay was a race: an image that had not decoded yet printed as a
     * blank box on the client's copy. Capped so a missing file cannot leave the
     * user with a button that never responds.
     */
    const whenImagesReady = () => {
      const win = iframe.contentWindow
      const images = Array.from(win.document.images || [])
      const pending = images.filter((img) => !img.complete)
      if (!pending.length) return Promise.resolve()
      return Promise.race([
        Promise.all(
          pending.map((img) => new Promise((done) => { img.onload = done; img.onerror = done })),
        ),
        new Promise((done) => setTimeout(done, 3000)),
      ])
    }

    const start = () => whenImagesReady().then(() => setTimeout(fire, 60))

    if (doc.readyState === 'complete') start()
    else iframe.onload = start
  })
}

/* ------------------------------------------------------------------- css */

function baseCSS() {
  return `
  @page { size: A4; margin: 10mm 9mm 12mm 9mm; }
  * { box-sizing: border-box; }
  /* The document is always a light-on-white page — never inherit the
     viewer's dark colour scheme, which would print grey on grey. */
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    font-family: 'Segoe UI', Calibri, Arial, Helvetica, sans-serif;
    color: #0f172a; font-size: 10.5pt; line-height: 1.4;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { position: relative; padding: 0; }
  .swoosh { position: relative; height: 74px; margin: -2px -2px 0 -2px; overflow: hidden; }
  .swoosh svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  .brandbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 4px 6px 10px 6px; }
  .who .name { font-size: 15pt; font-weight: 800; letter-spacing: .2px; color: #0f172a; text-transform: uppercase; }
  .who .tag { font-style: italic; color: ${ACCENT}; font-size: 10pt; margin-top: 1px; }
  .who .role { font-weight: 700; font-size: 10.5pt; margin-top: 2px; color: #0f172a; }
  .who .addr { font-size: 8.6pt; color: #475569; margin-top: 3px; max-width: 300px; }
  .meta { text-align: right; font-size: 9.5pt; }
  .meta .gst { font-weight: 700; letter-spacing: .3px; }
  .meta .row { margin-top: 2px; color: #334155; }
  .logo { width: 62px; height: 62px; border-radius: 12px; background: ${NAVY}; color: #fff;
          display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 22pt; letter-spacing: -1px; }
  .logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 12px; background: #fff; }
  .datebar { text-align: right; font-weight: 700; font-size: 11pt; margin: 6px 6px 10px 0; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 8.5pt; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
  .pill.paid { background: #dcfce7; color: #166534; }
  .pill.due { background: #fef3c7; color: #92400e; }
  .pill.over { background: #fee2e2; color: #991b1b; }
  .pill.draft { background: #e2e8f0; color: #334155; }
  .pill.sent { background: #dbeafe; color: #1e40af; }

  .boxes { display: flex; gap: 10px; margin: 0 0 10px 0; }
  .box { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
  .box h4 { margin: 0 0 4px 0; font-size: 8pt; text-transform: uppercase; letter-spacing: .6px; color: ${NAVY}; }
  .box .strong { font-weight: 700; font-size: 10.5pt; }
  .box .line { font-size: 9pt; color: #475569; }

  h2.doctitle { margin: 0 0 8px 0; font-size: 11.5pt; text-align: center; font-weight: 700;
                background: ${NAVY}; color: #fff; padding: 6px 10px; border-radius: 6px 6px 0 0; }

  table { width: 100%; border-collapse: collapse; }
  table.items { border: 1px solid #94a3b8; }
  table.items th { background: #eef2ff; color: #0f172a; font-size: 9pt; font-weight: 700;
                   border: 1px solid #94a3b8; padding: 6px 6px; text-align: left; }
  table.items td { border: 1px solid #94a3b8; padding: 5px 6px; font-size: 9.5pt; vertical-align: top;
                   background: #ffffff; color: #0f172a; }
  table.items tbody tr:nth-child(even) td { background: #f8fafc; }
  .num { text-align: right; white-space: nowrap; }
  .ctr { text-align: center; white-space: nowrap; }
  .desc { width: 46%; }

  .totrow td { font-weight: 600; background: #f8fafc; color: #0f172a; }
  .grand td { background: ${NAVY} !important; color: #fff; font-weight: 800; font-size: 11pt; }
  .words { font-size: 8.8pt; font-style: italic; color: #334155; margin-top: 4px; }

  .section { margin-top: 12px; page-break-inside: avoid; }
  .section h3 { margin: 0 0 5px 0; font-size: 9.5pt; font-weight: 700; color: ${NAVY};
                text-transform: uppercase; letter-spacing: .5px; }
  .note { font-size: 9pt; color: #334155; border-left: 3px solid ${ACCENT}; padding: 4px 0 4px 8px; background: #f8fafc; }
  ul.sched { margin: 0; padding-left: 16px; font-size: 9.2pt; }
  ul.sched li { margin-bottom: 2px; }
  table.sched th { background: #eef2ff; font-size: 8.6pt; border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; color: #0f172a; }
  table.sched td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 9pt; background: #ffffff; color: #0f172a; }

  .footer { margin-top: 16px; border-top: 2px solid ${NAVY}; padding-top: 8px;
            display: flex; justify-content: space-between; gap: 14px; font-size: 8.8pt; color: #334155; }
  .footer .bank { text-align: right; }
  .footer strong { color: #0f172a; }
  .sign { margin-top: 22px; text-align: right; font-size: 9pt; page-break-inside: avoid; }
  .sign .line { display: inline-block; border-top: 1px solid #475569; padding-top: 3px; min-width: 175px; text-align: center; }
  .thanks { text-align: center; font-size: 9pt; color: ${NAVY}; font-weight: 600; margin-top: 10px; }
  `
}

function swooshSVG() {
  return `<div class="swoosh"><svg viewBox="0 0 800 74" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,0 L250,0 C190,26 120,46 0,58 Z" fill="${NAVY}"/>
    <path d="M0,0 L200,0 C150,34 90,56 0,72 Z" fill="${ACCENT}" opacity="0.75"/>
    <path d="M0,0 L140,0 C110,40 62,60 0,74 Z" fill="${NAVY_DARK}" opacity="0.9"/>
  </svg></div>`
}

function letterhead(settings, rightRows = []) {
  const c = settings.company || {}
  // A company logo uploaded in Settings wins; otherwise the Stonezen mark.
  const logoSrc = c.logo || new URL(logoMark, window.location.origin).href
  const logo = `<div class="logo"><img src="${esc(logoSrc)}" alt="logo"/></div>`
  return `
  ${swooshSVG()}
  <div class="brandbar">
    <div class="who">
      <div class="name">${esc(c.ceo || c.name)}</div>
      <div class="tag">${esc(c.tagline || '')}</div>
      <div class="role">${esc(c.designation || c.name)}</div>
      <div class="addr">${esc(c.address || '')}</div>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start">
      <div class="meta">
        ${c.gstin ? `<div class="gst">GSTIN: ${esc(c.gstin)}</div>` : ''}
        <div class="row">${esc(c.phone || '')}</div>
        <div class="row">${esc(c.email || '')}</div>
        ${rightRows.map((r) => `<div class="row">${r}</div>`).join('')}
      </div>
      ${logo}
    </div>
  </div>`
}

function footerBlock(settings) {
  const c = settings.company || {}
  const b = settings.banking || {}
  return `
  <div class="footer">
    <div>
      <div><strong>${esc(c.name)}</strong></div>
      <div>${esc(c.address || '')}</div>
      <div>${esc(c.email || '')} · ${esc(c.phone || '')}</div>
    </div>
    <div class="bank">
      <div><strong>${esc(b.bankName || 'Bank')} Account:</strong> ${esc(b.accountNumber || '')}</div>
      <div><strong>IFSC:</strong> ${esc(b.ifsc || '')}${b.branch ? ` · ${esc(b.branch)}` : ''}</div>
      ${b.upi ? `<div><strong>UPI:</strong> ${esc(b.upi)}</div>` : ''}
    </div>
  </div>`
}

function totalsRows(t, colspan, extra = []) {
  const rows = []
  rows.push(`<tr class="totrow"><td class="num" colspan="${colspan}">Subtotal</td><td class="num">${formatINR(t.subtotal, true)}</td></tr>`)
  if (t.discountAmount > 0)
    rows.push(`<tr class="totrow"><td class="num" colspan="${colspan}">Discount (${formatNum(t.discountPct)}%)</td><td class="num">− ${formatINR(t.discountAmount, true)}</td></tr>`)
  if (t.discountAmount > 0)
    rows.push(`<tr class="totrow"><td class="num" colspan="${colspan}">Taxable Amount</td><td class="num">${formatINR(t.taxableAmount, true)}</td></tr>`)
  if (t.gstEnabled) {
    if (t.inter) {
      rows.push(`<tr class="totrow"><td class="num" colspan="${colspan}">IGST @ ${formatNum(t.gstRate)}%</td><td class="num">${formatINR(t.igst, true)}</td></tr>`)
    } else {
      rows.push(`<tr class="totrow"><td class="num" colspan="${colspan}">CGST @ ${formatNum(t.gstRate / 2)}%</td><td class="num">${formatINR(t.cgst, true)}</td></tr>`)
      rows.push(`<tr class="totrow"><td class="num" colspan="${colspan}">SGST @ ${formatNum(t.gstRate / 2)}%</td><td class="num">${formatINR(t.sgst, true)}</td></tr>`)
    }
  }
  if (t.additional)
    rows.push(`<tr class="totrow"><td class="num" colspan="${colspan}">Additional Charges</td><td class="num">${formatINR(t.additional, true)}</td></tr>`)
  if (Math.abs(t.roundOff) >= 0.01)
    rows.push(`<tr class="totrow"><td class="num" colspan="${colspan}">Round Off</td><td class="num">${t.roundOff < 0 ? '− ' : '+ '}${formatINR(Math.abs(t.roundOff), true)}</td></tr>`)
  rows.push(`<tr class="grand"><td class="num" colspan="${colspan}">TOTAL</td><td class="num">${formatINR(t.grandTotal)}</td></tr>`)
  extra.forEach((e) => rows.push(e))
  return rows.join('')
}

function shell(title, inner) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
  <style>${baseCSS()}</style></head><body><div class="page">${inner}</div></body></html>`
}

/* ------------------------------------------------------------- quotation */

export function buildQuotationHTML(qt, client, project, settings, totals) {
  const t = totals
  const items = (qt.items || [])
    .map(
      (it, i) => `<tr>
      <td class="ctr">${it.sno || i + 1}</td>
      <td class="desc">${nl2br(it.description)}</td>
      <td class="ctr">${esc(it.unit || '')}</td>
      <td class="num">${formatNum(it.area)}</td>
      <td class="num">${formatNum(it.rate)}</td>
      <td class="num">${formatINR(it.amount)}</td>
    </tr>`,
    )
    .join('')

  const sched = (qt.paymentSchedule || []).length
    ? `<div class="section">
        <h3>Payment Schedule</h3>
        <table class="sched">
          <thead><tr><th style="width:60%">Milestone</th><th class="num" style="width:25%">Amount</th><th class="ctr" style="width:15%">Status</th></tr></thead>
          <tbody>${qt.paymentSchedule
            .map(
              (p) => `<tr><td>${esc(p.milestone)}</td><td class="num">${formatINR(p.amount)}</td><td class="ctr">${esc(p.status || 'Pending')}</td></tr>`,
            )
            .join('')}</tbody>
        </table>
      </div>`
    : ''

  const inner = `
  ${letterhead(settings)}
  <div class="datebar">${formatDateLong(qt.date)}</div>

  <div class="boxes">
    <div class="box">
      <h4>Quotation To</h4>
      <div class="strong">${esc(client?.company || client?.name || '—')}</div>
      ${client?.contactPerson ? `<div class="line">Attn: ${esc(client.contactPerson)}</div>` : ''}
      <div class="line">${esc(qt.siteAddress || client?.address || '')}</div>
      <div class="line">${esc(qt.contactNumber || client?.phone || '')}${qt.email || client?.email ? ` · ${esc(qt.email || client?.email)}` : ''}</div>
      ${qt.gstin || client?.gstin ? `<div class="line">GSTIN: ${esc(qt.gstin || client.gstin)}</div>` : ''}
    </div>
    <div class="box">
      <h4>Quotation Details</h4>
      <div class="strong">${esc(qt.quotationNumber || qt.id)}</div>
      <div class="line">Date: ${formatDate(qt.date)}</div>
      <div class="line">Valid Until: ${formatDate(qt.validUntil)}</div>
      ${project ? `<div class="line">Project: ${esc(project.name)}</div>` : ''}
      <div class="line">Status: ${esc(qt.status || 'Draft')}</div>
    </div>
  </div>

  <h2 class="doctitle">${esc(qt.title || 'Quotation')}</h2>
  <table class="items">
    <thead>
      <tr>
        <th class="ctr" style="width:6%">SNo</th>
        <th class="desc">Description</th>
        <th class="ctr" style="width:9%">Unit</th>
        <th class="num" style="width:11%">Area</th>
        <th class="num" style="width:11%">Rate</th>
        <th class="num" style="width:17%">Amount</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
    <tfoot>${totalsRows(t, 5)}</tfoot>
  </table>
  <div class="words">Amount in words: ${esc(amountInWords(t.grandTotal))}</div>

  ${qt.notes ? `<div class="section"><h3>Notes</h3><div class="note">${nl2br(qt.notes)}</div></div>` : ''}
  ${sched}
  ${qt.terms ? `<div class="section"><h3>Terms &amp; Conditions</h3><div class="note">${nl2br(qt.terms)}</div></div>` : ''}

  <div class="thanks">Thank you for the opportunity — we look forward to working with you.</div>
  ${footerBlock(settings)}`

  return shell(`${qt.id} — ${qt.title || 'Quotation'}`, inner)
}

/* --------------------------------------------------------------- invoice */

const PILL_CLASS = {
  Paid: 'paid', 'Partially Paid': 'due', Overdue: 'over', Draft: 'draft',
  Sent: 'sent', Cancelled: 'draft',
}

export function buildInvoiceHTML(inv, client, project, settings, totals, paid = 0, balance = 0, displayStatus = 'Sent') {
  const t = totals
  const items = (inv.items || [])
    .map(
      (it, i) => `<tr>
      <td class="ctr">${it.sno || i + 1}</td>
      <td class="desc">${nl2br(it.description)}</td>
      <td class="ctr">${esc(it.unit || '')}</td>
      <td class="num">${formatNum(it.quantity)}</td>
      <td class="num">${formatNum(it.rate)}</td>
      <td class="num">${formatINR(it.amount)}</td>
    </tr>`,
    )
    .join('')

  const extra = []
  if (paid > 0)
    extra.push(`<tr class="totrow"><td class="num" colspan="5">Amount Paid</td><td class="num">− ${formatINR(paid, true)}</td></tr>`)
  if (paid > 0 || balance !== t.grandTotal)
    extra.push(`<tr class="totrow"><td class="num" colspan="5"><strong>Balance Due</strong></td><td class="num"><strong>${formatINR(balance, true)}</strong></td></tr>`)

  const inner = `
  ${letterhead(settings)}
  <div class="datebar">
    <span class="pill ${PILL_CLASS[displayStatus] || 'sent'}">${esc(displayStatus)}</span>
    &nbsp;&nbsp;${formatDateLong(inv.date)}
  </div>

  <div class="boxes">
    <div class="box">
      <h4>Bill To</h4>
      <div class="strong">${esc(client?.company || client?.name || '—')}</div>
      ${client?.contactPerson ? `<div class="line">Attn: ${esc(client.contactPerson)}</div>` : ''}
      <div class="line">${nl2br(inv.billingAddress || client?.address || '')}</div>
      <div class="line">${esc(client?.phone || '')}${client?.email ? ` · ${esc(client.email)}` : ''}</div>
      ${inv.gstin || client?.gstin ? `<div class="line">GSTIN: ${esc(inv.gstin || client.gstin)}</div>` : ''}
    </div>
    ${inv.shippingAddress && inv.shippingAddress !== inv.billingAddress
      ? `<div class="box"><h4>Ship To / Site</h4><div class="line">${nl2br(inv.shippingAddress)}</div></div>`
      : ''}
    <div class="box">
      <h4>Invoice Details</h4>
      <div class="strong">${esc(inv.invoiceNumber || inv.id)}</div>
      <div class="line">Date: ${formatDate(inv.date)}</div>
      <div class="line">Due: ${formatDate(inv.dueDate)}</div>
      ${project ? `<div class="line">Project: ${esc(project.name)}</div>` : ''}
      ${inv.quotationId ? `<div class="line">Ref Quotation: ${esc(inv.quotationId)}</div>` : ''}
    </div>
  </div>

  <h2 class="doctitle">TAX INVOICE${project ? ` — ${esc(project.name)}` : ''}</h2>
  <table class="items">
    <thead>
      <tr>
        <th class="ctr" style="width:6%">SNo</th>
        <th class="desc">Description</th>
        <th class="ctr" style="width:9%">Unit</th>
        <th class="num" style="width:11%">Qty</th>
        <th class="num" style="width:11%">Rate</th>
        <th class="num" style="width:17%">Amount</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
    <tfoot>${totalsRows(t, 5, extra)}</tfoot>
  </table>
  <div class="words">Amount in words: ${esc(amountInWords(t.grandTotal))}</div>

  ${inv.notes ? `<div class="section"><h3>Notes</h3><div class="note">${nl2br(inv.notes)}</div></div>` : ''}
  ${inv.paymentTerms ? `<div class="section"><h3>Payment Terms</h3><div class="note">${nl2br(inv.paymentTerms)}</div></div>` : ''}

  <div class="sign"><div class="line">For ${esc(settings.company?.name || '')}<br/>Authorised Signatory</div></div>
  <div class="thanks">Thank you for your business.</div>
  ${footerBlock(settings)}`

  return shell(`${inv.id} — Tax Invoice`, inner)
}

/* --------------------------------------------------------- other exports */

export function buildLedgerHTML(client, rows, settings, totals) {
  const body = rows
    .map(
      (r) => `<tr>
    <td class="ctr">${formatDate(r.date)}</td>
    <td class="ctr">${esc(r.type)}</td>
    <td>${esc(r.ref)} — ${esc(r.particulars)}</td>
    <td class="num">${r.debit ? formatINR(r.debit) : '—'}</td>
    <td class="num">${r.credit ? formatINR(r.credit) : '—'}</td>
    <td class="num">${formatINR(r.balance)}</td>
  </tr>`,
    )
    .join('')

  const inner = `
  ${letterhead(settings)}
  <div class="datebar">Statement of Account</div>
  <div class="boxes">
    <div class="box">
      <h4>Client</h4>
      <div class="strong">${esc(client.company || client.name)}</div>
      <div class="line">${esc(client.address || '')}</div>
      <div class="line">${esc(client.phone || '')}</div>
    </div>
    <div class="box">
      <h4>Summary</h4>
      <div class="line">Total Invoiced: ${formatINR(totals.totalInvoiced)}</div>
      <div class="line">Total Received: ${formatINR(totals.totalPaid)}</div>
      <div class="strong">Outstanding: ${formatINR(totals.outstanding)}</div>
    </div>
  </div>
  <table class="items">
    <thead><tr>
      <th class="ctr" style="width:12%">Date</th><th class="ctr" style="width:11%">Type</th>
      <th>Particulars</th><th class="num" style="width:14%">Debit</th>
      <th class="num" style="width:14%">Credit</th><th class="num" style="width:15%">Balance</th>
    </tr></thead>
    <tbody>${body || '<tr><td colspan="6" class="ctr">No transactions</td></tr>'}</tbody>
  </table>
  ${footerBlock(settings)}`
  return shell(`Statement — ${client.name}`, inner)
}

export async function downloadQuotation(qt, client, project, settings, totals) {
  return generateDocumentPDF(buildQuotationHTML(qt, client, project, settings, totals), `${qt.id}-quotation`)
}

export async function downloadInvoice(inv, client, project, settings, totals, paid, balance, status) {
  return generateDocumentPDF(
    buildInvoiceHTML(inv, client, project, settings, totals, paid, balance, status),
    `${inv.id}-invoice`,
  )
}
