import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users, Plus, Search, LayoutGrid, List, Phone, Mail, MapPin,
  MessageCircle, Pencil, Trash2,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { clientTotals } from '../lib/calc'
import { formatINRCompact, formatDate, initials } from '../lib/format'
import { deleteClient, clientDeletionBlockers } from '../lib/store'
import { whatsappLink, mailtoLink, telLink, openLink } from '../lib/comms'
import { CLIENT_STATUSES } from '../lib/seed'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatusBadge from '../components/ui/StatusBadge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ClientDialog from '../components/forms/ClientDialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { SimpleSelect } from '../components/ui/select'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../components/ui/table'
import { cn } from '../lib/utils'

export default function Clients() {
  const db = useStore()
  const navigate = useNavigate()
  const [view, setView] = useState('grid')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')
  const [dialog, setDialog] = useState({ open: false, client: null })
  const [confirm, setConfirm] = useState(null)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.clients
      .filter((c) => status === 'All' || c.status === status)
      .filter(
        (c) =>
          !term ||
          [c.name, c.company, c.phone, c.email, c.city, c.gstin].some((v) => String(v || '').toLowerCase().includes(term)),
      )
      .map((c) => ({ client: c, totals: clientTotals(db, c) }))
  }, [db, q, status])

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Clients"
        subtitle={`${db.clients.length} client${db.clients.length === 1 ? '' : 's'} · ${db.clients.filter((c) => c.status === 'Active').length} active`}
        actions={
          <Button size="sm" onClick={() => setDialog({ open: true, client: null })}>
            <Plus /> Add Client
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full flex-1 basis-full sm:min-w-[200px] sm:basis-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, company, phone or GSTIN…" className="pl-9" />
        </div>
        <SimpleSelect value={status} onValueChange={setStatus} options={['All', ...CLIENT_STATUSES]} className="min-w-0 flex-1 sm:w-[140px] sm:flex-none" />
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {[
            ['grid', LayoutGrid],
            ['table', List],
          ].map(([mode, Icon]) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={cn('flex h-9 w-9 items-center justify-center', view === mode ? 'bg-brand text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}
              title={`${mode} view`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={db.clients.length ? 'No clients match your filters' : 'No clients yet'}
          message={db.clients.length ? 'Try a different search term or status.' : 'Add your first client to start raising quotations.'}
          action={
            !db.clients.length && (
              <Button onClick={() => setDialog({ open: true, client: null })}>
                <Plus /> Add Client
              </Button>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ client: c, totals: t }) => (
            <div key={c.id} className="group flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-card transition-shadow hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-[13px] font-bold text-brand">
                  {initials(c.company || c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={`/clients/${c.id}`} className="block truncate text-[14px] font-bold text-slate-900 hover:text-brand">
                    {c.company || c.name}
                  </Link>
                  <p className="truncate text-[12px] text-slate-500">{c.contactPerson || c.name}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <div className="mt-3 space-y-1 text-[12px] text-slate-500">
                {c.phone && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {c.phone}
                  </p>
                )}
                {c.email && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {c.email}
                  </p>
                )}
                <p className="flex items-center gap-1.5 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {c.city || '—'}
                  {c.gstin && ` · GST ${c.gstin.slice(0, 6)}…`}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-2 py-2 text-center">
                {[
                  ['Projects', t.counts.projects],
                  ['Invoiced', formatINRCompact(t.totalInvoiced)],
                  ['Due', formatINRCompact(t.outstanding)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className={cn('text-[13px] font-bold tabular-nums', label === 'Due' && t.outstanding > 0 ? 'text-red-600' : 'text-slate-800')}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                <Button size="xs" variant="outline" asChild className="flex-1">
                  <Link to={`/clients/${c.id}`}>Open profile</Link>
                </Button>
                <Button size="iconSm" variant="ghost" className="shrink-0" title="WhatsApp" disabled={!c.whatsapp && !c.phone}
                  onClick={() => openLink(whatsappLink(c.whatsapp || c.phone, `Hello ${c.contactPerson || c.name},`))}>
                  <MessageCircle className="text-[#25D366]" />
                </Button>
                <Button size="iconSm" variant="ghost" className="shrink-0" title="Email" disabled={!c.email}
                  onClick={() => openLink(mailtoLink(c.email, `Regarding your project`, ''))}>
                  <Mail />
                </Button>
                <Button size="iconSm" variant="ghost" className="shrink-0" title="Edit" onClick={() => setDialog({ open: true, client: c })}>
                  <Pencil />
                </Button>
                <Button size="iconSm" variant="ghost" className="shrink-0 text-red-500 hover:bg-red-50" title="Delete"
                  onClick={() => setConfirm(c)}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Client</TH>
                <TH className="hidden md:table-cell">Contact</TH>
                <TH className="hidden lg:table-cell">City</TH>
                <TH className="text-center">Projects</TH>
                <TH className="text-right">Invoiced</TH>
                <TH className="text-right">Outstanding</TH>
                <TH>Status</TH>
                <TH className="hidden xl:table-cell">Since</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {rows.map(({ client: c, totals: t }) => (
                <TR key={c.id} className="cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-[11px] font-bold text-brand">
                        {initials(c.company || c.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">{c.company || c.name}</span>
                        <span className="block truncate text-[11.5px] text-slate-400">{c.contactPerson || c.name}</span>
                      </span>
                    </div>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <span className="block text-[12.5px]">{c.phone || '—'}</span>
                    <span className="block truncate text-[11.5px] text-slate-400">{c.email || '—'}</span>
                  </TD>
                  <TD className="hidden lg:table-cell">{c.city || '—'}</TD>
                  <TD className="text-center tabular-nums">{t.counts.projects}</TD>
                  <TD className="text-right tabular-nums">{formatINRCompact(t.totalInvoiced)}</TD>
                  <TD className={cn('text-right font-semibold tabular-nums', t.outstanding > 0 ? 'text-red-600' : 'text-slate-500')}>
                    {formatINRCompact(t.outstanding)}
                  </TD>
                  <TD><StatusBadge status={c.status} /></TD>
                  <TD className="hidden xl:table-cell text-[12px] text-slate-400">{formatDate(c.createdDate)}</TD>
                  <TD onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button size="iconSm" variant="ghost" title="Call" disabled={!c.phone} onClick={() => openLink(telLink(c.phone))}>
                        <Phone />
                      </Button>
                      <Button size="iconSm" variant="ghost" title="Edit" onClick={() => setDialog({ open: true, client: c })}>
                        <Pencil />
                      </Button>
                      <Button size="iconSm" variant="ghost" title="Delete" className="text-red-500 hover:bg-red-50" onClick={() => setConfirm(c)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      <ClientDialog
        open={dialog.open}
        client={dialog.client}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSaved={(c) => !dialog.client && navigate(`/clients/${c.id}`)}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm && clientDeletionBlockers(confirm.id).length
            ? `Archive ${confirm?.company || confirm?.name}?`
            : `Delete ${confirm?.company || confirm?.name}?`
        }
        description={
          confirm && clientDeletionBlockers(confirm.id).length
            ? `This client has ${clientDeletionBlockers(confirm.id).join(' and ')}, so their financial records are kept. They will be archived and hidden from the active list instead of deleted.`
            : 'This client has no invoices or payments. Their quotations and projects will be kept and unlinked.'
        }
        onConfirm={() => deleteClient(confirm.id)}
      />
    </div>
  )
}
