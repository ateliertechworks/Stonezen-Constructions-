import { useMemo, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  Landmark, IndianRupee, TrendingDown, TrendingUp, Receipt, Download,
  Wallet, ArrowLeftRight, AlertCircle, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { accountsSummary, invoiceTotals, clientTotals, isLiveInvoice } from '../lib/calc'
import { formatINR, formatDate } from '../lib/format'
import { download, cn } from '../lib/utils'

import Payments from './Payments'
import Expenses from './Expenses'

import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { SimpleSelect } from '../components/ui/select'
import { TableWrap, Table, THead, TBody, TR, TH, TD, TFoot } from '../components/ui/table'
import { SERIES, CHROME, axisProps, ChartTooltip, compactTick, Legend } from '../components/charts'

/** Accounts is the single financial workspace — each section is a route under /accounts. */
const TABS = [
  { slug: '', label: 'Financial Overview', icon: Landmark },
  { slug: 'payments', label: 'Payments', icon: Wallet },
  { slug: 'expenses', label: 'Expenses', icon: TrendingDown },
  { slug: 'ledger', label: 'Ledger / Transactions', icon: ArrowLeftRight },
  { slug: 'receivables', label: 'Receivables', icon: AlertCircle },
]

const KNOWN = TABS.map((t) => t.slug).filter(Boolean)

export default function Accounts() {
  const db = useStore()
  const { tab: raw } = useParams()
  const tab = KNOWN.includes(raw) ? raw : 'overview'
  const [range, setRange] = useState('12')

  const a = useMemo(() => accountsSummary(db, Number(range)), [db, range])

  const expenseByCategory = useMemo(() => {
    const map = db.expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0)
      return acc
    }, {})
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((x, y) => y.value - x.value)
  }, [db])

  const receivables = useMemo(
    () =>
      db.clients
        .map((c) => ({ client: c, totals: clientTotals(db, c) }))
        .filter((r) => r.totals.outstanding > 0)
        .sort((x, y) => y.totals.outstanding - x.totals.outstanding),
    [db],
  )

  const gstSummary = useMemo(() => {
    const live = db.invoices.filter((i) => i.gstEnabled && isLiveInvoice(db, i))
    return live.reduce(
      (acc, i) => {
        const t = invoiceTotals(i)
        acc.taxable += t.taxableAmount
        acc.cgst += t.cgst
        acc.sgst += t.sgst
        acc.igst += t.igst
        acc.total += t.gstAmount
        return acc
      },
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
    )
  }, [db])

  /** Money in (payments) and money out (expenses) on one chronological register. */
  const ledger = useMemo(() => {
    const rows = []
    db.payments.forEach((p) => {
      const client = db.clients.find((c) => c.id === p.clientId)
      rows.push({
        key: `p-${p.id}`,
        date: p.date,
        type: 'Payment',
        particulars: p.notes || `Payment received${client ? ` — ${client.company || client.name}` : ''}`,
        party: client ? client.company || client.name : '—',
        ref: p.invoiceId || p.reference || p.id,
        link: p.invoiceId ? `/invoices/${p.invoiceId}/preview` : '/accounts/payments',
        inflow: Number(p.amount || 0),
        outflow: 0,
      })
    })
    db.expenses.forEach((e) => {
      const project = db.projects.find((p) => p.id === e.projectId)
      rows.push({
        key: `e-${e.id}`,
        date: e.date,
        type: 'Expense',
        particulars: e.description,
        party: e.vendor || e.category,
        ref: e.category,
        link: project ? `/projects/${project.id}` : '/accounts/expenses',
        inflow: 0,
        outflow: Number(e.amount || 0),
      })
    })
    rows.sort((x, y) => (x.date === y.date ? 0 : x.date < y.date ? -1 : 1))
    let running = 0
    const withBalance = rows.map((r) => {
      running += r.inflow - r.outflow
      return { ...r, balance: Math.round(running * 100) / 100 }
    })
    return withBalance.reverse()
  }, [db])

  const [ledgerType, setLedgerType] = useState('All')
  const ledgerRows = ledger.filter((r) => ledgerType === 'All' || r.type === ledgerType)
  const cash = {
    in: ledger.reduce((s, r) => s + r.inflow, 0),
    out: ledger.reduce((s, r) => s + r.outflow, 0),
  }

  const exportCsv = () => {
    const header = 'Month,Revenue,Expenses,Profit'
    const body = a.series.map((r) => `${r.month},${r.revenue},${r.expense},${r.profit}`).join('\n')
    const totals = `Total,${a.revenue},${a.expenses},${a.profit}`
    download('stonezen-accounts.csv', [header, body, totals].join('\n'), 'text/csv')
  }

  const outstandingTotal = receivables.reduce((s, r) => s + r.totals.outstanding, 0)

  return (
    <div>
      <PageHeader
        icon={Landmark}
        title="Accounts"
        subtitle="Revenue, expenses, payments, ledger and GST in one workspace"
        actions={
          tab === 'overview' ? (
            <>
              <SimpleSelect
                value={range}
                onValueChange={setRange}
                options={[
                  { value: '6', label: 'Last 6 months' },
                  { value: '12', label: 'Last 12 months' },
                ]}
                className="w-[160px]"
              />
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download /> Export CSV
              </Button>
            </>
          ) : null
        }
      />

      {/* Section switcher — scrolls horizontally on small screens instead of overflowing the page. */}
      <div className="scroll-x -mx-3 mb-4 px-3 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-full gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <NavLink
                key={t.slug || 'overview'}
                to={t.slug ? `/accounts/${t.slug}` : '/accounts'}
                end={!t.slug}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-semibold transition-colors',
                    isActive
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t.label}
              </NavLink>
            )
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------ overview */}
      {tab === 'overview' && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatCard label="Revenue Collected" value={formatINR(a.revenue)} sub={`${db.payments.length} payments`} icon={IndianRupee} tone="green" />
            <StatCard label="Expenses Booked" value={formatINR(a.expenses)} sub={`${db.expenses.length} entries`} icon={TrendingDown} tone="amber" />
            <StatCard
              label="Net Profit" value={formatINR(a.profit)}
              sub={`${a.revenue ? ((a.profit / a.revenue) * 100).toFixed(1) : 0}% margin`}
              icon={TrendingUp} tone={a.profit >= 0 ? 'brand' : 'red'}
            />
            <StatCard label="GST Collected" value={formatINR(gstSummary.total)} sub="on issued invoices" icon={Receipt} tone="blue" />
          </div>

          <Card className="mb-3">
            <CardHeader>
              <div>
                <CardTitle>Monthly trend</CardTitle>
                <p className="text-[11.5px] text-slate-400">Collections against booked expenses</p>
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
                  <BarChart data={a.series} margin={{ top: 4, right: 8, left: -6, bottom: 0 }} barGap={2}>
                    <CartesianGrid stroke={CHROME.grid} vertical={false} />
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

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Expense breakdown</CardTitle>
                <Link to="/accounts/expenses" className="text-[11.5px] font-semibold text-brand hover:underline">
                  All expenses →
                </Link>
              </CardHeader>
              <CardContent className="space-y-2.5 p-3">
                {expenseByCategory.length === 0 && <p className="py-6 text-center text-[13px] text-slate-400">No expenses booked yet.</p>}
                {expenseByCategory.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="min-w-0 truncate text-slate-600">{c.name}</span>
                      <span className="shrink-0 font-bold tabular-nums text-slate-800">
                        {formatINR(c.value)}
                        <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                          {((c.value / a.expenses) * 100).toFixed(0)}%
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${(c.value / a.expenses) * 100}%`, background: SERIES.revenue }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>GST summary</CardTitle>
                <span className="text-[11.5px] text-slate-400">Issued invoices only</span>
              </CardHeader>
              <CardContent className="p-3">
                <dl className="divide-y divide-slate-100 text-[13px]">
                  {[
                    ['Taxable value', gstSummary.taxable],
                    ['CGST', gstSummary.cgst],
                    ['SGST', gstSummary.sgst],
                    ['IGST', gstSummary.igst],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-2 py-1.5">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="shrink-0 font-semibold tabular-nums text-slate-800">{formatINR(v)}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <dt className="font-bold text-slate-700">Total GST collected</dt>
                    <dd className="shrink-0 font-bold tabular-nums text-slate-900">{formatINR(gstSummary.total)}</dd>
                  </div>
                </dl>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
                  GSTIN {db.settings.company.gstin} · figures are for reference and should be reconciled with your filed returns.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------ payments */}
      {tab === 'payments' && <Payments embedded />}

      {/* ------------------------------------------------------------ expenses */}
      {tab === 'expenses' && <Expenses embedded />}

      {/* -------------------------------------------------------------- ledger */}
      {tab === 'ledger' && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatCard label="Money In" value={formatINR(cash.in)} sub={`${db.payments.length} payments`} icon={ArrowDownLeft} tone="green" />
            <StatCard label="Money Out" value={formatINR(cash.out)} sub={`${db.expenses.length} expenses`} icon={ArrowUpRight} tone="amber" />
            <StatCard
              label="Net Cash Flow" value={formatINR(cash.in - cash.out)}
              sub="all recorded transactions" icon={ArrowLeftRight}
              tone={cash.in - cash.out >= 0 ? 'brand' : 'red'}
            />
            <StatCard label="Transactions" value={ledger.length} sub="payments + expenses" icon={Receipt} tone="blue" />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-[13px] text-slate-500">
              Showing <span className="font-semibold text-slate-800">{ledgerRows.length}</span> of {ledger.length} transactions
            </p>
            <SimpleSelect
              value={ledgerType}
              onValueChange={setLedgerType}
              options={[
                { value: 'All', label: 'All transactions' },
                { value: 'Payment', label: 'Payments only' },
                { value: 'Expense', label: 'Expenses only' },
              ]}
              className="ml-auto w-[180px]"
            />
          </div>

          {ledgerRows.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-[13px] text-slate-400">
                No transactions recorded yet — payments and expenses appear here as you book them.
              </CardContent>
            </Card>
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Particulars</TH>
                    <TH className="hidden md:table-cell">Party</TH>
                    <TH>Type</TH>
                    <TH className="hidden lg:table-cell">Reference</TH>
                    <TH className="text-right">In</TH>
                    <TH className="text-right">Out</TH>
                    <TH className="hidden sm:table-cell text-right">Balance</TH>
                  </TR>
                </THead>
                <TBody>
                  {ledgerRows.map((r) => (
                    <TR key={r.key}>
                      <TD className="whitespace-nowrap text-[12.5px]">{formatDate(r.date)}</TD>
                      <TD>
                        <Link to={r.link} className="block max-w-[240px] truncate font-medium text-slate-800 hover:text-brand">
                          {r.particulars}
                        </Link>
                      </TD>
                      <TD className="hidden md:table-cell max-w-[160px] truncate text-[12.5px] text-slate-500">{r.party}</TD>
                      <TD>
                        <Badge tone={r.type === 'Payment' ? 'green' : 'amber'}>{r.type}</Badge>
                      </TD>
                      <TD className="hidden lg:table-cell max-w-[140px] truncate text-[12px] text-slate-500">{r.ref}</TD>
                      <TD className="text-right font-semibold tabular-nums text-emerald-600">
                        {r.inflow ? formatINR(r.inflow) : '—'}
                      </TD>
                      <TD className="text-right font-semibold tabular-nums text-amber-700">
                        {r.outflow ? formatINR(r.outflow) : '—'}
                      </TD>
                      <TD className={cn('hidden sm:table-cell text-right font-bold tabular-nums', r.balance >= 0 ? 'text-slate-800' : 'text-red-600')}>
                        {formatINR(r.balance)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
                <TFoot>
                  <TR>
                    <TD colSpan={5} className="text-right font-bold text-slate-700">Net cash flow</TD>
                    <TD className="text-right font-bold tabular-nums text-emerald-600">{formatINR(cash.in)}</TD>
                    <TD className="text-right font-bold tabular-nums text-amber-700">{formatINR(cash.out)}</TD>
                    <TD className={cn('hidden sm:table-cell text-right font-bold tabular-nums', cash.in - cash.out >= 0 ? 'text-slate-900' : 'text-red-600')}>
                      {formatINR(cash.in - cash.out)}
                    </TD>
                  </TR>
                </TFoot>
              </Table>
            </TableWrap>
          )}
        </>
      )}

      {/* --------------------------------------------------------- receivables */}
      {tab === 'receivables' && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatCard label="Outstanding" value={formatINR(outstandingTotal)} sub={`${receivables.length} clients`} icon={AlertCircle} tone={outstandingTotal > 0 ? 'red' : 'green'} />
            <StatCard label="Total Invoiced" value={formatINR(receivables.reduce((s, r) => s + r.totals.totalInvoiced, 0))} sub="on open accounts" icon={Receipt} tone="brand" />
            <StatCard label="Total Received" value={formatINR(receivables.reduce((s, r) => s + r.totals.totalPaid, 0))} sub="against those invoices" icon={IndianRupee} tone="green" />
            <StatCard label="Revenue Collected" value={formatINR(a.revenue)} sub="all time" icon={Wallet} tone="blue" />
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Outstanding receivables</CardTitle>
                <p className="text-[11.5px] text-slate-400">{receivables.length} clients with a balance</p>
              </div>
              <Link to="/invoices" className="text-[11.5px] font-semibold text-brand hover:underline">All invoices →</Link>
            </CardHeader>
            <CardContent className="p-0">
              {receivables.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-slate-400">Everything is settled — no outstanding balances.</p>
              ) : (
                <TableWrap className="rounded-none border-0 shadow-none">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Client</TH>
                        <TH className="text-right">Invoiced</TH>
                        <TH className="text-right">Received</TH>
                        <TH className="text-right">Outstanding</TH>
                        <TH className="hidden sm:table-cell text-center">Invoices</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {receivables.map(({ client, totals }) => (
                        <TR key={client.id}>
                          <TD>
                            <Link to={`/clients/${client.id}?tab=ledger`} className="font-semibold text-slate-900 hover:text-brand">
                              {client.company || client.name}
                            </Link>
                          </TD>
                          <TD className="text-right tabular-nums">{formatINR(totals.totalInvoiced)}</TD>
                          <TD className="text-right tabular-nums text-emerald-600">{formatINR(totals.totalPaid)}</TD>
                          <TD className="text-right font-bold tabular-nums text-red-600">{formatINR(totals.outstanding)}</TD>
                          <TD className="hidden sm:table-cell text-center tabular-nums text-slate-500">{totals.counts.invoices}</TD>
                        </TR>
                      ))}
                    </TBody>
                    <TFoot>
                      <TR>
                        <TD className="font-bold text-slate-700">Total</TD>
                        <TD className="text-right tabular-nums">{formatINR(receivables.reduce((s, r) => s + r.totals.totalInvoiced, 0))}</TD>
                        <TD className="text-right tabular-nums text-emerald-600">{formatINR(receivables.reduce((s, r) => s + r.totals.totalPaid, 0))}</TD>
                        <TD className="text-right font-bold tabular-nums text-red-600">{formatINR(outstandingTotal)}</TD>
                        <TD className="hidden sm:table-cell" />
                      </TR>
                    </TFoot>
                  </Table>
                </TableWrap>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
