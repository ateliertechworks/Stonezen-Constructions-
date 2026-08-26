import { Plus, Trash2, Wand2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { SimpleSelect } from '../ui/select'
import { formatINR } from '../../lib/format'
import { cn } from '../../lib/utils'

const STATUSES = ['Pending', 'Paid', 'Invoiced']

const DEFAULT_PLAN = [
  ['Advance Payment', 0.15],
  ['After Foundation', 0.3],
  ['After Structure', 0.25],
  ['After Finishing', 0.2],
  ['On Completion', 0.1],
]

export default function ScheduleEditor({ rows = [], onChange, grandTotal = 0 }) {
  const update = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const add = () => onChange([...rows, { milestone: '', amount: 0, status: 'Pending' }])
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i))

  /** Splits the grand total across a standard milestone plan, remainder last. */
  const generate = () => {
    let allocated = 0
    const next = DEFAULT_PLAN.map(([milestone, share], i) => {
      const amount =
        i === DEFAULT_PLAN.length - 1
          ? Math.round(grandTotal - allocated)
          : Math.round(grandTotal * share)
      allocated += amount
      return { milestone, amount, status: 'Pending' }
    })
    onChange(next)
  }

  const scheduled = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
  const diff = Math.round(grandTotal - scheduled)

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[12.5px] text-slate-400">
          No milestones yet — add them manually or generate a standard plan.
        </p>
      )}

      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_120px_120px_36px]">
          <Input value={r.milestone} onChange={(e) => update(i, { milestone: e.target.value })} placeholder="e.g. After Plinth Beam Completion" />
          <Input
            type="number" value={r.amount}
            onChange={(e) => update(i, { amount: e.target.value === '' ? 0 : Number(e.target.value) })}
            className="text-right tabular-nums"
          />
          <SimpleSelect value={r.status || 'Pending'} onValueChange={(v) => update(i, { status: v })} options={STATUSES} />
          <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" title="Remove milestone" onClick={() => remove(i)}>
            <Trash2 />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={add}>
            <Plus /> Add milestone
          </Button>
          <Button size="sm" variant="ghost" onClick={generate} disabled={!grandTotal}>
            <Wand2 /> Generate plan
          </Button>
        </div>
        <p className="text-[12.5px] text-slate-500">
          Scheduled <span className="font-bold tabular-nums text-slate-800">{formatINR(scheduled)}</span>
          {rows.length > 0 && diff !== 0 && (
            <span className={cn('ml-2 font-semibold', diff > 0 ? 'text-amber-600' : 'text-red-600')}>
              {diff > 0 ? `${formatINR(diff)} unallocated` : `${formatINR(Math.abs(diff))} over total`}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
