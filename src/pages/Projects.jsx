import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Hammer, Plus, Search, Pencil, Trash2, User, Calendar, LayoutGrid, List } from 'lucide-react'

import { useStore } from '../lib/useStore'
import { projectSummary } from '../lib/calc'
import { formatINR, formatINRCompact, formatDate, daysUntil } from '../lib/format'
import { deleteProject } from '../lib/store'
import { PROJECT_STATUSES } from '../lib/seed'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ProjectDialog from '../components/forms/ProjectDialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { SimpleSelect } from '../components/ui/select'
import { TableWrap, Table, THead, TBody, TR, TH, TD } from '../components/ui/table'
import { cn } from '../lib/utils'

/** Remembers the chosen layout between visits; first-time users get the card grid. */
const VIEW_KEY = 'stonezen_projects_view_v1'

const readView = () => {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'grid' || v === 'list' ? v : 'grid'
  } catch {
    return 'grid'
  }
}

export default function Projects() {
  const db = useStore()
  const navigate = useNavigate()
  const [view, setView] = useState(readView)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')
  const [dialog, setDialog] = useState({ open: false, project: null })
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch { /* private mode — the view just won't persist */ }
  }, [view])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.projects
      .filter((p) => status === 'All' || p.status === status)
      .filter((p) => {
        if (!term) return true
        const client = db.clients.find((c) => c.id === p.clientId)
        return [p.name, p.siteAddress, p.manager, client?.name, client?.company].some((v) =>
          String(v || '').toLowerCase().includes(term),
        )
      })
      .map((p) => ({ project: p, client: db.clients.find((c) => c.id === p.clientId), summary: projectSummary(db, p) }))
  }, [db, q, status])

  const totals = useMemo(() => {
    const value = db.projects.reduce((s, p) => s + Number(p.value || 0), 0)
    const revenue = db.projects.reduce((s, p) => s + projectSummary(db, p).revenue, 0)
    const expenses = db.projects.reduce((s, p) => s + projectSummary(db, p).expenses, 0)
    return { value, revenue, expenses, profit: revenue - expenses }
  }, [db])

  return (
    <div>
      <PageHeader
        icon={Hammer}
        title="Projects"
        subtitle={`${db.projects.length} projects · ${db.projects.filter((p) => p.status === 'In Progress').length} in progress`}
        actions={
          <Button size="sm" onClick={() => setDialog({ open: true, project: null })}>
            <Plus /> Add Project
          </Button>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard label="Contracted Value" value={formatINRCompact(totals.value)} icon={Hammer} tone="brand" />
        <StatCard label="Collected" value={formatINRCompact(totals.revenue)} tone="green" />
        <StatCard label="Site Expenses" value={formatINRCompact(totals.expenses)} tone="amber" />
        <StatCard label="Profit" value={formatINRCompact(totals.profit)} tone={totals.profit >= 0 ? 'blue' : 'red'} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, sites or clients…" className="pl-9" />
        </div>
        <SimpleSelect value={status} onValueChange={setStatus} options={['All', ...PROJECT_STATUSES]} className="w-[150px]" />
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {[
            ['grid', LayoutGrid],
            ['list', List],
          ].map(([mode, Icon]) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={cn(
                'flex h-9 w-9 items-center justify-center transition-colors',
                view === mode ? 'bg-brand text-white' : 'bg-white text-slate-500 hover:bg-slate-50',
              )}
              title={`${mode} view`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Hammer}
          title={db.projects.length ? 'No projects match your filters' : 'No projects yet'}
          message={db.projects.length ? 'Try a different search term or status.' : 'Add a project to start tracking work on site.'}
          action={
            !db.projects.length && (
              <Button onClick={() => setDialog({ open: true, project: null })}>
                <Plus /> Add Project
              </Button>
            )
          }
        />
      ) : view === 'grid' ? (
        /* grid-cols-1 is explicit so the mobile track is minmax(0,1fr) and can
           shrink below the card's min-content width instead of overflowing. */
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ project: p, client, summary: s }) => {
            const due = p.status === 'Completed' ? null : daysUntil(p.expectedCompletion)
            return (
              <div key={p.id} className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-card transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link to={`/projects/${p.id}`} className="block truncate text-[14px] font-bold text-slate-900 hover:text-brand">
                      {p.name}
                    </Link>
                    {client && (
                      <Link to={`/clients/${client.id}`} className="block truncate text-[12px] text-slate-500 hover:text-brand">
                        {client.company || client.name}
                      </Link>
                    )}
                  </div>
                  <StatusBadge status={p.status} className="shrink-0" />
                </div>

                <div className="mt-2.5 space-y-1 text-[12px] text-slate-500">
                  <p className="flex min-w-0 items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 truncate">
                      {formatDate(p.startDate)} → {formatDate(p.actualCompletion || p.expectedCompletion)}
                    </span>
                    {due !== null && due < 0 && <span className="shrink-0 font-semibold text-red-600">({Math.abs(due)}d late)</span>}
                    {due !== null && due >= 0 && due <= 14 && <span className="shrink-0 font-semibold text-amber-600">({due}d left)</span>}
                  </p>
                  {p.manager && (
                    <p className="flex min-w-0 items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="min-w-0 truncate">{p.manager}</span>
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                    <span className="min-w-0 truncate text-slate-500">Collected {formatINRCompact(s.revenue)}</span>
                    <span className="shrink-0 font-bold tabular-nums text-slate-800">{formatINR(p.value)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${s.completion}%` }} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-center">
                  {[
                    ['Invoiced', formatINRCompact(s.invoiced), 'text-slate-800'],
                    ['Expenses', formatINRCompact(s.expenses), 'text-amber-600'],
                    ['Profit', formatINRCompact(s.profit), s.profit >= 0 ? 'text-emerald-600' : 'text-red-600'],
                  ].map(([label, value, tone]) => (
                    <div key={label} className="min-w-0">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                      <p className={cn('truncate text-[13px] font-bold tabular-nums', tone)}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Button size="xs" variant="outline" asChild className="min-w-0 flex-1">
                    <Link to={`/projects/${p.id}`}>Open</Link>
                  </Button>
                  <Button size="iconSm" variant="ghost" className="shrink-0" title="Edit" onClick={() => setDialog({ open: true, project: p })}>
                    <Pencil />
                  </Button>
                  <Button size="iconSm" variant="ghost" className="shrink-0 text-red-500 hover:bg-red-50" title="Delete" onClick={() => setConfirm(p)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List view — columns drop away on narrow screens so the row never forces
           the page to scroll; TableWrap keeps any residual scroll inside itself. */
        <TableWrap>
          <Table className="[&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3 sm:[&_th]:px-3">
            <THead>
              <TR>
                <TH>Project</TH>
                <TH>Status</TH>
                <TH className="text-right">Value</TH>
                <TH className="hidden md:table-cell text-right">Collected</TH>
                <TH className="hidden xl:table-cell text-right">Profit</TH>
                <TH className="hidden 2xl:table-cell">Timeline</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {rows.map(({ project: p, client, summary: s }) => (
                <TR key={p.id} className="cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                  <TD>
                    <span className="block max-w-[100px] truncate font-semibold text-slate-900 sm:max-w-[200px] lg:max-w-[240px] 2xl:max-w-[320px]">{p.name}</span>
                    <span className="block max-w-[100px] truncate text-[11.5px] text-slate-400 sm:max-w-[200px] lg:max-w-[240px] 2xl:max-w-[320px]">
                      {client ? client.company || client.name : '—'}
                    </span>
                  </TD>
                  <TD><StatusBadge status={p.status} /></TD>
                  <TD className="text-right font-semibold tabular-nums">{formatINRCompact(p.value)}</TD>
                  <TD className="hidden md:table-cell text-right tabular-nums text-emerald-600">{formatINRCompact(s.revenue)}</TD>
                  <TD className={cn('hidden xl:table-cell text-right font-semibold tabular-nums', s.profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {formatINRCompact(s.profit)}
                  </TD>
                  <TD className="hidden 2xl:table-cell text-[12px] leading-snug text-slate-500">
                    {formatDate(p.startDate)} → {formatDate(p.actualCompletion || p.expectedCompletion)}
                  </TD>
                  <TD onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-0.5">
                      <Button size="xs" variant="outline" asChild className="hidden sm:inline-flex">
                        <Link to={`/projects/${p.id}`}>Open</Link>
                      </Button>
                      <Button size="iconSm" variant="ghost" title="Edit" onClick={() => setDialog({ open: true, project: p })}>
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
          </Table>
        </TableWrap>
      )}

      <ProjectDialog
        open={dialog.open}
        project={dialog.project}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSaved={(p) => !dialog.project && navigate(`/projects/${p.id}`)}
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${confirm?.name}?`}
        description="Expenses booked against this project are removed too. Quotations and invoices are kept but unlinked."
        onConfirm={() => deleteProject(confirm.id)}
      />
    </div>
  )
}
