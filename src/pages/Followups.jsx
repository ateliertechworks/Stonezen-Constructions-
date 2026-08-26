import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BellRing, MessageCircle, Mail, Phone, Eye, CheckCircle2, XCircle, Clock, AlertTriangle,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { followups } from '../lib/calc'
import { updateQuotation, addActivity } from '../lib/store'
import { formatINR, formatINRCompact, formatDate, todayISO, addDaysISO } from '../lib/format'
import {
  whatsappLink, mailtoLink, telLink, openLink,
  followupWhatsAppTemplate, followupEmailTemplate,
} from '../lib/comms'

import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { SimpleSelect } from '../components/ui/select'
import { cn } from '../lib/utils'

const URGENCY = {
  high: { tone: 'red', label: 'Chase now' },
  medium: { tone: 'amber', label: 'Due a nudge' },
  low: { tone: 'blue', label: 'Recently sent' },
}

export default function Followups() {
  const db = useStore()
  const navigate = useNavigate()
  const [urgency, setUrgency] = useState('All')

  const list = useMemo(() => followups(db), [db])
  const rows = list.filter((f) => urgency === 'All' || f.urgency === urgency.toLowerCase())

  const stats = {
    total: list.length,
    value: list.reduce((s, f) => s + f.value, 0),
    urgent: list.filter((f) => f.urgency === 'high').length,
    expired: list.filter((f) => f.expired).length,
  }

  const markContacted = (q, channel) => {
    updateQuotation(q.id, { lastContact: todayISO(), nextFollowup: addDaysISO(todayISO(), 7) })
    addActivity(`Followed up on quotation ${q.id} via ${channel}`, 'quotation')
  }

  return (
    <div>
      <PageHeader
        icon={BellRing}
        title="Follow-ups"
        subtitle={`${list.length} quotation${list.length === 1 ? '' : 's'} waiting on a reply · ${formatINR(stats.value)} in play`}
        actions={
          <SimpleSelect
            value={urgency}
            onValueChange={setUrgency}
            options={[
              { value: 'All', label: 'All follow-ups' },
              { value: 'High', label: 'Chase now' },
              { value: 'Medium', label: 'Due a nudge' },
              { value: 'Low', label: 'Recently sent' },
            ]}
            className="w-[170px]"
          />
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard label="Open Follow-ups" value={stats.total} icon={BellRing} tone="brand" />
        <StatCard label="Value in Play" value={formatINRCompact(stats.value)} tone="green" />
        <StatCard label="Needs Chasing" value={stats.urgent} sub="14+ days quiet" icon={AlertTriangle} tone="red" />
        <StatCard label="Expired Validity" value={stats.expired} icon={Clock} tone="amber" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={list.length ? 'Nothing in this bucket' : 'All caught up'}
          message={
            list.length
              ? 'Try a different urgency filter.'
              : 'No sent quotations are waiting on a reply. Send a quotation and it will show up here.'
          }
          action={<Button onClick={() => navigate('/quotations/new')}>New Quotation</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {rows.map(({ quotation: q, client, daysSinceContact, expired, value, urgency: u }) => {
            const waMsg = followupWhatsAppTemplate(client, q, value, db.settings.company)
            const email = followupEmailTemplate(client, q, value, db.settings.company)
            return (
              <Card key={q.id} className={cn('border-l-4', u === 'high' ? 'border-l-red-500' : u === 'medium' ? 'border-l-amber-500' : 'border-l-blue-500')}>
                <CardContent className="flex flex-wrap items-start gap-3 p-3.5">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/quotations/${q.id}/preview`} className="text-[14px] font-bold text-slate-900 hover:text-brand">
                        {q.id}
                      </Link>
                      <Badge tone={URGENCY[u].tone}>{URGENCY[u].label}</Badge>
                      {expired && <Badge tone="red">Validity expired</Badge>}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[13px] text-slate-600">{q.title}</p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {client ? (
                        <Link to={`/clients/${client.id}`} className="font-semibold text-slate-700 hover:text-brand">
                          {client.company || client.name}
                        </Link>
                      ) : (
                        'No client'
                      )}
                      {client?.contactPerson && ` · ${client.contactPerson}`}
                      {client?.phone && ` · ${client.phone}`}
                    </p>
                    <p className="mt-1 text-[11.5px] text-slate-400">
                      Sent {formatDate(q.date)} · last contact {q.lastContact ? formatDate(q.lastContact) : 'never'} ·{' '}
                      <span className={cn('font-semibold', daysSinceContact >= 14 ? 'text-red-600' : daysSinceContact >= 7 ? 'text-amber-600' : 'text-slate-500')}>
                        {daysSinceContact} day{daysSinceContact === 1 ? '' : 's'} quiet
                      </span>
                      {q.nextFollowup && ` · next follow-up ${formatDate(q.nextFollowup)}`}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-slate-900">{formatINR(value)}</p>
                    <p className="text-[11px] text-slate-400">valid until {formatDate(q.validUntil)}</p>
                  </div>

                  <div className="flex w-full flex-wrap gap-1.5 border-t border-slate-100 pt-2.5 sm:w-auto sm:border-0 sm:pt-0">
                    <Button
                      size="sm" variant="whatsapp" disabled={!client?.whatsapp && !client?.phone}
                      onClick={() => {
                        markContacted(q, 'WhatsApp')
                        openLink(whatsappLink(client?.whatsapp || client?.phone, waMsg))
                      }}
                    >
                      <MessageCircle /> WhatsApp
                    </Button>
                    <Button
                      size="sm" variant="outline" disabled={!client?.email && !q.email}
                      onClick={() => {
                        markContacted(q, 'email')
                        openLink(mailtoLink(client?.email || q.email, email.subject, email.body))
                      }}
                    >
                      <Mail /> Email
                    </Button>
                    <Button size="iconSm" variant="outline" title="Call" disabled={!client?.phone}
                      onClick={() => {
                        markContacted(q, 'phone')
                        openLink(telLink(client.phone))
                      }}>
                      <Phone />
                    </Button>
                    <Button size="iconSm" variant="outline" title="Open quotation" onClick={() => navigate(`/quotations/${q.id}/preview`)}>
                      <Eye />
                    </Button>
                    <Button
                      size="iconSm" variant="outline" title="Mark as accepted" className="text-emerald-600"
                      onClick={() => {
                        updateQuotation(q.id, { status: 'Accepted' })
                        addActivity(`Quotation ${q.id} accepted — ${formatINR(value)}`, 'quotation')
                      }}
                    >
                      <CheckCircle2 />
                    </Button>
                    <Button
                      size="iconSm" variant="outline" title="Mark as rejected" className="text-red-600"
                      onClick={() => {
                        updateQuotation(q.id, { status: 'Rejected' })
                        addActivity(`Quotation ${q.id} marked rejected`, 'quotation')
                      }}
                    >
                      <XCircle />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
