import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Download, Pencil, MessageCircle, Mail, Trash2, Printer, Wallet, Send, FileText,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { invoiceTotals, invoicePaid, invoiceBalance, invoiceDisplayStatus } from '../lib/calc'
import { updateInvoice, deleteInvoice, addActivity } from '../lib/store'
import { formatINR, formatDate } from '../lib/format'
import { downloadInvoice } from '../lib/pdf'
import { whatsappLink, mailtoLink, openLink, invoiceReminderWhatsApp, invoiceReminderEmail } from '../lib/comms'
import { INVOICE_STATUSES } from '../lib/seed'
import { normalizeBlocks } from '../components/docs/blocks'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatusBadge from '../components/ui/StatusBadge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import PaymentDialog from '../components/forms/PaymentDialog'
import DocumentView from '../components/docs/DocumentView'
import { Button } from '../components/ui/button'
import { SimpleSelect } from '../components/ui/select'
import { Card, CardContent } from '../components/ui/card'
import { cn } from '../lib/utils'

export default function InvoicePreview() {
  const { id } = useParams()
  const db = useStore()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const inv = db.invoices.find((i) => i.id === id)
  const totals = useMemo(() => invoiceTotals(inv || {}), [inv])

  if (!inv) {
    return (
      <EmptyState
        title="Invoice not found"
        message="It may have been deleted."
        action={<Button asChild><Link to="/invoices">Back to invoices</Link></Button>}
      />
    )
  }

  const client = db.clients.find((c) => c.id === inv.clientId)
  const project = db.projects.find((p) => p.id === inv.projectId)
  const blocks = normalizeBlocks(inv.blocks, 'invoice')
  const paid = invoicePaid(db, inv)
  const balance = invoiceBalance(db, inv)
  const status = invoiceDisplayStatus(db, inv)
  const payments = db.payments.filter((p) => p.invoiceId === inv.id)

  const pdf = () => downloadInvoice(inv, client, project, db.settings, totals, paid, balance, status)

  const remindWhatsApp = () => {
    addActivity(`Payment reminder for ${inv.id} sent on WhatsApp`, 'invoice')
    openLink(whatsappLink(client?.whatsapp || client?.phone, invoiceReminderWhatsApp(client, inv, balance, db.settings.company)))
  }

  const remindEmail = () => {
    const { subject, body } = invoiceReminderEmail(client, inv, balance, db.settings.company, db.settings.banking)
    addActivity(`Payment reminder for ${inv.id} emailed`, 'invoice')
    openLink(mailtoLink(client?.email, subject, body))
  }

  return (
    <div className="pb-16 lg:pb-0">
      <PageHeader
        backTo="/invoices"
        backLabel="All invoices"
        title={inv.id}
        subtitle={
          <>
            {client?.company || client?.name} · {formatINR(totals.grandTotal)} · due {formatDate(inv.dueDate)}
          </>
        }
        actions={
          <div className="hidden flex-wrap gap-2 sm:flex">
            <SimpleSelect
              value={inv.status}
              onValueChange={(v) => {
                updateInvoice(inv.id, { status: v })
                addActivity(`Invoice ${inv.id} marked ${v}`, 'invoice')
              }}
              options={INVOICE_STATUSES}
              className="min-w-0 flex-1 sm:w-[150px] sm:flex-none"
            />
            <Button size="sm" variant="outline" onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
              <Pencil /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={pdf}>
              <Download /> PDF
            </Button>
            <Button size="sm" onClick={() => setPaymentOpen(true)}>
              <Wallet /> Record Payment
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
        <div className="overflow-auto rounded-xl bg-slate-100 p-3 lg:p-5">
          <DocumentView
            doc={inv}
            kind="invoice"
            blocks={blocks}
            client={client}
            project={project}
            settings={db.settings}
            totals={totals}
            paid={paid}
            balance={balance}
            status={status}
          />
        </div>

        <aside className="space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Payment status</p>
                <StatusBadge status={status} />
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                {formatINR(balance)}
              </p>
              <p className="text-[11.5px] text-slate-400">
                {balance > 0 ? 'balance due' : 'fully settled'} · {formatINR(paid)} received of {formatINR(totals.grandTotal)}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${totals.grandTotal ? Math.min(100, (paid / totals.grandTotal) * 100) : 0}%` }}
                />
              </div>
              <Button className="mt-3 w-full" onClick={() => setPaymentOpen(true)}>
                <Wallet /> Record payment
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Actions</p>
              <Button className="w-full justify-start" variant="outline" onClick={pdf}>
                <Printer /> Print / Save as PDF
              </Button>
              <Button className="w-full justify-start" variant="whatsapp" onClick={remindWhatsApp} disabled={!client?.phone && !client?.whatsapp}>
                <MessageCircle /> Payment reminder
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={remindEmail} disabled={!client?.email}>
                <Mail /> Email reminder
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
                <Pencil /> Edit invoice
              </Button>
              {inv.status === 'Draft' && (
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => {
                    updateInvoice(inv.id, { status: 'Sent' })
                    addActivity(`Invoice ${inv.id} marked as sent`, 'invoice')
                  }}
                >
                  <Send /> Mark as sent
                </Button>
              )}
              {inv.quotationId && (
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link to={`/quotations/${inv.quotationId}/preview`}>
                    <FileText /> View quotation {inv.quotationId}
                  </Link>
                </Button>
              )}
              <Button className="w-full justify-start text-red-600 hover:bg-red-50" variant="ghost" onClick={() => setConfirm(true)}>
                <Trash2 /> Delete invoice
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Payments ({payments.length})
              </p>
              {payments.length === 0 ? (
                <p className="py-3 text-center text-[12.5px] text-slate-400">Nothing received yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-[12.5px]">
                      <span className="min-w-0">
                        <span className="block text-slate-700">{formatDate(p.date)}</span>
                        <span className="block truncate text-[11px] text-slate-400">{p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                      </span>
                      <span className="font-bold tabular-nums text-emerald-600">{formatINR(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[56px] z-30 flex gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:hidden">
        <Button variant="outline" className="flex-1" onClick={pdf}>
          <Download /> PDF
        </Button>
        <Button className="flex-1" onClick={() => setPaymentOpen(true)}>
          <Wallet /> Payment
        </Button>
        <Button variant="outline" size="icon" title="Edit invoice" onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
          <Pencil />
        </Button>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        defaults={{ clientId: inv.clientId, projectId: inv.projectId, invoiceId: inv.id, amount: Math.max(0, balance) }}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${inv.id}?`}
        description="Payments recorded against it are kept but unlinked."
        onConfirm={() => {
          deleteInvoice(inv.id)
          navigate('/invoices')
        }}
      />
    </div>
  )
}
