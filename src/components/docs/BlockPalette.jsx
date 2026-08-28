import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { BLOCK_TYPES, BLOCK_GROUPS } from './blocks'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

export default function BlockPalette({ onAdd, usedTypes = [], exclude = [], className }) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()

  const entries = Object.entries(BLOCK_TYPES)
    .filter(([type]) => !exclude.includes(type))
    .filter(([, def]) =>
      !term || def.label.toLowerCase().includes(term) || def.description.toLowerCase().includes(term),
    )

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search blocks…" className="h-8 pl-8 text-[13px]" />
      </div>

      {BLOCK_GROUPS.map((group) => {
        const items = entries.filter(([, d]) => d.group === group)
        if (!items.length) return null
        return (
          <div key={group}>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{group}</p>
            <div className="space-y-1">
              {items.map(([type, def]) => {
                const Icon = def.icon
                const used = usedTypes.includes(type)
                return (
                  <button
                    key={type}
                    onClick={() => onAdd(type)}
                    className="group flex w-full items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-brand/40 hover:bg-navy-50"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 group-hover:bg-brand group-hover:text-white">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-800">
                        {def.label}
                        {used && <span className="rounded bg-slate-100 px-1 text-[9px] font-bold text-slate-400">in use</span>}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] leading-tight text-slate-400">{def.description}</span>
                    </span>
                    <Plus className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-brand" />
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {!entries.length && <p className="py-6 text-center text-[13px] text-slate-400">No blocks match “{q}”.</p>}
    </div>
  )
}
