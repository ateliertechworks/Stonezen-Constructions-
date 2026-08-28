import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Search, Pencil, Trash2, Download, Eye, BellRing, ReceiptIndianRupee, Percent } from 'lucide-react'

import { useStore } from '../lib/useStore'
import { quotationTotals } from '../lib/calc'
import { formatINR, formatINRCompact, formatDate, daysSince, todayISO } from '../lib/format'
import { deleteQuotation, createInvoiceFromQuotation } from '../lib/store'
import { downloadQuotation } from '../lib/pdf'
import { QUOTATION_STATUSES } from '../lib/seed'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import MobileOverview from '../components/ui/MobileOverview'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { SimpleSelect } from '../components/ui/select'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../components/ui/table'
import { cn } from '../lib/utils'

export default function Quotations() {
  const db = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')
  const [confirm, setConfirm] = useState(null)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.quotations
      .filter((x) => status === 'All' || x.status === status)
      .filter((x) => {
        if (!term) return true
        const client = db.clients.find((c) => c.id === x.clientId)
        return [x.id, x.title, x.siteAddress, client?.name, client?.company].some((v) =>
          String(v || '').toLowerCase().includes(term),
        )
      })
      .map((x) => ({
        qt: x,
        client: db.clients.find((c) => c.id === x.clientId),
        project: db.projects.find((p) => p.id === x.projectId),
        totals: quotationTotals(x),
        invoice: db.invoices.find((i) => i.quotationId === x.id),
      }))
      .sort((a, b) => (a.qt.date < b.qt.date ? 1 : -1))
  }, [db, q, status])

  const stats = useMemo(() => {
    const t = (list) => list.reduce((s, x) => s + quotationTotals(x).grandTotal, 0)
    const sent = db.quotations.filter((x) => x.status === 'Sent')
    const accepted = db.quotations.filter((x) => x.status === 'Accepted')
    return {
      total: t(db.quotations),
      sent: sent.length, sentValue: t(sent),
      accepted: accepted.length, acceptedValue: t(accepted),
      winRate: db.quotations.length ? (accepted.length / db.quotations.length) * 100 : 0,
    }
  }, [db])

  /* One source of truth for the four headline figures — the desktop cards and
     the phone panel below render this same list, so they cannot disagree. */
  const overview = useMemo(() => [
    { key: 'total', label: 'Total Quoted', value: formatINRCompact(stats.total), icon: FileText, tone: 'brand' },
    { key: 'sent', label: 'Awaiting Reply', value: stats.sent, icon: BellRing, tone: 'amber' },
    { key: 'accepted', label: 'Accepted', value: stats.accepted, icon: ReceiptIndianRupee, tone: 'green' },
    { key: 'winRate', label: 'Win Rate', value: `${stats.winRate.toFixed(0)}%`, icon: Percent, tone: 'blue' },
  ], [stats])

  return (
    <div>
      <PageHeader
        icon={FileText}
        title="Quotations"
        subtitle={`${db.quotations.length} quotations · ${formatINR(stats.total)} quoted`}
        actions={
          <Button size="sm" onClick={() => navigate('/quotations/new')}>
            <Plus /> New Quotation
          </Button>
        }
      />

      {/* Phones get the compact panel; sm and up keep the existing cards
          exactly as they were — 2 columns on tablet, 4 on desktop. */}
      <MobileOverview title="Quotation Overview" items={overview} />

      <div className="mb-3 hidden grid-cols-2 gap-2.5 sm:grid lg:grid-cols-4">
        <StatCard label="Total Quoted" value={formatINRCompact(stats.total)} sub={`${db.quotations.length} documents`} icon={FileText} tone="brand" />
        <StatCard label="Awaiting Reply" value={stats.sent} sub={formatINRCompact(stats.sentValue)} icon={BellRing} tone="amber" onClick={() => setStatus('Sent')} />
        <StatCard label="Accepted" value={stats.accepted} sub={formatINRCompact(stats.acceptedValue)} icon={ReceiptIndianRupee} tone="green" onClick={() => setStatus('Accepted')} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} sub="of all quotations" tone="blue" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full flex-1 basis-full sm:min-w-[200px] sm:basis-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number, title or client…" className="pl-9" />
        </div>
        <SimpleSelect value={status} onValueChange={setStatus} options={['All', ...QUOTATION_STATUSES]} className="min-w-0 flex-1 sm:w-[140px] sm:flex-none" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={db.quotations.length ? 'No quotations match your filters' : 'No quotations yet'}
          message={db.quotations.length ? 'Try a different search term or status.' : 'Build your first quotation with the drag-and-drop editor.'}
          action={
            <Button onClick={() => navigate('/quotations/new')}>
              <Plus /> New Quotation
            </Button>
          }
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2.5 md:hidden">
            {rows.map(({ qt, client, totals }) => (
              <div
                key={qt.id}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-card transition-colors active:bg-slate-50"
                onClick={() => navigate(`/quotations/${qt.id}/preview`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-slate-900">{qt.id}</p>
                    <p className="truncate text-[12px] text-slate-500">{client?.company || client?.name || 'No client'}</p>
                  </div>
                  <StatusBadge status={qt.status} />
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12.5px] text-slate-600">{qt.title}</p>
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="text-[11.5px] text-slate-400">{formatDate(qt.date)}</span>
                  <span className="text-[14px] font-bold tabular-nums text-slate-900">{formatINR(totals.grandTotal)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <TableWrap className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Quotation</TH>
                  <TH>Client</TH>
                  <TH className="hidden lg:table-cell">Date</TH>
                  <TH className="hidden xl:table-cell">Valid until</TH>
                  <TH className="text-center">Items</TH>
                  <TH className="text-right">Value</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {rows.map(({ qt, client, project, totals, invoice }) => {
                  const expired = qt.validUntil && qt.validUntil < todayISO() && qt.status === 'Sent'
                  return (
                    <TR key={qt.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${qt.id}/preview`)}>
                      <TD>
                        <span className="block font-semibold text-slate-900">{qt.id}</span>
                        <span className="block max-w-[280px] truncate text-[11.5px] text-slate-400">{qt.title}</span>
                      </TD>
                      <TD>
                        <span className="block max-w-[160px] truncate text-[13px]">{client?.company || client?.name || '—'}</span>
                        {project && <span className="block max-w-[160px] truncate text-[11.5px] text-slate-400">{project.name}</span>}
                      </TD>
                      <TD className="hidden lg:table-cell whitespace-nowrap text-[12.5px]">{formatDate(qt.date)}</TD>
                      <TD className={cn('hidden xl:table-cell whitespace-nowrap text-[12.5px]', expired && 'font-semibold text-red-600')}>
                        {formatDate(qt.validUntil)}
                        {expired && <span className="block text-[10.5px]">expired {daysSince(qt.validUntil)}d ago</span>}
                      </TD>
                      <TD className="text-center tabular-nums text-slate-500">{(qt.items || []).length}</TD>
                      <TD className="text-right font-bold tabular-nums">{formatINR(totals.grandTotal)}</TD>
                      <TD>
                        <StatusBadge status={qt.status} />
                        {invoice && <span className="mt-0.5 block text-[10.5px] text-slate-400">→ {invoice.id}</span>}
                      </TD>
                      <TD onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          <Button size="iconSm" variant="ghost" title="Preview" onClick={() => navigate(`/quotations/${qt.id}/preview`)}>
                            <Eye />
                          </Button>
                          <Button size="iconSm" variant="ghost" title="Edit" onClick={() => navigate(`/quotations/${qt.id}/edit`)}>
                            <Pencil />
                          </Button>
                          <Button size="iconSm" variant="ghost" title="Download PDF"
                            onClick={() => downloadQuotation(qt, client, project, db.settings, totals)}>
                            <Download />
                          </Button>
                          {!invoice && (
                            <Button size="iconSm" variant="ghost" title="Convert to invoice"
                              onClick={() => {
                                const inv = createInvoiceFromQuotation(qt)
                                navigate(`/invoices/${inv.id}/edit`)
                              }}>
                              <ReceiptIndianRupee />
                            </Button>
                          )}
                          <Button size="iconSm" variant="ghost" title="Delete" className="text-red-500 hover:bg-red-50" onClick={() => setConfirm(qt)}>
                            <Trash2 />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </TableWrap>
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${confirm?.id}?`}
        description={confirm?.title}
        onConfirm={() => deleteQuotation(confirm.id)}
      />
    </div>
  )
}
