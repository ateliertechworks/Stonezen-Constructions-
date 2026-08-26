import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingDown, Plus, Search, Pencil, Trash2, Package, Users, CalendarDays } from 'lucide-react'

import { useStore } from '../lib/useStore'
import { deleteExpense } from '../lib/store'
import { formatINR, formatINRCompact, formatDate, monthKey } from '../lib/format'
import { EXPENSE_CATEGORIES } from '../lib/seed'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import { Badge } from '../components/ui/badge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ExpenseDialog from '../components/forms/ExpenseDialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { SimpleSelect } from '../components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { TableWrap, Table, THead, TBody, TR, TH, TD, TFoot } from '../components/ui/table'

const CATEGORY_TONE = {
  Material: 'blue', Labour: 'amber', Transport: 'purple', 'Equipment Rental': 'slate',
  'Sub-contractor': 'red', 'Site Utilities': 'green', 'Permits & Approvals': 'brand',
  Fuel: 'amber', Miscellaneous: 'slate',
}

export default function Expenses() {
  const db = useStore()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('All')
  const [project, setProject] = useState('All')
  const [dialog, setDialog] = useState({ open: false, expense: null })
  const [confirm, setConfirm] = useState(null)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.expenses
      .filter((e) => category === 'All' || e.category === category)
      .filter((e) => project === 'All' || e.projectId === project)
      .filter((e) => !term || [e.description, e.vendor, e.notes].some((v) => String(v || '').toLowerCase().includes(term)))
      .map((e) => ({ expense: e, project: db.projects.find((p) => p.id === e.projectId) }))
      .sort((a, b) => (a.expense.date < b.expense.date ? 1 : -1))
  }, [db, q, category, project])

  const stats = useMemo(() => {
    const total = db.expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const thisMonth = db.expenses
      .filter((e) => monthKey(e.date) === monthKey(new Date().toISOString()))
      .reduce((s, e) => s + Number(e.amount || 0), 0)
    const byCategory = Object.entries(
      db.expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0)
        return acc
      }, {}),
    ).sort((a, b) => b[1] - a[1])
    return { total, thisMonth, byCategory, vendors: new Set(db.expenses.map((e) => e.vendor).filter(Boolean)).size }
  }, [db])

  const filteredTotal = rows.reduce((s, r) => s + Number(r.expense.amount || 0), 0)

  return (
    <div>
      <PageHeader
        icon={TrendingDown}
        title="Expenses"
        subtitle={`${db.expenses.length} entries · ${formatINR(stats.total)} booked`}
        actions={
          <Button size="sm" onClick={() => setDialog({ open: true, expense: null })}>
            <Plus /> Record Expense
          </Button>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard label="Total Expenses" value={formatINRCompact(stats.total)} icon={TrendingDown} tone="amber" />
        <StatCard label="This Month" value={formatINRCompact(stats.thisMonth)} icon={CalendarDays} tone="brand" />
        <StatCard label="Top Category" value={stats.byCategory[0]?.[0] || '—'} sub={stats.byCategory[0] ? formatINRCompact(stats.byCategory[0][1]) : ''} icon={Package} tone="blue" />
        <StatCard label="Vendors" value={stats.vendors} icon={Users} tone="purple" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description or vendor…" className="pl-9" />
            </div>
            <SimpleSelect value={category} onValueChange={setCategory} options={['All', ...EXPENSE_CATEGORIES]} className="w-[170px]" />
            <SimpleSelect
              value={project}
              onValueChange={setProject}
              options={[{ value: 'All', label: 'All projects' }, ...db.projects.map((p) => ({ value: p.id, label: p.name }))]}
              className="w-[190px]"
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title={db.expenses.length ? 'No expenses match your filters' : 'No expenses recorded'}
              message={db.expenses.length ? 'Try a different filter.' : 'Book site expenses to see true project profit.'}
              action={
                <Button onClick={() => setDialog({ open: true, expense: null })}>
                  <Plus /> Record Expense
                </Button>
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Description</TH>
                    <TH className="hidden lg:table-cell">Project</TH>
                    <TH>Category</TH>
                    <TH className="hidden md:table-cell">Vendor</TH>
                    <TH className="hidden xl:table-cell">Paid by</TH>
                    <TH className="text-right">Amount</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {rows.map(({ expense: e, project: p }) => (
                    <TR key={e.id}>
                      <TD className="whitespace-nowrap text-[12.5px]">{formatDate(e.date)}</TD>
                      <TD>
                        <span className="block max-w-[260px] truncate font-medium text-slate-800">{e.description}</span>
                        {e.notes && <span className="block max-w-[260px] truncate text-[11.5px] text-slate-400">{e.notes}</span>}
                      </TD>
                      <TD className="hidden lg:table-cell text-[12.5px]">
                        {p ? <Link to={`/projects/${p.id}`} className="text-brand hover:underline">{p.name}</Link> : <span className="text-slate-400">General</span>}
                      </TD>
                      <TD><Badge tone={CATEGORY_TONE[e.category] || 'slate'}>{e.category}</Badge></TD>
                      <TD className="hidden md:table-cell text-[12.5px] text-slate-500">{e.vendor || '—'}</TD>
                      <TD className="hidden xl:table-cell text-[12.5px] text-slate-500">{e.paymentMethod}</TD>
                      <TD className="text-right font-bold tabular-nums text-amber-700">{formatINR(e.amount)}</TD>
                      <TD>
                        <div className="flex justify-end gap-0.5">
                          <Button size="iconSm" variant="ghost" title="Edit" onClick={() => setDialog({ open: true, expense: e })}>
                            <Pencil />
                          </Button>
                          <Button size="iconSm" variant="ghost" title="Delete" className="text-red-500 hover:bg-red-50" onClick={() => setConfirm(e)}>
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
                      {rows.length === db.expenses.length ? 'Total expenses' : `Filtered total (${rows.length} of ${db.expenses.length})`}
                    </TD>
                    <TD className="text-right font-bold tabular-nums text-amber-700">{formatINR(filteredTotal)}</TD>
                    <TD />
                  </TR>
                </TFoot>
              </Table>
            </TableWrap>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle>By category</CardTitle></CardHeader>
          <CardContent className="space-y-2 p-3">
            {stats.byCategory.length === 0 && <p className="py-4 text-center text-[13px] text-slate-400">No expenses yet.</p>}
            {stats.byCategory.map(([name, value]) => (
              <button key={name} onClick={() => setCategory(name)} className="block w-full rounded-lg py-1 text-left transition-colors hover:bg-slate-50">
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="text-slate-600">{name}</span>
                  <span className="font-bold tabular-nums text-slate-800">{formatINRCompact(value)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${(value / stats.total) * 100}%` }} />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <ExpenseDialog
        open={dialog.open}
        expense={dialog.expense}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this expense?"
        description={confirm ? `${confirm.description} — ${formatINR(confirm.amount)}` : ''}
        onConfirm={() => deleteExpense(confirm.id)}
      />
    </div>
  )
}
