import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../../lib/utils'

export default function PageHeader({ title, subtitle, backTo, backLabel = 'Back', actions, className, icon: Icon }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="mb-1 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-brand"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
        )}
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900 sm:text-xl">
          {Icon && <Icon className="h-5 w-5 text-brand shrink-0" />}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
