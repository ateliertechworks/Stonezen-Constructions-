import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Pencil, Trash2, Plus, FileText, ReceiptIndianRupee, Wallet,
  TrendingDown, MapPin, User, IndianRupee, TrendingUp, CalendarDays,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { projectSummary, quotationTotals, invoiceTotals, invoiceBalance, invoiceDisplayStatus } from '../lib/calc'
import { formatINR, formatDate, daysUntil } from '../lib/format'
import { deleteProject, deleteExpense } from '../lib/store'
import { deleteProjectPhotos } from '../lib/photos'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ProjectPhotos from '../components/projects/ProjectPhotos'
import ProjectDialog from '../components/forms/ProjectDialog'
import ExpenseDialog from '../components/forms/ExpenseDialog'
import PaymentDialog from '../components/forms/PaymentDialog'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { TableWrap, Table, THead, TBody, TR, TH, TD, TFoot } from '../components/ui/table'

export default function ProjectDetail() {
  const { id } = useParams()
  const db = useStore()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [expenseConfirm, setExpenseConfirm] = useState(null)

  const project = db.projects.find((p) => p.id === id)
  const s = useMemo(() => (project ? projectSummary(db, project) : null), [db, project])

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        message="This project may have been deleted."
        action={<Button asChild><Link to="/projects">Back to projects</Link></Button>}
      />
    )
  }

  const client = db.clients.find((c) => c.id === project.clientId)
  const quotations = db.quotations.filter((q) => q.projectId === project.id)
  const invoices = db.invoices.filter((i) => i.projectId === project.id)
  const payments = db.payments.filter((p) => p.projectId === project.id)
  const expenses = db.expenses.filter((e) => e.projectId === project.id)

  const due = project.status === 'Completed' ? null : daysUntil(project.expectedCompletion)

  return (
    <div>
      <PageHeader
        backTo="/projects"
        backLabel="All projects"
        title={project.name}
        subtitle={
          <>
            {project.id} ·{' '}
            {client ? (
              <Link to={`/clients/${client.id}`} className="link-brand">
                {client.company || client.name}
              </Link>
            ) : (
              'No client'
            )}
          </>
        }
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExpenseOpen(true)}>
              <TrendingDown /> Expense
            </Button>
            <Button size="sm" onClick={() => setPaymentOpen(true)}>
              <Wallet /> Payment
            </Button>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[200px] space-y-1 text-[12.5px] text-slate-600">
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {project.siteAddress || '—'}
                </p>
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                  {formatDate(project.startDate)} → {formatDate(project.actualCompletion || project.expectedCompletion)}
                  {due !== null && due < 0 && <span className="font-semibold text-red-600">· {Math.abs(due)} days late</span>}
                  {due !== null && due >= 0 && <span className="text-slate-400">· {due} days remaining</span>}
                </p>
                {project.manager && (
                  <p className="flex items-center gap-1.5">
                    <User className="h-4 w-4 shrink-0 text-slate-400" />
                    Site in-charge: {project.manager}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={project.status} />
                <Button size="iconSm" variant="outline" className="text-red-500" title="Delete project" onClick={() => setConfirm(true)}>
                  <Trash2 />
                </Button>
              </div>
            </div>

            {project.notes && (
              <p className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">{project.notes}</p>
            )}

            <div className="mt-3">
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-slate-500">
                  Collected <span className="font-bold text-slate-800">{formatINR(s.revenue)}</span> of {formatINR(project.value)}
                </span>
                <span className="font-bold tabular-nums text-brand">{s.completion.toFixed(0)}%</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${s.completion}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2.5">
          <StatCard label="Invoiced" value={formatINR(s.invoiced)} icon={ReceiptIndianRupee} tone="brand" />
          <StatCard label="Received" value={formatINR(s.revenue)} icon={IndianRupee} tone="green" />
          <StatCard label="Expenses" value={formatINR(s.expenses)} icon={TrendingDown} tone="amber" />
          <StatCard
            label="Profit" value={formatINR(s.profit)} sub={`${s.margin.toFixed(1)}% margin`}
            icon={TrendingUp} tone={s.profit >= 0 ? 'blue' : 'red'}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Quotations &amp; Invoices</CardTitle>
            <div className="flex gap-1.5">
              <Button size="xs" variant="ghost" onClick={() => navigate(`/quotations/new?client=${project.clientId}&project=${project.id}`)}>
                <FileText /> Quote
              </Button>
              <Button size="xs" variant="ghost" onClick={() => navigate(`/invoices/new?client=${project.clientId}&project=${project.id}`)}>
                <ReceiptIndianRupee /> Invoice
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5 p-3">
            {quotations.length === 0 && invoices.length === 0 && (
              <p className="py-5 text-center text-[13px] text-slate-400">No documents linked to this project yet.</p>
            )}
            {quotations.map((q) => (
              <Link key={q.id} to={`/quotations/${q.id}/preview`} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-2.5 py-2 hover:border-brand/40 hover:bg-navy-50">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-slate-800">{q.id}</span>
                  <span className="block truncate text-[11.5px] text-slate-400">{q.title}</span>
                </span>
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-slate-800">{formatINR(quotationTotals(q).grandTotal)}</span>
                <StatusBadge className="shrink-0" status={q.status} />
              </Link>
            ))}
            {invoices.map((i) => (
              <Link key={i.id} to={`/invoices/${i.id}/preview`} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-2.5 py-2 hover:border-brand/40 hover:bg-navy-50">
                <ReceiptIndianRupee className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-slate-800">{i.id}</span>
                  <span className="block text-[11.5px] text-slate-400">
                    Balance {formatINR(invoiceBalance(db, i))} · due {formatDate(i.dueDate)}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-slate-800">{formatINR(invoiceTotals(i).grandTotal)}</span>
                <StatusBadge className="shrink-0" status={invoiceDisplayStatus(db, i)} />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Payments Received</CardTitle>
            <Button size="xs" variant="ghost" onClick={() => setPaymentOpen(true)}>
              <Plus /> Add
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-slate-400">No payments recorded yet.</p>
            ) : (
              <TableWrap className="rounded-none border-0 shadow-none">
                <Table>
                  <THead>
                    <TR>
                      <TH>Date</TH>
                      <TH>Method</TH>
                      <TH className="hidden sm:table-cell">Notes</TH>
                      <TH className="text-right">Amount</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {payments.map((p) => (
                      <TR key={p.id}>
                        <TD className="whitespace-nowrap text-[12.5px]">{formatDate(p.date)}</TD>
                        <TD className="text-[12.5px]">{p.method}</TD>
                        <TD className="hidden sm:table-cell max-w-[180px] truncate text-[12px] text-slate-500">{p.notes || '—'}</TD>
                        <TD className="text-right font-semibold tabular-nums text-emerald-600">{formatINR(p.amount)}</TD>
                      </TR>
                    ))}
                  </TBody>
                  <TFoot>
                    <TR>
                      <TD colSpan={3} className="text-right font-bold text-slate-700">Total received</TD>
                      <TD className="text-right font-bold tabular-nums text-emerald-600">{formatINR(s.revenue)}</TD>
                    </TR>
                  </TFoot>
                </Table>
              </TableWrap>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expenses */}
      <Card className="mt-3">
        <CardHeader>
          <div>
            <CardTitle>Site Expenses</CardTitle>
            <p className="text-[11.5px] text-slate-400">{expenses.length} entries · {formatINR(s.expenses)} booked</p>
          </div>
          <Button size="xs" variant="ghost" onClick={() => setExpenseOpen(true)}>
            <Plus /> Add expense
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-slate-400">No expenses booked against this project.</p>
          ) : (
            <TableWrap className="rounded-none border-0 shadow-none">
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Description</TH>
                    <TH className="hidden sm:table-cell">Category</TH>
                    <TH className="hidden md:table-cell">Vendor</TH>
                    <TH className="hidden lg:table-cell">Paid by</TH>
                    <TH className="text-right">Amount</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {expenses.map((e) => (
                    <TR key={e.id}>
                      <TD className="whitespace-nowrap text-[12.5px]">{formatDate(e.date)}</TD>
                      <TD className="max-w-[260px] truncate">{e.description}</TD>
                      <TD className="hidden sm:table-cell"><StatusBadge status={e.category} /></TD>
                      <TD className="hidden md:table-cell text-[12.5px] text-slate-500">{e.vendor || '—'}</TD>
                      <TD className="hidden lg:table-cell text-[12.5px] text-slate-500">{e.paymentMethod}</TD>
                      <TD className="text-right font-semibold tabular-nums text-amber-700">{formatINR(e.amount)}</TD>
                      <TD className="text-right">
                        <Button size="iconSm" variant="ghost" className="text-red-500 hover:bg-red-50" title="Delete" onClick={() => setExpenseConfirm(e)}>
                          <Trash2 />
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
                <TFoot>
                  <TR>
                    <TD colSpan={5} className="text-right font-bold text-slate-700">Total expenses</TD>
                    <TD className="text-right font-bold tabular-nums text-amber-700">{formatINR(s.expenses)}</TD>
                    <TD />
                  </TR>
                </TFoot>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <ProjectPhotos project={project} />

      <ProjectDialog open={editOpen} project={project} onOpenChange={setEditOpen} />
      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} defaults={{ projectId: project.id }} />
      <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} defaults={{ clientId: project.clientId, projectId: project.id, invoiceId: project.invoiceId || '' }} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${project.name}?`}
        description="Expenses and site photos booked against this project are removed too."
        onConfirm={() => {
          // Photos live in their own table, so nothing cascades — ask the
          // server to drop them before the project id stops existing locally.
          deleteProjectPhotos(project.id)
          deleteProject(project.id)
          navigate('/projects')
        }}
      />
      <ConfirmDialog
        open={!!expenseConfirm}
        onOpenChange={(o) => !o && setExpenseConfirm(null)}
        title="Delete this expense?"
        description={expenseConfirm ? `${expenseConfirm.description} — ${formatINR(expenseConfirm.amount)}` : ''}
        onConfirm={() => deleteExpense(expenseConfirm.id)}
      />
    </div>
  )
}
