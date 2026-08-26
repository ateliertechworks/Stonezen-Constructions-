import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FolderOpen, Download, Eye, Search, FileText, ReceiptIndianRupee, Pencil } from 'lucide-react'

import { useStore } from '../lib/useStore'
import { quotationTotals, invoiceTotals, invoicePaid, invoiceBalance, invoiceDisplayStatus } from '../lib/calc'
import { formatINR, formatDate } from '../lib/format'
import { downloadQuotation, downloadInvoice } from '../lib/pdf'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatusBadge from '../components/ui/StatusBadge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { SimpleSelect } from '../components/ui/select'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../components/ui/table'

export default function Documents() {
  const db = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('All')

  const docs = useMemo(() => {
    const quotes = db.quotations.map((x) => ({
      kind: 'Quotation', id: x.id, date: x.date, title: x.title,
      clientId: x.clientId, projectId: x.projectId,
      total: quotationTotals(x).grandTotal, status: x.status, raw: x,
    }))
    const invs = db.invoices.map((x) => ({
      kind: 'Invoice', id: x.id, date: x.date, title: x.notes || `Invoice for ${x.projectId || 'work done'}`,
      clientId: x.clientId, projectId: x.projectId,
      total: invoiceTotals(x).grandTotal, status: invoiceDisplayStatus(db, x), raw: x,
    }))
    const term = q.trim().toLowerCase()
    return [...quotes, ...invs]
      .filter((d) => kind === 'All' || d.kind === kind)
      .filter((d) => {
        if (!term) return true
        const client = db.clients.find((c) => c.id === d.clientId)
        return [d.id, d.title, client?.name, client?.company].some((v) => String(v || '').toLowerCase().includes(term))
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [db, q, kind])

  const downloadDoc = (d) => {
    const client = db.clients.find((c) => c.id === d.clientId)
    const project = db.projects.find((p) => p.id === d.projectId)
    if (d.kind === 'Quotation') {
      return downloadQuotation(d.raw, client, project, db.settings, quotationTotals(d.raw))
    }
    const totals = invoiceTotals(d.raw)
    return downloadInvoice(
      d.raw, client, project, db.settings, totals,
      invoicePaid(db, d.raw), invoiceBalance(db, d.raw), d.status,
    )
  }

  return (
    <div>
      <PageHeader
        icon={FolderOpen}
        title="Documents"
        subtitle={`${db.quotations.length} quotations · ${db.invoices.length} invoices`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => navigate('/quotations/new')}>
              <FileText /> Quotation
            </Button>
            <Button size="sm" onClick={() => navigate('/invoices/new')}>
              <ReceiptIndianRupee /> Invoice
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all documents…" className="pl-9" />
        </div>
        <SimpleSelect value={kind} onValueChange={setKind} options={['All', 'Quotation', 'Invoice']} className="w-[150px]" />
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents yet"
          message="Quotations and invoices you create appear here, ready to download as PDF."
        />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Document</TH>
                <TH className="hidden md:table-cell">Client</TH>
                <TH className="hidden lg:table-cell">Date</TH>
                <TH className="text-right">Value</TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {docs.map((d) => {
                const client = db.clients.find((c) => c.id === d.clientId)
                const previewPath = d.kind === 'Quotation' ? `/quotations/${d.id}/preview` : `/invoices/${d.id}/preview`
                const editPath = d.kind === 'Quotation' ? `/quotations/${d.id}/edit` : `/invoices/${d.id}/edit`
                const Icon = d.kind === 'Quotation' ? FileText : ReceiptIndianRupee
                return (
                  <TR key={`${d.kind}-${d.id}`} className="cursor-pointer" onClick={() => navigate(previewPath)}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-brand">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-900">{d.id}</span>
                          <span className="block max-w-[280px] truncate text-[11.5px] text-slate-400">{d.title}</span>
                        </span>
                      </div>
                    </TD>
                    <TD className="hidden md:table-cell">
                      {client ? (
                        <Link to={`/clients/${client.id}`} className="text-[13px] text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
                          {client.company || client.name}
                        </Link>
                      ) : '—'}
                    </TD>
                    <TD className="hidden lg:table-cell whitespace-nowrap text-[12.5px]">{formatDate(d.date)}</TD>
                    <TD className="text-right font-bold tabular-nums">{formatINR(d.total)}</TD>
                    <TD><StatusBadge status={d.status} /></TD>
                    <TD onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-0.5">
                        <Button size="iconSm" variant="ghost" title="Preview" onClick={() => navigate(previewPath)}>
                          <Eye />
                        </Button>
                        <Button size="iconSm" variant="ghost" title="Edit" onClick={() => navigate(editPath)}>
                          <Pencil />
                        </Button>
                        <Button size="iconSm" variant="ghost" title="Download PDF" onClick={() => downloadDoc(d)}>
                          <Download />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  )
}
