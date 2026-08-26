import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, Users, Hammer, FileText, ReceiptIndianRupee, Wallet, TrendingDown } from 'lucide-react'

import { useStore } from '../lib/useStore'
import { quotationTotals, invoiceTotals, invoiceDisplayStatus } from '../lib/calc'
import { formatINR, formatDate } from '../lib/format'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatusBadge from '../components/ui/StatusBadge'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'

const has = (v, term) => String(v || '').toLowerCase().includes(term)

export default function SearchPage() {
  const [params] = useSearchParams()
  const db = useStore()
  const term = (params.get('q') || '').trim().toLowerCase()

  const results = useMemo(() => {
    if (!term) return null
    return {
      clients: db.clients.filter((c) => [c.id, c.name, c.company, c.phone, c.email, c.city, c.gstin, c.notes].some((v) => has(v, term))),
      projects: db.projects.filter((p) => [p.id, p.name, p.siteAddress, p.manager, p.notes].some((v) => has(v, term))),
      quotations: db.quotations.filter((q) => [q.id, q.title, q.siteAddress, q.notes].some((v) => has(v, term))),
      invoices: db.invoices.filter((i) => [i.id, i.notes, i.billingAddress, i.quotationId].some((v) => has(v, term))),
      payments: db.payments.filter((p) => [p.id, p.reference, p.notes, p.invoiceId, p.method].some((v) => has(v, term))),
      expenses: db.expenses.filter((e) => [e.id, e.description, e.vendor, e.category, e.notes].some((v) => has(v, term))),
    }
  }, [db, term])

  if (!term) {
    return (
      <EmptyState
        icon={SearchIcon}
        title="Search Stonezen OS"
        message="Type in the box above to search across clients, projects, quotations, invoices, payments and expenses."
      />
    )
  }

  const total = Object.values(results).reduce((s, arr) => s + arr.length, 0)
  const clientName = (id) => {
    const c = db.clients.find((x) => x.id === id)
    return c ? c.company || c.name : '—'
  }

  const Section = ({ title, icon: Icon, items, render }) => {
    if (!items.length) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 text-brand" /> {title}
          </CardTitle>
          <span className="text-[11.5px] text-slate-400">{items.length} result{items.length === 1 ? '' : 's'}</span>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">{items.map(render)}</CardContent>
      </Card>
    )
  }

  const Row = ({ to, primary, secondary, right, badge }) => (
    <Link to={to} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-slate-800">{primary}</span>
        <span className="block truncate text-[11.5px] text-slate-400">{secondary}</span>
      </span>
      {right && <span className="shrink-0 text-[13px] font-bold tabular-nums text-slate-800">{right}</span>}
      {badge && <StatusBadge className="shrink-0" status={badge} />}
    </Link>
  )

  return (
    <div>
      <PageHeader
        icon={SearchIcon}
        title={`Results for “${params.get('q')}”`}
        subtitle={`${total} match${total === 1 ? '' : 'es'} across your records`}
      />

      {total === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="Nothing found"
          message="Try a shorter term, a document number, or part of a client's name."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Section
            title="Clients" icon={Users} items={results.clients}
            render={(c) => (
              <Row key={c.id} to={`/clients/${c.id}`} primary={c.company || c.name} secondary={`${c.id} · ${c.phone || 'no phone'} · ${c.city || ''}`} badge={c.status} />
            )}
          />
          <Section
            title="Projects" icon={Hammer} items={results.projects}
            render={(p) => (
              <Row key={p.id} to={`/projects/${p.id}`} primary={p.name} secondary={`${p.id} · ${clientName(p.clientId)}`} right={formatINR(p.value)} badge={p.status} />
            )}
          />
          <Section
            title="Quotations" icon={FileText} items={results.quotations}
            render={(q) => (
              <Row key={q.id} to={`/quotations/${q.id}/preview`} primary={q.id} secondary={q.title} right={formatINR(quotationTotals(q).grandTotal)} badge={q.status} />
            )}
          />
          <Section
            title="Invoices" icon={ReceiptIndianRupee} items={results.invoices}
            render={(i) => (
              <Row key={i.id} to={`/invoices/${i.id}/preview`} primary={i.id} secondary={`${clientName(i.clientId)} · due ${formatDate(i.dueDate)}`} right={formatINR(invoiceTotals(i).grandTotal)} badge={invoiceDisplayStatus(db, i)} />
            )}
          />
          <Section
            title="Payments" icon={Wallet} items={results.payments}
            render={(p) => (
              <Row key={p.id} to="/accounts/payments" primary={`${p.id} — ${clientName(p.clientId)}`} secondary={`${formatDate(p.date)} · ${p.method}${p.reference ? ` · ${p.reference}` : ''}`} right={formatINR(p.amount)} />
            )}
          />
          <Section
            title="Expenses" icon={TrendingDown} items={results.expenses}
            render={(e) => (
              <Row key={e.id} to="/accounts/expenses" primary={e.description} secondary={`${formatDate(e.date)} · ${e.category}${e.vendor ? ` · ${e.vendor}` : ''}`} right={formatINR(e.amount)} />
            )}
          />
        </div>
      )}
    </div>
  )
}
