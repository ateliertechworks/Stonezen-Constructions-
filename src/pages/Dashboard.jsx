import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  IndianRupee, TrendingUp, Hammer, Clock, FileText, Users, BellRing,
  ArrowUpRight, ArrowRight, ReceiptIndianRupee, Wallet, TrendingDown, AlertTriangle,
  Briefcase,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { dashboardAggregates } from '../lib/calc'
import { formatINR, formatINRCompact, formatDateTime } from '../lib/format'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'
import { SERIES, CATEGORICAL, STATUS, CHROME, axisProps, ChartTooltip, compactTick, Legend } from '../components/charts'
import heroImg from '../../image/login.jpg'

const ACTIVITY_ICON = {
  quotation: FileText, invoice: ReceiptIndianRupee, payment: Wallet,
  expense: TrendingDown, project: Hammer, client: Users, settings: BellRing,
}

function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

/** Month-on-month change from the trend series, or null when there is no base. */
function monthDelta(series, key) {
  const last = series.at(-1)
  const prev = series.at(-2)
  if (!last || !prev || !prev[key]) return null
  return ((last[key] - prev[key]) / prev[key]) * 100
}

/**
 * A headline figure. The circular pastel chip, uppercase label and delta line
 * come straight from the design reference.
 */
function KpiCard({ label, value, icon: Icon, tone, footer, footerTone, onClick }) {
  const TONES = {
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 sm:p-5"
    >
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', TONES[tone])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</span>
        <span className="mt-1 block truncate text-[26px] font-extrabold leading-tight tracking-tight text-slate-900">
          {value}
        </span>
        {footer && (
          <span className={cn('mt-1 block text-[12px] font-semibold', footerTone || 'text-slate-400')}>{footer}</span>
        )}
      </span>
    </button>
  )
}

export default function Dashboard() {
  const db = useStore()
  const navigate = useNavigate()
  const a = useMemo(() => dashboardAggregates(db), [db])

  const revenueDelta = monthDelta(a.revExp, 'revenue')
  const expenseDelta = monthDelta(a.revExp, 'expense')
  const firstName = (db.settings.company.ceo || 'there').split(/\s+/).slice(-1)[0]

  const paymentSlices = [
    { name: 'Paid', value: a.paymentOverview.paid, color: STATUS.good },
    { name: 'Partially Paid', value: a.paymentOverview.partial, color: STATUS.warning },
    { name: 'Pending', value: a.paymentOverview.pending, color: STATUS.critical },
  ].filter((s) => s.value > 0)

  const projectSlices = a.projectStatus.map((s, i) => ({ ...s, color: CATEGORICAL[i % CATEGORICAL.length] }))

  const delta = (v) =>
    v === null ? null : `${v >= 0 ? '↑' : '↓'} ${Math.abs(v).toFixed(1)}% from last month`

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ hero */}
      {/* Two columns rather than an absolutely-positioned image: the artwork
          used to sit on top of the headline once the viewport was wide enough
          to show it but too narrow to clear the text. */}
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0 py-1">
          <p className="text-[13.5px] text-slate-600 sm:text-[14px]">
            {greeting()}, {firstName} <span aria-hidden="true">👋</span>
          </p>
          <h1 className="mt-1.5 text-balance text-[22px] font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-[28px] lg:text-[34px]">
            Here&apos;s what&apos;s happening with your{' '}
            <span className="text-amber-500">business</span> today.
          </h1>
        </div>

        {/* Decorative only — the figures below carry the actual information.
            Shown from xl, the first width with room for it beside the text. */}
        <div className="relative hidden h-[176px] w-[300px] shrink-0 xl:block" aria-hidden="true">
          <span className="absolute right-20 top-6 h-28 w-28 rounded-full bg-amber-400/90" />
          <img
            src={heroImg}
            alt=""
            className="absolute right-0 top-0 h-[176px] w-[268px] rounded-2xl object-cover opacity-95"
            style={{ maskImage: 'linear-gradient(to left, black 62%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to left, black 62%, transparent 100%)' }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={formatINRCompact(a.totalRevenue)}
          icon={IndianRupee}
          tone="amber"
          footer={delta(revenueDelta) || `${db.payments.length} payments received`}
          footerTone={revenueDelta === null ? undefined : revenueDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}
          onClick={() => navigate('/accounts/payments')}
        />
        <KpiCard
          label="Net Profit"
          value={formatINRCompact(a.netProfit)}
          icon={TrendingUp}
          tone="blue"
          footer={`${a.margin.toFixed(1)}% margin on collections`}
          footerTone={a.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}
          onClick={() => navigate('/accounts')}
        />
        <KpiCard
          label="Active Projects"
          value={a.activeProjects}
          icon={Briefcase}
          tone="green"
          footer={`${a.completedProjects} completed`}
          onClick={() => navigate('/projects')}
        />
        <KpiCard
          label="Pending Payments"
          value={formatINRCompact(a.pendingPayments)}
          icon={Clock}
          tone="red"
          footer={a.overdueCount ? `${a.overdueCount} overdue` : 'Nothing overdue'}
          footerTone={a.overdueCount ? 'text-red-500' : 'text-slate-400'}
          onClick={() => navigate('/invoices')}
        />
      </div>

      {/* ----------------------------------------------------------- alerts */}
      {/* Stacks on phones: side by side, the message was squeezed to a couple of
          words per line by the two buttons. */}
      {(a.followupCount > 0 || a.overdueCount > 0) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1 text-[13.5px] text-amber-900">
            {a.followupCount > 0 && (
              <>
                <strong className="font-bold">{a.followupCount}</strong> quotation{a.followupCount === 1 ? '' : 's'} waiting for follow-up
              </>
            )}
            {a.followupCount > 0 && a.overdueCount > 0 && <span className="mx-1.5 text-amber-400">•</span>}
            {a.overdueCount > 0 && (
              <>
                <strong className="font-bold">{a.overdueCount}</strong> invoice{a.overdueCount === 1 ? '' : 's'} past the due date
              </>
            )}
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            {a.followupCount > 0 && (
              <Button size="sm" className="bg-amber-400 text-slate-900 shadow-none hover:bg-amber-500" asChild>
                <Link to="/followups">Follow up</Link>
              </Button>
            )}
            {a.overdueCount > 0 && (
              <Button size="sm" variant="outline" asChild>
                <Link to="/invoices">View Invoices</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- charts */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle className="text-[15px]">Revenue vs Expenses</CardTitle>
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
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.revExp} margin={{ top: 4, right: 8, left: -6, bottom: 0 }} barGap={4}>
                  <CartesianGrid stroke={CHROME.grid} strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={compactTick} width={58} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                  <Bar dataKey="revenue" name="Revenue" fill={SERIES.revenue} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="expense" name="Expenses" fill={SERIES.expense} radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[15px]">Net Profit</CardTitle>
            <Link to="/accounts" className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline">
              View Accounts <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-[27px] font-extrabold leading-tight tracking-tight tabular-nums text-slate-900">
                {formatINR(a.netProfit)}
              </p>
              <p className="text-[12px] text-slate-400">{a.margin.toFixed(1)}% margin on collections</p>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Revenue Collected', value: a.totalRevenue, color: SERIES.revenue },
                { label: 'Expenses Booked', value: a.totalExpenses, color: SERIES.expense },
                { label: 'Invoiced to Date', value: a.totalInvoiced, color: '#64748b' },
              ].map((r) => {
                const max = Math.max(a.totalRevenue, a.totalExpenses, a.totalInvoiced) || 1
                return (
                  <div key={r.label}>
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="text-slate-500">{r.label}</span>
                      <span className="font-bold tabular-nums text-slate-900">{formatINR(r.value)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
            {expenseDelta !== null && (
              <p className="text-[11.5px] text-slate-400">
                Spending {expenseDelta >= 0 ? 'up' : 'down'} {Math.abs(expenseDelta).toFixed(1)}% on last month
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --------------------------------------------------- status + feed */}
      <div className="grid gap-3 lg:grid-cols-4">
        <DonutCard
          title="Payment Status"
          subtitle={`${db.invoices.length} Invoices`}
          slices={paymentSlices}
          to="/invoices"
        />
        <DonutCard
          title="Project Status"
          subtitle={`${a.totalProjects} Projects`}
          slices={projectSlices}
          to="/projects"
        />

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[15px]">Recent Activity</CardTitle>
            <span className="text-[11.5px] text-slate-400">{db.activities.length} entries</span>
          </CardHeader>
          <CardContent className="max-h-[268px] space-y-2.5 overflow-y-auto p-3">
            {a.recentActivity.length === 0 && (
              <p className="py-6 text-center text-[13px] text-slate-400">Nothing yet — activity shows up as you work.</p>
            )}
            {a.recentActivity.map((act) => {
              const Icon = ACTIVITY_ICON[act.type] || ArrowUpRight
              return (
                <div key={act.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-snug text-slate-700">{act.text}</p>
                    <p className="text-[10.5px] text-slate-400">{formatDateTime(act.date)}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
          {a.recentActivity.length > 0 && (
            <div className="border-t border-slate-100 py-2.5 text-center">
              <Link to="/search?q=" className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline">
                View All Activity <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function DonutCard({ title, subtitle, slices, to }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div>
          <CardTitle className="text-[15px]">{title}</CardTitle>
          <p className="text-[11.5px] text-slate-400">{subtitle}</p>
        </div>
        <Link to={to} className="-m-1 rounded-md p-2 text-slate-400 hover:text-brand" aria-label={`Open ${title}`}>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent className="p-3">
        {total === 0 ? (
          <p className="py-10 text-center text-[13px] text-slate-400">No data yet.</p>
        ) : (
          <>
            <div className="relative mx-auto h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices} dataKey="value" nameKey="name"
                    innerRadius={46} outerRadius={70} paddingAngle={2} stroke="#ffffff" strokeWidth={3}
                  >
                    {slices.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip compact />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[24px] font-extrabold leading-none text-slate-900">{total}</span>
                <span className="mt-0.5 text-[10.5px] text-slate-400">Total</span>
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
