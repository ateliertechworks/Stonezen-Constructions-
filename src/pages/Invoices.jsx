import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReceiptIndianRupee, Plus, Search, Pencil, Trash2, Download, Eye, Wallet, Clock, IndianRupee,
  AlertTriangle,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { invoiceTotals, invoicePaid, invoiceBalance, invoiceDisplayStatus, isLiveInvoice } from '../lib/calc'
import { formatINR, formatINRCompact, formatDate, daysUntil } from '../lib/format'
import { deleteInvoice } from '../lib/store'
import { downloadInvoice } from '../lib/pdf'
import { INVOICE_STATUSES } from '../lib/seed'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import MobileOverview from '../components/ui/MobileOverview'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import PaymentDialog from '../components/forms/PaymentDialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { SimpleSelect } from '../components/ui/select'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../components/ui/table'
import { cn } from '../lib/utils'

export default function Invoices() {
  const db = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')
  const [confirm, setConfirm] = useState(null)
  const [payFor, setPayFor] = useState(null)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.invoices
      .map((inv) => ({
        inv,
        client: db.clients.find((c) => c.id === inv.clientId),
        project: db.projects.find((p) => p.id === inv.projectId),
        totals: invoiceTotals(inv),
        paid: invoicePaid(db, inv),
        balance: invoiceBalance(db, inv),
        display: invoiceDisplayStatus(db, inv),
      }))
      .filter((r) => status === 'All' || r.display === status)
      .filter((r) => {
        if (!term) return true
        return [r.inv.id, r.inv.notes, r.client?.name, r.client?.company, r.project?.name].some((v) =>
          String(v || '').toLowerCase().includes(term),
        )
      })
      .sort((a, b) => (a.inv.date < b.inv.date ? 1 : -1))
  }, [db, q, status])

  const stats = useMemo(() => {
    const live = db.invoices.filter((i) => isLiveInvoice(db, i))
    const invoiced = live.reduce((s, i) => s + invoiceTotals(i).grandTotal, 0)
    const received = live.reduce((s, i) => s + invoicePaid(db, i), 0)
    const overdue = live.filter((i) => invoiceDisplayStatus(db, i) === 'Overdue')
    return {
      invoiced, received, outstanding: invoiced - received,
      overdueCount: overdue.length,
      overdueValue: overdue.reduce((s, i) => s + Math.max(0, invoiceBalance(db, i)), 0),
    }
  }, [db])

  /* One source of truth for the four headline figures — the desktop cards and
     the phone panel below render this same list, so they cannot disagree. */
  const overview = useMemo(() => [
    { key: 'invoiced', label: 'Total Invoiced', value: formatINRCompact(stats.invoiced), icon: ReceiptIndianRupee, tone: 'brand' },
    { key: 'received', label: 'Received', value: formatINRCompact(stats.received), icon: IndianRupee, tone: 'green' },
    { key: 'outstanding', label: 'Outstanding', value: formatINRCompact(stats.outstanding), icon: Clock, tone: 'amber' },
    { key: 'overdue', label: 'Overdue', value: formatINRCompact(stats.overdueValue), icon: AlertTriangle, tone: 'red' },
  ], [stats])

  return (
    <div>
      <PageHeader
        icon={ReceiptIndianRupee}
        title="Invoices"
        subtitle={`${db.invoices.length} invoices · ${formatINR(stats.outstanding)} outstanding`}
        actions={
          <Button size="sm" onClick={() => navigate('/invoices/new')}>
            <Plus /> New Invoice
          </Button>
        }
      />

      {/* Phones get the compact panel; sm and up keep the existing cards
          exactly as they were — 2 columns on tablet, 4 on desktop. */}
      <MobileOverview title="Invoice Overview" items={overview} />

      <div className="mb-3 hidden grid-cols-2 gap-2.5 sm:grid lg:grid-cols-4">
        <StatCard label="Total Invoiced" value={formatINRCompact(stats.invoiced)} icon={ReceiptIndianRupee} tone="brand" />
        <StatCard label="Received" value={formatINRCompact(stats.received)} icon={IndianRupee} tone="green" />
        <StatCard label="Outstanding" value={formatINRCompact(stats.outstanding)} icon={Clock} tone="amber" />
        <StatCard
          label="Overdue" value={formatINRCompact(stats.overdueValue)}
          sub={`${stats.overdueCount} invoice${stats.overdueCount === 1 ? '' : 's'}`}
          icon={Clock} tone="red" onClick={() => setStatus('Overdue')}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number, client or project…" className="pl-9" />
        </div>
        <SimpleSelect value={status} onValueChange={setStatus} options={['All', ...INVOICE_STATUSES]} className="w-[160px]" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptIndianRupee}
          title={db.invoices.length ? 'No invoices match your filters' : 'No invoices yet'}
          message={db.invoices.length ? 'Try a different search term or status.' : 'Raise an invoice directly or convert an accepted quotation.'}
          action={
            <Button onClick={() => navigate('/invoices/new')}>
              <Plus /> New Invoice
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-2.5 md:hidden">
            {rows.map(({ inv, client, totals, balance, display }) => (
              <div
                key={inv.id}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-card transition-colors active:bg-slate-50"
                onClick={() => navigate(`/invoices/${inv.id}/preview`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-slate-900">{inv.id}</p>
                    <p className="truncate text-[12px] text-slate-500">{client?.company || client?.name || 'No client'}</p>
                  </div>
                  <StatusBadge status={display} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Total</p>
                    <p className="text-[13px] font-bold tabular-nums">{formatINRCompact(totals.grandTotal)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Balance</p>
                    <p className={cn('text-[13px] font-bold tabular-nums', balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {formatINRCompact(balance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Due</p>
                    <p className="text-[13px] font-semibold">{formatDate(inv.dueDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <TableWrap className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Invoice</TH>
                  <TH>Client</TH>
                  <TH className="hidden lg:table-cell">Date</TH>
                  <TH className="hidden lg:table-cell">Due</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right hidden xl:table-cell">Received</TH>
                  <TH className="text-right">Balance</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {rows.map(({ inv, client, project, totals, paid, balance, display }) => {
                  const days = daysUntil(inv.dueDate)
                  return (
                    <TR key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}/preview`)}>
                      <TD>
                        <span className="block font-semibold text-slate-900">{inv.id}</span>
                        {inv.quotationId && <span className="block text-[11px] text-slate-400">from {inv.quotationId}</span>}
                      </TD>
                      <TD>
                        <span className="block max-w-[160px] truncate text-[13px]">{client?.company || client?.name || '—'}</span>
                        {project && <span className="block max-w-[160px] truncate text-[11.5px] text-slate-400">{project.name}</span>}
                      </TD>
                      <TD className="hidden lg:table-cell whitespace-nowrap text-[12.5px]">{formatDate(inv.date)}</TD>
                      <TD className={cn('hidden lg:table-cell whitespace-nowrap text-[12.5px]', display === 'Overdue' && 'font-semibold text-red-600')}>
                        {formatDate(inv.dueDate)}
                        {display === 'Overdue' && <span className="block text-[10.5px]">{Math.abs(days)}d overdue</span>}
                      </TD>
                      <TD className="text-right font-semibold tabular-nums">{formatINR(totals.grandTotal)}</TD>
                      <TD className="hidden xl:table-cell text-right tabular-nums text-emerald-600">{formatINR(paid)}</TD>
                      <TD className={cn('text-right font-bold tabular-nums', balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                        {formatINR(balance)}
                      </TD>
                      <TD><StatusBadge status={display} /></TD>
                      <TD onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          <Button size="iconSm" variant="ghost" title="Preview" onClick={() => navigate(`/invoices/${inv.id}/preview`)}>
                            <Eye />
                          </Button>
                          <Button size="iconSm" variant="ghost" title="Record payment" onClick={() => setPayFor({ inv, balance })}>
                            <Wallet />
                          </Button>
                          <Button size="iconSm" variant="ghost" title="Edit" onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
                            <Pencil />
                          </Button>
                          <Button size="iconSm" variant="ghost" title="Download PDF"
                            onClick={() => downloadInvoice(inv, client, project, db.settings, totals, paid, balance, display)}>
                            <Download />
                          </Button>
                          <Button size="iconSm" variant="ghost" title="Delete" className="text-red-500 hover:bg-red-50" onClick={() => setConfirm(inv)}>
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

      <PaymentDialog
        open={!!payFor}
        onOpenChange={(o) => !o && setPayFor(null)}
        defaults={
          payFor
            ? { clientId: payFor.inv.clientId, projectId: payFor.inv.projectId, invoiceId: payFor.inv.id, amount: Math.max(0, payFor.balance) }
            : {}
        }
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${confirm?.id}?`}
        description="Payments recorded against it are kept but unlinked."
        onConfirm={() => deleteInvoice(confirm.id)}
      />
    </div>
  )
}
