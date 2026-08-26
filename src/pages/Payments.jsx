import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Plus, Search, Pencil, Trash2, IndianRupee, CalendarDays, Users } from 'lucide-react'

import { useStore } from '../lib/useStore'
import { deletePayment } from '../lib/store'
import { formatINR, formatINRCompact, formatDate, monthKey } from '../lib/format'
import { PAYMENT_METHODS } from '../lib/seed'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import { Badge } from '../components/ui/badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import PaymentDialog from '../components/forms/PaymentDialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { SimpleSelect } from '../components/ui/select'
import { TableWrap, Table, THead, TBody, TR, TH, TD, TFoot } from '../components/ui/table'

const METHOD_TONE = {
  'Bank Transfer': 'blue', 'NEFT/RTGS': 'blue', UPI: 'purple',
  Cheque: 'amber', Cash: 'green', Card: 'slate',
}

/** `embedded` renders this inside the Accounts workspace, which supplies its own page header. */
export default function Payments({ embedded = false }) {
  const db = useStore()
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('All')
  const [dialog, setDialog] = useState({ open: false, payment: null })
  const [confirm, setConfirm] = useState(null)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.payments
      .filter((p) => method === 'All' || p.method === method)
      .filter((p) => {
        if (!term) return true
        const client = db.clients.find((c) => c.id === p.clientId)
        return [p.id, p.reference, p.notes, p.invoiceId, client?.name, client?.company].some((v) =>
          String(v || '').toLowerCase().includes(term),
        )
      })
      .map((p) => ({
        payment: p,
        client: db.clients.find((c) => c.id === p.clientId),
        project: db.projects.find((x) => x.id === p.projectId),
      }))
      .sort((a, b) => (a.payment.date < b.payment.date ? 1 : -1))
  }, [db, q, method])

  const stats = useMemo(() => {
    const total = db.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
    const thisMonth = db.payments
      .filter((p) => monthKey(p.date) === monthKey(new Date().toISOString()))
      .reduce((s, p) => s + Number(p.amount || 0), 0)
    const clients = new Set(db.payments.map((p) => p.clientId)).size
    return { total, thisMonth, clients, avg: db.payments.length ? total / db.payments.length : 0 }
  }, [db])

  const filteredTotal = rows.reduce((s, r) => s + Number(r.payment.amount || 0), 0)

  return (
    <div>
      {embedded ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-slate-500">
            {db.payments.length} payments ·{' '}
            <span className="font-semibold text-slate-800">{formatINR(stats.total)}</span> received
          </p>
          <Button size="sm" className="ml-auto" onClick={() => setDialog({ open: true, payment: null })}>
            <Plus /> Record Payment
          </Button>
        </div>
      ) : (
        <PageHeader
          icon={Wallet}
          title="Payments"
          subtitle={`${db.payments.length} payments · ${formatINR(stats.total)} received`}
          actions={
            <Button size="sm" onClick={() => setDialog({ open: true, payment: null })}>
              <Plus /> Record Payment
            </Button>
          }
        />
      )}

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard label="Total Received" value={formatINRCompact(stats.total)} icon={IndianRupee} tone="green" />
        <StatCard label="This Month" value={formatINRCompact(stats.thisMonth)} icon={CalendarDays} tone="brand" />
        <StatCard label="Paying Clients" value={stats.clients} icon={Users} tone="blue" />
        <StatCard label="Average Payment" value={formatINRCompact(stats.avg)} icon={Wallet} tone="amber" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by client, reference or invoice…" className="pl-9" />
        </div>
        <SimpleSelect value={method} onValueChange={setMethod} options={['All', ...PAYMENT_METHODS]} className="w-[170px]" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={db.payments.length ? 'No payments match your filters' : 'No payments recorded'}
          message={db.payments.length ? 'Try a different search or method.' : 'Record a payment to keep invoice balances and ledgers current.'}
          action={
            <Button onClick={() => setDialog({ open: true, payment: null })}>
              <Plus /> Record Payment
            </Button>
          }
        />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Client</TH>
                <TH className="hidden lg:table-cell">Project</TH>
                <TH className="hidden md:table-cell">Against</TH>
                <TH>Method</TH>
                <TH className="hidden xl:table-cell">Reference</TH>
                <TH className="text-right">Amount</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {rows.map(({ payment: p, client, project }) => (
                <TR key={p.id}>
                  <TD className="whitespace-nowrap text-[12.5px]">
                    <span className="block font-medium text-slate-700">{formatDate(p.date)}</span>
                    <span className="block text-[10.5px] text-slate-400">{p.id}</span>
                  </TD>
                  <TD>
                    {client ? (
                      <Link to={`/clients/${client.id}?tab=payments`} className="font-semibold text-slate-900 hover:text-brand">
                        {client.company || client.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                    {p.notes && <span className="block max-w-[200px] truncate text-[11.5px] text-slate-400">{p.notes}</span>}
                  </TD>
                  <TD className="hidden lg:table-cell text-[12.5px]">
                    {project ? (
                      <Link to={`/projects/${project.id}`} className="text-brand hover:underline">{project.name}</Link>
                    ) : '—'}
                  </TD>
                  <TD className="hidden md:table-cell text-[12.5px]">
                    {p.invoiceId ? (
                      <Link to={`/invoices/${p.invoiceId}/preview`} className="text-brand hover:underline">{p.invoiceId}</Link>
                    ) : '—'}
                  </TD>
                  <TD><Badge tone={METHOD_TONE[p.method] || 'slate'}>{p.method}</Badge></TD>
                  <TD className="hidden xl:table-cell max-w-[160px] truncate text-[12px] text-slate-500">{p.reference || '—'}</TD>
                  <TD className="text-right font-bold tabular-nums text-emerald-600">{formatINR(p.amount)}</TD>
                  <TD>
                    <div className="flex justify-end gap-0.5">
                      <Button size="iconSm" variant="ghost" title="Edit" onClick={() => setDialog({ open: true, payment: p })}>
                        <Pencil />
                      </Button>
                      <Button size="iconSm" variant="ghost" title="Delete" className="text-red-500 hover:bg-red-50" onClick={() => setConfirm(p)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
            <TFoot>
              <TR>
                <TD colSpan={6} className="text-right font-bold text-slate-700">
                  {rows.length === db.payments.length ? 'Total received' : `Filtered total (${rows.length} of ${db.payments.length})`}
                </TD>
                <TD className="text-right font-bold tabular-nums text-emerald-600">{formatINR(filteredTotal)}</TD>
                <TD />
              </TR>
            </TFoot>
          </Table>
        </TableWrap>
      )}

      <PaymentDialog
        open={dialog.open}
        payment={dialog.payment}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this payment?"
        description={confirm ? `${formatINR(confirm.amount)} on ${formatDate(confirm.date)} — invoice balances will be recalculated.` : ''}
        onConfirm={() => deletePayment(confirm.id)}
      />
    </div>
  )
}
