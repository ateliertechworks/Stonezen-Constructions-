import { Inbox } from 'lucide-react'
import { cn } from '../../lib/utils'

export default function EmptyState({ icon: Icon = Inbox, title, message, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-[13px] text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
