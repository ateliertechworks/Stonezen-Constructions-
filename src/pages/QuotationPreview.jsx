import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Download, Pencil, MessageCircle, Mail, Trash2, ReceiptIndianRupee,
  CheckCircle2, Send, Printer,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { quotationTotals } from '../lib/calc'
import { updateQuotation, deleteQuotation, createInvoiceFromQuotation, addActivity } from '../lib/store'
import { formatINR, formatDate, todayISO } from '../lib/format'
import { downloadQuotation } from '../lib/pdf'
import { whatsappLink, mailtoLink, openLink, shareDocWhatsApp, followupEmailTemplate } from '../lib/comms'
import { QUOTATION_STATUSES } from '../lib/seed'
import { normalizeBlocks } from '../components/docs/blocks'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import DocumentView from '../components/docs/DocumentView'
import { Button } from '../components/ui/button'
import { SimpleSelect } from '../components/ui/select'
import { Card, CardContent } from '../components/ui/card'

export default function QuotationPreview() {
  const { id } = useParams()
  const db = useStore()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)

  const qt = db.quotations.find((q) => q.id === id)
  const totals = useMemo(() => quotationTotals(qt || {}), [qt])

  if (!qt) {
    return (
      <EmptyState
        title="Quotation not found"
        message="It may have been deleted."
        action={<Button asChild><Link to="/quotations">Back to quotations</Link></Button>}
      />
    )
  }

  const client = db.clients.find((c) => c.id === qt.clientId)
  const project = db.projects.find((p) => p.id === qt.projectId)
  const blocks = normalizeBlocks(qt.blocks, 'quotation')
  const linkedInvoice = db.invoices.find((i) => i.quotationId === qt.id)

  const sendWhatsApp = () => {
    updateQuotation(qt.id, { status: qt.status === 'Draft' ? 'Sent' : qt.status, lastContact: todayISO() })
    addActivity(`Quotation ${qt.id} shared on WhatsApp with ${client?.name || 'client'}`, 'quotation')
    openLink(whatsappLink(client?.whatsapp || client?.phone, shareDocWhatsApp(client, qt, totals.grandTotal, 'Quotation', db.settings.company)))
  }

  const sendEmail = () => {
    const { subject, body } = followupEmailTemplate(client, qt, totals.grandTotal, db.settings.company)
    updateQuotation(qt.id, { status: qt.status === 'Draft' ? 'Sent' : qt.status, lastContact: todayISO() })
    addActivity(`Quotation ${qt.id} emailed to ${client?.email || 'client'}`, 'quotation')
    openLink(mailtoLink(client?.email || qt.email, subject, body))
  }

  const convert = () => {
    const inv = createInvoiceFromQuotation(qt)
    navigate(`/invoices/${inv.id}/edit`)
  }

  return (
    <div className="pb-16 lg:pb-0">
      <PageHeader
        backTo="/quotations"
        backLabel="All quotations"
        title={qt.id}
        subtitle={
          <>
            {qt.title} · {formatINR(totals.grandTotal)} · valid until {formatDate(qt.validUntil)}
          </>
        }
        actions={
          <div className="hidden flex-wrap gap-2 sm:flex">
            <SimpleSelect
              value={qt.status}
              onValueChange={(v) => {
                updateQuotation(qt.id, { status: v })
                addActivity(`Quotation ${qt.id} marked ${v}`, 'quotation')
              }}
              options={QUOTATION_STATUSES}
              className="w-[130px]"
            />
            <Button size="sm" variant="outline" onClick={() => navigate(`/quotations/${qt.id}/edit`)}>
              <Pencil /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadQuotation(qt, client, project, db.settings, totals)}>
              <Download /> PDF
            </Button>
            <Button size="sm" variant="whatsapp" onClick={sendWhatsApp} disabled={!client?.phone && !client?.whatsapp}>
              <MessageCircle /> WhatsApp
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-auto rounded-xl bg-slate-100 p-3 lg:p-5">
          <DocumentView
            doc={qt}
            kind="quotation"
            blocks={blocks}
            client={client}
            project={project}
            settings={db.settings}
            totals={totals}
            status={qt.status}
          />
        </div>

        <aside className="space-y-3">
          <Card>
            <CardContent className="space-y-2 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Actions</p>
              <Button className="w-full justify-start" variant="outline" onClick={() => downloadQuotation(qt, client, project, db.settings, totals)}>
                <Printer /> Print / Save as PDF
              </Button>
              <Button className="w-full justify-start" variant="whatsapp" onClick={sendWhatsApp} disabled={!client?.phone && !client?.whatsapp}>
                <MessageCircle /> Send on WhatsApp
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={sendEmail} disabled={!client?.email && !qt.email}>
                <Mail /> Send by email
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => navigate(`/quotations/${qt.id}/edit`)}>
                <Pencil /> Edit quotation
              </Button>
              {qt.status !== 'Accepted' && (
                <Button
                  className="w-full justify-start"
                  variant="success"
                  onClick={() => {
                    updateQuotation(qt.id, { status: 'Accepted' })
                    addActivity(`Quotation ${qt.id} accepted by ${client?.name || 'client'} — ${formatINR(totals.grandTotal)}`, 'quotation')
                  }}
                >
                  <CheckCircle2 /> Mark as accepted
                </Button>
              )}
              {qt.status === 'Draft' && (
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => {
                    updateQuotation(qt.id, { status: 'Sent', lastContact: todayISO() })
                    addActivity(`Quotation ${qt.id} marked as sent`, 'quotation')
                  }}
                >
                  <Send /> Mark as sent
                </Button>
              )}
              {linkedInvoice ? (
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link to={`/invoices/${linkedInvoice.id}/preview`}>
                    <ReceiptIndianRupee /> View invoice {linkedInvoice.id}
                  </Link>
                </Button>
              ) : (
                <Button className="w-full justify-start" onClick={convert}>
                  <ReceiptIndianRupee /> Convert to invoice
                </Button>
              )}
              <Button className="w-full justify-start text-red-600 hover:bg-red-50" variant="ghost" onClick={() => setConfirm(true)}>
                <Trash2 /> Delete quotation
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Summary</p>
              <dl className="divide-y divide-slate-100 text-[12.5px]">
                {[
                  ['Client', client ? <Link key="c" to={`/clients/${client.id}`} className="link-brand">{client.company || client.name}</Link> : '—'],
                  ['Project', project ? <Link key="p" to={`/projects/${project.id}`} className="link-brand">{project.name}</Link> : '—'],
                  ['Date', formatDate(qt.date)],
                  ['Valid until', formatDate(qt.validUntil)],
                  ['Line items', (qt.items || []).length],
                  ['GST', qt.gstEnabled ? `${qt.gst}% ${qt.gstType === 'inter' ? 'IGST' : 'CGST+SGST'}` : 'Not applied'],
                  ['Last contact', qt.lastContact ? formatDate(qt.lastContact) : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2 py-1.5">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="max-w-[140px] truncate text-right font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <dt className="font-bold text-slate-700">Grand total</dt>
                  <dd className="font-bold tabular-nums text-slate-900">{formatINR(totals.grandTotal)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-[56px] z-30 flex gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:hidden">
        <Button variant="outline" className="flex-1" onClick={() => downloadQuotation(qt, client, project, db.settings, totals)}>
          <Download /> PDF
        </Button>
        <Button variant="whatsapp" className="flex-1" onClick={sendWhatsApp}>
          <MessageCircle /> Send
        </Button>
        <Button variant="outline" size="icon" onClick={() => navigate(`/quotations/${qt.id}/edit`)}>
          <Pencil />
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${qt.id}?`}
        description="This removes the quotation permanently. Linked invoices are kept."
        onConfirm={() => {
          deleteQuotation(qt.id)
          navigate('/quotations')
        }}
      />
    </div>
  )
}
