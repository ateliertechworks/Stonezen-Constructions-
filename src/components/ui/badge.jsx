import * as React from 'react'
import { cn } from '../../lib/utils'

export function Badge({ className, tone = 'slate', children, ...props }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    brand: 'bg-navy-50 text-brand border-navy-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-violet-50 text-violet-700 border-violet-200',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        tones[tone] || tones.slate,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
