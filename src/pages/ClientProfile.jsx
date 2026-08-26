import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Phone, Mail, MessageCircle, MapPin, Pencil, Trash2, Plus, FileText,
  ReceiptIndianRupee, Hammer, Wallet, BookOpen, IndianRupee, TrendingUp,
  Clock, Download, ArrowRight,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { clientTotals, ledgerForClient, quotationTotals, invoiceTotals, invoiceBalance, invoiceDisplayStatus, projectSummary } from '../lib/calc'
import { formatINR, formatINRCompact, formatDate, initials } from '../lib/format'
import { deleteClient } from '../lib/store'
import { whatsappLink, mailtoLink, telLink, openLink } from '../lib/comms'
import { generateDocumentPDF, buildLedgerHTML } from '../lib/pdf'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ClientDialog from '../components/forms/ClientDialog'
import ProjectDialog from '../components/forms/ProjectDialog'
import PaymentDialog from '../components/forms/PaymentDialog'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { TableWrap, Table, THead, TBody, TR, TH, TD, TFoot } from '../components/ui/table'
import { cn } from '../lib/utils'

const TABS = [
  { value: 'overview', label: 'Overview', icon: IndianRupee },
  { value: 'projects', label: 'Projects', icon: Hammer },
  { value: 'quotations', label: 'Quotations', icon: FileText },
  { value: 'invoices', label: 'Invoices', icon: ReceiptIndianRupee },
  { value: 'ledger', label: 'Ledger', icon: BookOpen },
  { value: 'payments', label: 'Payments', icon: Wallet },
]

export default function ClientProfile() {
  const { id } = useParams()
  const db = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [editOpen, setEditOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const client = db.clients.find((c) => c.id === id)
  const tab = params.get('tab') || 'overview'

  const t = useMemo(() => (client ? clientTotals(db, client) : null), [db, client])
  const ledger = useMemo(() => (client ? ledgerForClient(db, client) : []), [db, client])

  if (!client) {
    return (
      <EmptyState
        title="Client not found"
        message="This client may have been deleted."
        action={
          <Button asChild>
            <Link to="/clients">Back to clients</Link>
          </Button>
        }
      />
    )
  }

  const projects = db.projects.filter((p) => p.clientId === client.id)
  const quotations = db.quotations.filter((q) => q.clientId === client.id)
  const invoices = db.invoices.filter((i) => i.clientId === client.id)
  const payments = db.payments.filter((p) => p.clientId === client.id)

  const setTab = (v) => setParams(v === 'overview' ? {} : { tab: v }, { replace: true })

  const downloadStatement = () =>
    generateDocumentPDF(buildLedgerHTML(client, ledger, db.settings, t), `${client.id}-statement`)

  return (
    <div>
      <PageHeader
        backTo="/clients"
        backLabel="All clients"
        title={client.company || client.name}
        subtitle={`${client.id} · Client since ${formatDate(client.createdDate)}`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/quotations/new?client=${client.id}`)}>
              <FileText /> Quote
            </Button>
            <Button size="sm" onClick={() => setPaymentOpen(true)}>
              <Wallet /> Payment
            </Button>
          </>
        }
      />

      {/* Identity card */}
      <Card className="mb-3">
        <CardContent className="flex flex-wrap items-start gap-4 p-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-[15px] font-bold text-brand">
            {initials(client.company || client.name)}
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-bold text-slate-900">{client.contactPerson || client.name}</h2>
              <StatusBadge status={client.status} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-slate-500">
              {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
              {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[client.address, client.city, client.pincode].filter(Boolean).join(', ') || '—'}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 text-[12px] text-slate-400">
              {client.gstin && <span>GSTIN: {client.gstin}</span>}
              {client.pan && <span>PAN: {client.pan}</span>}
            </div>
            {client.notes && <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12.5px] text-slate-600">{client.notes}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            <Button size="sm" variant="whatsapp" disabled={!client.whatsapp && !client.phone}
              onClick={() => openLink(whatsappLink(client.whatsapp || client.phone, `Hello ${client.contactPerson || client.name},`))}>
              <MessageCircle /> WhatsApp
            </Button>
            <Button size="iconSm" variant="outline" title="Call" disabled={!client.phone} onClick={() => openLink(telLink(client.phone))}>
              <Phone />
            </Button>
            <Button size="iconSm" variant="outline" title="Email" disabled={!client.email}
              onClick={() => openLink(mailtoLink(client.email, 'Regarding your project', ''))}>
              <Mail />
            </Button>
            <Button size="iconSm" variant="outline" title="Delete client" className="text-red-500" onClick={() => setConfirm(true)}>
              <Trash2 />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((x) => {
            const Icon = x.icon
            return (
              <TabsTrigger key={x.value} value={x.value}>
                <Icon className="h-3.5 w-3.5" />
                {x.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* ---------------------------------------------------------- overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatCard label="Total Invoiced" value={formatINR(t.totalInvoiced)} sub={`${t.counts.invoices} invoices`} icon={ReceiptIndianRupee} tone="brand" />
            <StatCard label="Received" value={formatINR(t.totalPaid)} sub={`${t.counts.payments} payments`} icon={IndianRupee} tone="green" />
            <StatCard label="Outstanding" value={formatINR(t.outstanding)} sub={t.outstanding > 0 ? 'awaiting payment' : 'all settled'} icon={Clock} tone={t.outstanding > 0 ? 'red' : 'blue'} />
            <StatCard label="Quoted Value" value={formatINR(t.totalQuotationValue)} sub={`${t.counts.accepted} of ${t.counts.quotations} accepted`} icon={FileText} tone="amber" />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Projects</CardTitle>
                <Button size="xs" variant="ghost" onClick={() => setTab('projects')}>
                  View all <ArrowRight />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {projects.length === 0 && <p className="py-4 text-center text-[13px] text-slate-400">No projects yet.</p>}
                {projects.slice(0, 4).map((p) => {
                  const s = projectSummary(db, p)
                  return (
                    <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center gap-3 rounded-lg border border-slate-200 px-2.5 py-2 hover:border-brand/40 hover:bg-navy-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-800">{p.name}</p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${s.completion}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-bold tabular-nums text-slate-800">{formatINRCompact(p.value)}</p>
                        <StatusBadge status={p.status} />
                      </div>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
                <Button size="xs" variant="ghost" onClick={downloadStatement}>
                  <Download /> Statement
                </Button>
              </CardHeader>
              <CardContent className="p-3">
                <dl className="divide-y divide-slate-100">
                  {[
                    ['Total project value', formatINR(t.totalProjectValue)],
                    ['Quotations accepted', formatINR(t.acceptedValue)],
                    ['Invoiced to date', formatINR(t.totalInvoiced)],
                    ['Payments received', formatINR(t.totalPaid)],
                    ['Site expenses booked', formatINR(t.expenses)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-1.5 text-[13px]">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="font-semibold tabular-nums text-slate-800">{v}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 text-[13.5px]">
                    <dt className="font-bold text-slate-700">Outstanding balance</dt>
                    <dd className={cn('font-bold tabular-nums', t.outstanding > 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {formatINR(t.outstanding)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between pt-2 text-[13.5px]">
                    <dt className="flex items-center gap-1.5 font-bold text-slate-700">
                      <TrendingUp className="h-4 w-4 text-emerald-600" /> Profit on collections
                    </dt>
                    <dd className={cn('font-bold tabular-nums', t.profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {formatINR(t.profit)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- projects */}
        <TabsContent value="projects">
          <div className="mb-2 flex justify-end">
            <Button size="sm" onClick={() => setProjectOpen(true)}>
              <Plus /> Add Project
            </Button>
          </div>
          {projects.length === 0 ? (
            <EmptyState icon={Hammer} title="No projects yet" message="Create a project to track work, invoices and expenses for this client." />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Project</TH>
                    <TH className="hidden md:table-cell">Timeline</TH>
                    <TH className="text-right">Value</TH>
                    <TH className="text-right">Received</TH>
                    <TH className="text-right hidden lg:table-cell">Profit</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {projects.map((p) => {
                    const s = projectSummary(db, p)
                    return (
                      <TR key={p.id} className="cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                        <TD>
                          <span className="block font-semibold text-slate-900">{p.name}</span>
                          <span className="block text-[11.5px] text-slate-400">{p.id}</span>
                        </TD>
                        <TD className="hidden md:table-cell text-[12.5px] text-slate-500">
                          {formatDate(p.startDate)} → {formatDate(p.actualCompletion || p.expectedCompletion)}
                        </TD>
                        <TD className="text-right tabular-nums">{formatINR(p.value)}</TD>
                        <TD className="text-right tabular-nums">{formatINR(s.revenue)}</TD>
                        <TD className={cn('hidden lg:table-cell text-right font-semibold tabular-nums', s.profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {formatINR(s.profit)}
                        </TD>
                        <TD><StatusBadge status={p.status} /></TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </TabsContent>

        {/* -------------------------------------------------------- quotations */}
        <TabsContent value="quotations">
          <div className="mb-2 flex justify-end">
            <Button size="sm" onClick={() => navigate(`/quotations/new?client=${client.id}`)}>
              <Plus /> New Quotation
            </Button>
          </div>
          {quotations.length === 0 ? (
            <EmptyState icon={FileText} title="No quotations yet" message="Send a quotation to get this client started." />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Quotation</TH>
                    <TH className="hidden md:table-cell">Date</TH>
                    <TH className="hidden lg:table-cell">Valid until</TH>
                    <TH className="text-right">Value</TH>
                    <TH>Status</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {quotations.map((q) => (
                    <TR key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}/preview`)}>
                      <TD>
                        <span className="block font-semibold text-slate-900">{q.id}</span>
                        <span className="block max-w-[280px] truncate text-[11.5px] text-slate-400">{q.title}</span>
                      </TD>
                      <TD className="hidden md:table-cell text-[12.5px]">{formatDate(q.date)}</TD>
                      <TD className="hidden lg:table-cell text-[12.5px]">{formatDate(q.validUntil)}</TD>
                      <TD className="text-right font-semibold tabular-nums">{formatINR(quotationTotals(q).grandTotal)}</TD>
                      <TD><StatusBadge status={q.status} /></TD>
                      <TD onClick={(e) => e.stopPropagation()} className="text-right">
                        <Button size="iconSm" variant="ghost" title="Edit" onClick={() => navigate(`/quotations/${q.id}/edit`)}>
                          <Pencil />
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------- invoices */}
        <TabsContent value="invoices">
          <div className="mb-2 flex justify-end">
            <Button size="sm" onClick={() => navigate(`/invoices/new?client=${client.id}`)}>
              <Plus /> New Invoice
            </Button>
          </div>
          {invoices.length === 0 ? (
            <EmptyState icon={ReceiptIndianRupee} title="No invoices yet" message="Raise an invoice from an accepted quotation or from scratch." />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Invoice</TH>
                    <TH className="hidden md:table-cell">Date</TH>
                    <TH className="hidden lg:table-cell">Due</TH>
                    <TH className="text-right">Total</TH>
                    <TH className="text-right">Balance</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {invoices.map((i) => {
                    const bal = invoiceBalance(db, i)
                    return (
                      <TR key={i.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${i.id}/preview`)}>
                        <TD className="font-semibold text-slate-900">{i.id}</TD>
                        <TD className="hidden md:table-cell text-[12.5px]">{formatDate(i.date)}</TD>
                        <TD className="hidden lg:table-cell text-[12.5px]">{formatDate(i.dueDate)}</TD>
                        <TD className="text-right tabular-nums">{formatINR(invoiceTotals(i).grandTotal)}</TD>
                        <TD className={cn('text-right font-semibold tabular-nums', bal > 0 ? 'text-red-600' : 'text-emerald-600')}>
                          {formatINR(bal)}
                        </TD>
                        <TD><StatusBadge status={invoiceDisplayStatus(db, i)} /></TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------ ledger */}
        <TabsContent value="ledger">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-slate-500">
              Running account — invoices raised (debit) against payments received (credit).
            </p>
            <Button size="sm" variant="outline" onClick={downloadStatement}>
              <Download /> Download statement
            </Button>
          </div>
          {ledger.length === 0 ? (
            <EmptyState icon={BookOpen} title="Nothing on the ledger" message="Sent invoices and recorded payments show up here." />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH className="hidden sm:table-cell">Type</TH>
                    <TH>Particulars</TH>
                    <TH className="text-right">Debit</TH>
                    <TH className="text-right">Credit</TH>
                    <TH className="text-right">Balance</TH>
                  </TR>
                </THead>
                <TBody>
                  {ledger.map((r, i) => (
                    <TR key={i}>
                      <TD className="whitespace-nowrap text-[12.5px]">{formatDate(r.date)}</TD>
                      <TD className="hidden sm:table-cell"><StatusBadge status={r.type === 'Invoice' ? 'Sent' : 'Received'} /></TD>
                      <TD>
                        <Link to={r.link} className="font-semibold text-brand hover:underline">{r.ref}</Link>
                        <span className="block max-w-[320px] truncate text-[11.5px] text-slate-400">{r.particulars}</span>
                      </TD>
                      <TD className="text-right tabular-nums">{r.debit ? formatINR(r.debit) : '—'}</TD>
                      <TD className="text-right tabular-nums text-emerald-600">{r.credit ? formatINR(r.credit) : '—'}</TD>
                      <TD className={cn('text-right font-semibold tabular-nums', r.balance > 0 ? 'text-red-600' : 'text-slate-600')}>
                        {formatINR(r.balance)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
                <TFoot>
                  <TR>
                    <TD colSpan={3} className="text-right font-bold text-slate-700">Closing balance</TD>
                    <TD className="text-right tabular-nums">{formatINR(t.totalInvoiced)}</TD>
                    <TD className="text-right tabular-nums text-emerald-600">{formatINR(t.totalPaid)}</TD>
                    <TD className={cn('text-right font-bold tabular-nums', t.outstanding > 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {formatINR(t.outstanding)}
                    </TD>
                  </TR>
                </TFoot>
              </Table>
            </TableWrap>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------- payments */}
        <TabsContent value="payments">
          <div className="mb-2 flex justify-end">
            <Button size="sm" onClick={() => setPaymentOpen(true)}>
              <Plus /> Record Payment
            </Button>
          </div>
          {payments.length === 0 ? (
            <EmptyState icon={Wallet} title="No payments yet" message="Record a payment to update the ledger and invoice balances." />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Method</TH>
                    <TH className="hidden md:table-cell">Reference</TH>
                    <TH className="hidden lg:table-cell">Against</TH>
                    <TH className="hidden xl:table-cell">Notes</TH>
                  </TR>
                </THead>
                <TBody>
                  {payments.map((p) => (
                    <TR key={p.id}>
                      <TD className="whitespace-nowrap text-[12.5px]">{formatDate(p.date)}</TD>
                      <TD className="text-right font-semibold tabular-nums text-emerald-600">{formatINR(p.amount)}</TD>
                      <TD className="text-[12.5px]">{p.method}</TD>
                      <TD className="hidden md:table-cell text-[12px] text-slate-500">{p.reference || '—'}</TD>
                      <TD className="hidden lg:table-cell text-[12.5px]">
                        {p.invoiceId ? (
                          <Link to={`/invoices/${p.invoiceId}/preview`} className="text-brand hover:underline">{p.invoiceId}</Link>
                        ) : '—'}
                      </TD>
                      <TD className="hidden xl:table-cell max-w-[220px] truncate text-[12px] text-slate-500">{p.notes || '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </TabsContent>
      </Tabs>

      <ClientDialog open={editOpen} client={client} onOpenChange={setEditOpen} />
      <ProjectDialog open={projectOpen} onOpenChange={setProjectOpen} defaultClientId={client.id} />
      <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} defaults={{ clientId: client.id }} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${client.company || client.name}?`}
        description="This also removes their projects, quotations, invoices and payments."
        onConfirm={() => {
          deleteClient(client.id)
          navigate('/clients')
        }}
      />
    </div>
  )
}
