import { formatINR, formatDate, formatDateLong, formatNum, amountInWords } from '../../lib/format'
import { cn } from '../../lib/utils'
import { BLOCK_TYPES } from './blocks'
import logoMark from '../../../image/logo-mark.png'

/**
 * On-screen mirror of the printed document. Keeps the same block order and
 * data as pdf.js so what the user arranges is what they get in the PDF.
 */

const Section = ({ heading, children, className }) => (
  <section className={cn('mt-3', className)}>
    {heading && (
      <h3 className="mb-1 text-[9px] font-bold uppercase tracking-[0.08em] text-brand">{heading}</h3>
    )}
    {children}
  </section>
)

const Box = ({ title, children }) => (
  <div className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2">
    <h4 className="mb-1 text-[8.5px] font-bold uppercase tracking-[0.08em] text-brand">{title}</h4>
    <div className="space-y-0.5 text-[10px] leading-snug text-slate-600">{children}</div>
  </div>
)

function Branding({ p, settings }) {
  const c = settings.company || {}
  return (
    <header>
      <div className="doc-swoosh relative -mx-1 h-12 overflow-hidden">
        <svg viewBox="0 0 800 74" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d="M0,0 L250,0 C190,26 120,46 0,58 Z" fill="#1e3a8a" />
          <path d="M0,0 L200,0 C150,34 90,56 0,72 Z" fill="#3b56c4" opacity="0.75" />
          <path d="M0,0 L140,0 C110,40 62,60 0,74 Z" fill="#152a63" opacity="0.9" />
        </svg>
      </div>
      <div className="doc-brandrow flex items-start justify-between gap-4 px-1 pb-2 pt-1">
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold uppercase leading-tight tracking-tight text-slate-900">
            {c.ceo || c.name}
          </div>
          {p.showTagline && <div className="text-[11px] italic text-brand-light">{c.tagline}</div>}
          <div className="text-[11px] font-bold text-slate-900">{c.designation || c.name}</div>
          {p.showAddress && <div className="mt-0.5 text-[9px] leading-relaxed text-slate-500">{c.address}</div>}
        </div>
        <div className="doc-brandmeta flex shrink-0 items-start gap-2.5">
          <div className="doc-brandcontact text-right text-[10px] leading-snug text-slate-600">
            {p.showGstin && c.gstin && <div className="font-bold text-slate-800">GSTIN: {c.gstin}</div>}
            <div>{c.phone}</div>
            <div className="break-all">{c.email}</div>
          </div>
          {p.showLogo && (
            <img
              src={c.logo || logoMark}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-slate-200"
            />
          )}
        </div>
      </div>
    </header>
  )
}

function Metadata({ p, doc, kind, project, status }) {
  const isInv = kind === 'invoice'
  return (
    <div className="mt-1 flex items-start justify-between gap-3">
      <div />
      <div className="text-right">
        {p.showStatus && (
          <span className="mr-2 inline-block rounded-full bg-navy-50 px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-brand">
            {status || doc.status}
          </span>
        )}
        <span className="text-[12px] font-bold text-slate-900">{formatDateLong(doc.date)}</span>
        <div className="mt-0.5 text-[10px] text-slate-500">
          {isInv ? doc.invoiceNumber || doc.id : doc.quotationNumber || doc.id}
          {' · '}
          {isInv ? `Due ${formatDate(doc.dueDate)}` : `Valid until ${formatDate(doc.validUntil)}`}
        </div>
        {p.showProject && project && <div className="text-[10px] text-slate-500">Project: {project.name}</div>}
      </div>
    </div>
  )
}

function ClientDetails({ p, doc, kind, client, project }) {
  const isInv = kind === 'invoice'
  return (
    <div className="doc-partyrow mt-2 flex gap-2">
      <Box title={p.heading || (isInv ? 'Bill To' : 'Quotation To')}>
        <div className="text-[11px] font-bold text-slate-900">{client?.company || client?.name || '—'}</div>
        {client?.contactPerson && <div>Attn: {client.contactPerson}</div>}
        <div className="whitespace-pre-line">
          {isInv ? doc.billingAddress || client?.address : doc.siteAddress || client?.address}
        </div>
        {p.showContact && (
          <div>
            {doc.contactNumber || client?.phone}
            {(doc.email || client?.email) && ` · ${doc.email || client?.email}`}
          </div>
        )}
        {p.showGstin && (doc.gstin || client?.gstin) && <div>GSTIN: {doc.gstin || client?.gstin}</div>}
      </Box>
      <Box title={isInv ? 'Invoice Details' : 'Quotation Details'}>
        <div className="text-[11px] font-bold text-slate-900">{isInv ? doc.invoiceNumber || doc.id : doc.quotationNumber || doc.id}</div>
        <div>Date: {formatDate(doc.date)}</div>
        <div>{isInv ? `Due: ${formatDate(doc.dueDate)}` : `Valid until: ${formatDate(doc.validUntil)}`}</div>
        {isInv && doc.quotationId && <div>Ref: {doc.quotationId}</div>}
        {project && <div>Project: {project.name}</div>}
      </Box>
    </div>
  )
}

function ProjectDetails({ p, project, doc }) {
  if (!project) return null
  return (
    <Section heading={p.heading}>
      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] text-slate-600">
        <div className="text-[11px] font-bold text-slate-900">{project.name}</div>
        <div>{project.siteAddress || doc.siteAddress}</div>
        {p.showTimeline && (
          <div className="mt-0.5">
            Start: {formatDate(project.startDate)} · Expected completion: {formatDate(project.expectedCompletion)}
            {project.manager && ` · Site in-charge: ${project.manager}`}
          </div>
        )}
      </div>
    </Section>
  )
}

function Items({ p, doc, kind }) {
  const qtyKey = kind === 'invoice' ? 'quantity' : 'area'
  const qtyLabel = kind === 'invoice' ? 'Qty' : 'Area'
  const items = doc.items || []
  return (
    <div className="mt-3">
      <h2 className="rounded-t-md bg-brand px-2.5 py-1.5 text-center text-[11px] font-bold text-white">
        {p.title || doc.title || (kind === 'invoice' ? 'TAX INVOICE' : 'Quotation')}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[430px] border-collapse border border-slate-400 text-[10px]">
          <thead>
            <tr className="bg-navy-50 text-left">
              {p.showSno && <th className="w-[6%] border border-slate-400 px-1.5 py-1 text-center font-bold">SNo</th>}
              <th className="border border-slate-400 px-1.5 py-1 font-bold">Description</th>
              {p.showUnit && <th className="w-[9%] border border-slate-400 px-1.5 py-1 text-center font-bold">Unit</th>}
              <th className="w-[11%] border border-slate-400 px-1.5 py-1 text-right font-bold">{qtyLabel}</th>
              <th className="w-[11%] border border-slate-400 px-1.5 py-1 text-right font-bold">Rate</th>
              <th className="w-[17%] border border-slate-400 px-1.5 py-1 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="border border-slate-400 px-2 py-4 text-center text-slate-400">
                  No line items yet
                </td>
              </tr>
            )}
            {items.map((it, i) => (
              <tr key={i} className={p.zebra && i % 2 ? 'bg-slate-50' : ''}>
                {p.showSno && <td className="border border-slate-400 px-1.5 py-1 text-center align-top">{it.sno || i + 1}</td>}
                <td className="border border-slate-400 px-1.5 py-1 align-top">{it.description || <span className="text-slate-300">—</span>}</td>
                {p.showUnit && <td className="border border-slate-400 px-1.5 py-1 text-center align-top">{it.unit}</td>}
                <td className="border border-slate-400 px-1.5 py-1 text-right align-top tabular-nums">{formatNum(it[qtyKey])}</td>
                <td className="border border-slate-400 px-1.5 py-1 text-right align-top tabular-nums">{formatNum(it.rate)}</td>
                <td className="border border-slate-400 px-1.5 py-1 text-right align-top tabular-nums">{formatINR(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Declared at module scope, not inside Totals: a component created during
 * render is a new type on every pass, so React unmounts and remounts the whole
 * subtree instead of updating it.
 */
function TotalRow({ label, value, strong }) {
  return (
    <div className={cn('flex justify-between gap-4 px-2 py-[3px] text-[10px]', strong && 'font-bold text-slate-900')}>
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function Totals({ t, paid, balance, kind }) {
  return (
    <div className="mt-1 flex justify-end">
      <div className="w-full max-w-[300px] overflow-hidden rounded-b-md border border-t-0 border-slate-400">
        <TotalRow label="Subtotal" value={formatINR(t.subtotal, true)} />
        {t.discountAmount > 0 && <TotalRow label={`Discount (${formatNum(t.discountPct)}%)`} value={`− ${formatINR(t.discountAmount, true)}`} />}
        {t.discountAmount > 0 && <TotalRow label="Taxable Amount" value={formatINR(t.taxableAmount, true)} />}
        {t.gstEnabled && t.inter && <TotalRow label={`IGST @ ${formatNum(t.gstRate)}%`} value={formatINR(t.igst, true)} />}
        {t.gstEnabled && !t.inter && <TotalRow label={`CGST @ ${formatNum(t.gstRate / 2)}%`} value={formatINR(t.cgst, true)} />}
        {t.gstEnabled && !t.inter && <TotalRow label={`SGST @ ${formatNum(t.gstRate / 2)}%`} value={formatINR(t.sgst, true)} />}
        {!!t.additional && <TotalRow label="Additional Charges" value={formatINR(t.additional, true)} />}
        {Math.abs(t.roundOff) >= 0.01 && <TotalRow label="Round Off" value={`${t.roundOff < 0 ? '− ' : '+ '}${formatINR(Math.abs(t.roundOff), true)}`} />}
        <div className="flex justify-between gap-4 bg-brand px-2 py-1.5 text-[11px] font-extrabold text-white">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatINR(t.grandTotal)}</span>
        </div>
        {kind === 'invoice' && paid > 0 && (
          <>
            <TotalRow label="Amount Paid" value={`− ${formatINR(paid, true)}`} />
            <TotalRow label="Balance Due" value={formatINR(balance, true)} strong />
          </>
        )}
      </div>
    </div>
  )
}

function PaymentSchedule({ p, doc }) {
  const rows = doc.paymentSchedule || []
  if (!rows.length) return null
  return (
    <Section heading={p.heading}>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-navy-50">
            <th className="border border-slate-300 px-2 py-1 text-left font-bold">Milestone</th>
            <th className="border border-slate-300 px-2 py-1 text-right font-bold">Amount</th>
            {p.showStatus && <th className="w-[18%] border border-slate-300 px-2 py-1 text-center font-bold">Status</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="border border-slate-300 px-2 py-1">{r.milestone}</td>
              <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{formatINR(r.amount)}</td>
              {p.showStatus && <td className="border border-slate-300 px-2 py-1 text-center">{r.status || 'Pending'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

const NoteBody = ({ text }) => (
  <div className="whitespace-pre-line border-l-[3px] border-brand-light bg-slate-50 py-1 pl-2 text-[10px] leading-relaxed text-slate-600">
    {text}
  </div>
)

function BankInfo({ p, settings }) {
  const b = settings.banking || {}
  return (
    <Section heading={p.heading}>
      <div className="doc-bankgrid grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] text-slate-600">
        <div><span className="font-semibold text-slate-800">Bank:</span> {b.bankName}</div>
        <div><span className="font-semibold text-slate-800">A/C No:</span> {b.accountNumber}</div>
        <div><span className="font-semibold text-slate-800">IFSC:</span> {b.ifsc}</div>
        {p.showUpi && b.upi && <div><span className="font-semibold text-slate-800">UPI:</span> {b.upi}</div>}
      </div>
    </Section>
  )
}

function renderBlock(block, ctx) {
  const p = block.props || {}
  switch (block.type) {
    case 'branding': return <Branding p={p} settings={ctx.settings} />
    case 'metadata': return <Metadata p={p} doc={ctx.doc} kind={ctx.kind} project={ctx.project} status={ctx.status} />
    case 'client_details': return <ClientDetails p={p} doc={ctx.doc} kind={ctx.kind} client={ctx.client} project={ctx.project} />
    case 'project_details': return <ProjectDetails p={p} project={ctx.project} doc={ctx.doc} />
    case 'items': return <Items p={p} doc={ctx.doc} kind={ctx.kind} />
    case 'totals': return (
      <>
        <Totals t={ctx.totals} paid={ctx.paid} balance={ctx.balance} kind={ctx.kind} />
        {p.showWords && (
          <p className="mt-1 text-right text-[9px] italic text-slate-500">
            Amount in words: {amountInWords(ctx.totals.grandTotal)}
          </p>
        )}
      </>
    )
    case 'payment_schedule': return <PaymentSchedule p={p} doc={ctx.doc} />
    case 'notes':
      return ctx.doc.notes ? <Section heading={p.heading}><NoteBody text={ctx.doc.notes} /></Section> : null
    case 'terms': {
      const text = ctx.kind === 'invoice' ? ctx.doc.paymentTerms : ctx.doc.terms
      return text ? <Section heading={ctx.kind === 'invoice' ? 'Payment Terms' : p.heading}><NoteBody text={text} /></Section> : null
    }
    case 'bank_info': return <BankInfo p={p} settings={ctx.settings} />
    case 'signature':
      // Quotations do not carry a signature line. Handled here rather than only
      // in the default layout so quotations already saved with the block drop
      // it as well.
      if (ctx.kind !== 'invoice') return null
      return (
        <div className={cn('mt-6 text-[10px]', p.align === 'left' ? 'text-left' : p.align === 'center' ? 'text-center' : 'text-right')}>
          <span className="inline-block min-w-[170px] border-t border-slate-500 pt-1 text-center">
            For {ctx.settings.company?.name}
            <br />
            {p.text}
          </span>
        </div>
      )
    case 'heading':
      return (
        <h3 className={cn(
          'mt-3 font-bold text-slate-900',
          p.size === 'lg' ? 'text-[15px]' : p.size === 'sm' ? 'text-[11px]' : 'text-[13px]',
          p.align === 'center' && 'text-center', p.align === 'right' && 'text-right',
        )}>
          {p.text}
        </h3>
      )
    case 'text':
      return (
        <p className={cn(
          'mt-1.5 whitespace-pre-line text-[10px] leading-relaxed text-slate-600',
          p.align === 'center' && 'text-center', p.align === 'right' && 'text-right',
          p.emphasis === 'bold' && 'font-bold text-slate-900', p.emphasis === 'italic' && 'italic',
        )}>
          {p.text}
        </p>
      )
    case 'divider':
      return <hr className={cn('my-2 border-0', p.color === 'brand' ? 'bg-brand' : 'bg-slate-300')} style={{ height: `${p.thickness || 1}px` }} />
    case 'spacer':
      return <div style={{ height: `${p.height || 16}px` }} />
    default:
      return null
  }
}

export default function DocumentView({
  doc, kind = 'quotation', blocks = [], client, project, settings,
  totals, paid = 0, balance = 0, status, className,
  selectedId, onSelect, interactive = false,
}) {
  const ctx = { doc, kind, client, project, settings, totals, paid, balance, status }
  return (
    <div className={cn('doc-paper', className)}>
      {blocks
        .filter((b) => b.visible !== false)
        .map((b) => {
          const content = renderBlock(b, ctx)
          if (!content) return null
          if (!interactive) return <div key={b.id}>{content}</div>
          return (
            <div
              key={b.id}
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(b.id)
              }}
              className={cn(
                'relative cursor-pointer rounded transition-all',
                selectedId === b.id ? 'ring-2 ring-brand ring-offset-2' : 'hover:ring-1 hover:ring-brand/30',
              )}
              title={BLOCK_TYPES[b.type]?.label}
            >
              {content}
            </div>
          )
        })}
    </div>
  )
}
