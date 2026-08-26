import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  IndianRupee, TrendingUp, Hammer, Clock, FileText, Users, BellRing,
  ArrowUpRight, ReceiptIndianRupee, Wallet, TrendingDown, AlertTriangle,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { dashboardAggregates } from '../lib/calc'
import { formatINR, formatINRCompact, formatDateTime } from '../lib/format'
import StatCard from '../components/ui/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { SERIES, CATEGORICAL, STATUS, CHROME, axisProps, ChartTooltip, compactTick, Legend } from '../components/charts'

const ACTIVITY_ICON = {
  quotation: FileText, invoice: ReceiptIndianRupee, payment: Wallet,
  expense: TrendingDown, project: Hammer, client: Users, settings: BellRing,
}

export default function Dashboard() {
  const db = useStore()
  const navigate = useNavigate()
  const a = useMemo(() => dashboardAggregates(db), [db])

  const paymentSlices = [
    { name: 'Paid', value: a.paymentOverview.paid, color: STATUS.good },
    { name: 'Partially Paid', value: a.paymentOverview.partial, color: STATUS.warning },
    { name: 'Pending', value: a.paymentOverview.pending, color: STATUS.critical },
  ].filter((s) => s.value > 0)

  const projectSlices = a.projectStatus.map((s, i) => ({ ...s, color: CATEGORICAL[i % CATEGORICAL.length] }))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Dashboard</h1>
          <p className="text-[12.5px] text-slate-500">
            {db.settings.company.name} · {a.activeProjects} active project{a.activeProjects === 1 ? '' : 's'}
          </p>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => navigate('/payments')}>
          <Wallet /> Record Payment
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Total Revenue" value={formatINRCompact(a.totalRevenue)}
          sub={`${db.payments.length} payments received`} icon={IndianRupee} tone="green"
          onClick={() => navigate('/payments')}
        />
        <StatCard
          label="Net Profit" value={formatINRCompact(a.netProfit)}
          sub={`${a.margin.toFixed(1)}% margin`} icon={TrendingUp}
          tone={a.netProfit >= 0 ? 'brand' : 'red'} onClick={() => navigate('/accounts')}
        />
        <StatCard
          label="Active Projects" value={a.activeProjects}
          sub={`${a.completedProjects} completed`} icon={Hammer} tone="amber"
          onClick={() => navigate('/projects')}
        />
        <StatCard
          label="Pending Payments" value={formatINRCompact(a.pendingPayments)}
          sub={a.overdueCount ? `${a.overdueCount} overdue` : 'nothing overdue'} icon={Clock}
          tone={a.overdueCount ? 'red' : 'blue'} onClick={() => navigate('/invoices')}
        />
      </div>

      {/* Alerts */}
      {(a.followupCount > 0 || a.overdueCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="flex-1 text-[13px] text-amber-800">
            {a.followupCount > 0 && (
              <>
                <strong>{a.followupCount}</strong> quotation{a.followupCount === 1 ? '' : 's'} waiting on a follow-up
              </>
            )}
            {a.followupCount > 0 && a.overdueCount > 0 && ' · '}
            {a.overdueCount > 0 && (
              <>
                <strong>{a.overdueCount}</strong> invoice{a.overdueCount === 1 ? '' : 's'} past the due date
              </>
            )}
          </p>
          <div className="flex gap-2">
            {a.followupCount > 0 && (
              <Button size="xs" variant="outline" asChild>
                <Link to="/followups">Follow up</Link>
              </Button>
            )}
            {a.overdueCount > 0 && (
              <Button size="xs" variant="outline" asChild>
                <Link to="/invoices">View invoices</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Revenue vs Expenses</CardTitle>
              <p className="text-[11.5px] text-slate-400">Last 6 months</p>
            </div>
            <Legend
              items={[
                { label: 'Revenue', color: SERIES.revenue },
                { label: 'Expenses', color: SERIES.expense },
              ]}
            />
          </CardHeader>
          <CardContent className="p-2 pt-3">
            <div className="h-[190px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.revExp} margin={{ top: 4, right: 8, left: -6, bottom: 0 }} barGap={2}>
                  <CartesianGrid stroke={CHROME.grid} strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={compactTick} width={58} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                  <Bar dataKey="revenue" name="Revenue" fill={SERIES.revenue} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="expense" name="Expenses" fill={SERIES.expense} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net Profit</CardTitle>
            <Link to="/accounts" className="text-[11.5px] font-semibold text-brand hover:underline">
              Accounts →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{formatINR(a.netProfit)}</p>
              <p className="text-[11.5px] text-slate-400">{a.margin.toFixed(1)}% margin on collections</p>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Revenue collected', value: a.totalRevenue, color: SERIES.revenue },
                { label: 'Expenses booked', value: a.totalExpenses, color: SERIES.expense },
                { label: 'Invoiced to date', value: a.totalInvoiced, color: '#94a3b8' },
              ].map((r) => {
                const max = Math.max(a.totalRevenue, a.totalExpenses, a.totalInvoiced) || 1
                return (
                  <div key={r.label}>
                    <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                      <span className="text-slate-500">{r.label}</span>
                      <span className="font-bold tabular-nums text-slate-900">{formatINR(r.value)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <DonutCard
          title="Payment Status"
          subtitle={`${db.invoices.length} invoices`}
          slices={paymentSlices}
          to="/invoices"
        />
        <DonutCard
          title="Project Status"
          subtitle={`${a.totalProjects} projects`}
          slices={projectSlices}
          to="/projects"
        />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <span className="text-[11.5px] text-slate-400">{db.activities.length} entries</span>
          </CardHeader>
          <CardContent className="max-h-[236px] space-y-2 overflow-y-auto p-3">
            {a.recentActivity.length === 0 && (
              <p className="py-6 text-center text-[13px] text-slate-400">Nothing yet — activity shows up as you work.</p>
            )}
            {a.recentActivity.map((act) => {
              const Icon = ACTIVITY_ICON[act.type] || ArrowUpRight
              return (
                <div key={act.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-snug text-slate-700">{act.text}</p>
                    <p className="text-[10.5px] text-slate-400">{formatDateTime(act.date)}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DonutCard({ title, subtitle, slices, to }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="text-[11.5px] text-slate-400">{subtitle}</p>
        </div>
        <Link to={to} className="text-[11.5px] font-semibold text-brand hover:underline">
          →
        </Link>
      </CardHeader>
      <CardContent className="p-3">
        {total === 0 ? (
          <p className="py-10 text-center text-[13px] text-slate-400">No data yet.</p>
        ) : (
          <>
            <div className="relative mx-auto h-[132px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices} dataKey="value" nameKey="name"
                    innerRadius={40} outerRadius={62} paddingAngle={2} stroke="#ffffff" strokeWidth={2}
                  >
                    {slices.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip compact />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-slate-900">{total}</span>
                <span className="text-[10px] text-slate-400">total</span>
              </div>
            </div>
            <Legend
              className="mt-2 justify-center"
              items={slices.map((s) => ({ label: s.name, color: s.color, value: s.value }))}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
