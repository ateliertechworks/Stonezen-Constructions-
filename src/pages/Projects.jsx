import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Hammer, Plus, Search, Pencil, Trash2, MapPin, User, Calendar } from 'lucide-react'

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
import { cn } from '../lib/utils'

export default function Projects() {
  const db = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')
  const [dialog, setDialog] = useState({ open: false, project: null })
  const [confirm, setConfirm] = useState(null)

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
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ project: p, client, summary: s }) => {
            const due = p.status === 'Completed' ? null : daysUntil(p.expectedCompletion)
            return (
              <div key={p.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-card transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/projects/${p.id}`} className="block truncate text-[14px] font-bold text-slate-900 hover:text-brand">
                      {p.name}
                    </Link>
                    {client && (
                      <Link to={`/clients/${client.id}`} className="block truncate text-[12px] text-slate-500 hover:text-brand">
                        {client.company || client.name}
                      </Link>
                    )}
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="mt-2.5 space-y-1 text-[12px] text-slate-500">
                  <p className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="line-clamp-1">{p.siteAddress || '—'}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {formatDate(p.startDate)} → {formatDate(p.actualCompletion || p.expectedCompletion)}
                    {due !== null && due < 0 && <span className="font-semibold text-red-600">({Math.abs(due)}d late)</span>}
                    {due !== null && due >= 0 && due <= 14 && <span className="font-semibold text-amber-600">({due}d left)</span>}
                  </p>
                  {p.manager && (
                    <p className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {p.manager}
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-[11.5px]">
                    <span className="text-slate-500">Collected {formatINRCompact(s.revenue)}</span>
                    <span className="font-bold tabular-nums text-slate-800">{formatINR(p.value)}</span>
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
                    <div key={label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                      <p className={cn('text-[13px] font-bold tabular-nums', tone)}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-2.5 flex gap-1.5">
                  <Button size="xs" variant="outline" asChild className="flex-1">
                    <Link to={`/projects/${p.id}`}>Open</Link>
                  </Button>
                  <Button size="iconSm" variant="ghost" title="Edit" onClick={() => setDialog({ open: true, project: p })}>
                    <Pencil />
                  </Button>
                  <Button size="iconSm" variant="ghost" title="Delete" className="text-red-500 hover:bg-red-50" onClick={() => setConfirm(p)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
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
