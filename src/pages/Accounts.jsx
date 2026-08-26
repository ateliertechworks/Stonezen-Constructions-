import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Landmark, IndianRupee, TrendingDown, TrendingUp, Receipt, Download } from 'lucide-react'

import { useStore } from '../lib/useStore'
import { accountsSummary, invoiceTotals, clientTotals, isLiveInvoice } from '../lib/calc'
import { formatINR } from '../lib/format'
import { download } from '../lib/utils'

import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { SimpleSelect } from '../components/ui/select'
import { TableWrap, Table, THead, TBody, TR, TH, TD, TFoot } from '../components/ui/table'
import { SERIES, CHROME, axisProps, ChartTooltip, compactTick, Legend } from '../components/charts'

export default function Accounts() {
  const db = useStore()
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

  const exportCsv = () => {
    const header = 'Month,Revenue,Expenses,Profit'
    const body = a.series.map((r) => `${r.month},${r.revenue},${r.expense},${r.profit}`).join('\n')
    const totals = `Total,${a.revenue},${a.expenses},${a.profit}`
    download('stonezen-accounts.csv', [header, body, totals].join('\n'), 'text/csv')
  }

  return (
    <div>
      <PageHeader
        icon={Landmark}
        title="Accounts"
        subtitle="Revenue, expenses, receivables and GST at a glance"
        actions={
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
        }
      />

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
            <Link to="/expenses" className="text-[11.5px] font-semibold text-brand hover:underline">All expenses →</Link>
          </CardHeader>
          <CardContent className="space-y-2.5 p-3">
            {expenseByCategory.length === 0 && <p className="py-6 text-center text-[13px] text-slate-400">No expenses booked yet.</p>}
            {expenseByCategory.map((c) => (
              <div key={c.name}>
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="text-slate-600">{c.name}</span>
                  <span className="font-bold tabular-nums text-slate-800">
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
                <div key={k} className="flex items-center justify-between py-1.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-semibold tabular-nums text-slate-800">{formatINR(v)}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <dt className="font-bold text-slate-700">Total GST collected</dt>
                <dd className="font-bold tabular-nums text-slate-900">{formatINR(gstSummary.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
              GSTIN {db.settings.company.gstin} · figures are for reference and should be reconciled with your filed returns.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-3">
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
                    <TD className="text-right font-bold tabular-nums text-red-600">{formatINR(receivables.reduce((s, r) => s + r.totals.outstanding, 0))}</TD>
                    <TD className="hidden sm:table-cell" />
                  </TR>
                </TFoot>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
