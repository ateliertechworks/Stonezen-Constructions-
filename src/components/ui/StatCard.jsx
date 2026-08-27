import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn, STAT_TONES as TONES } from '../../lib/utils'

export default function StatCard({ label, value, sub, icon: Icon, tone = 'brand', trend, className, onClick }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-card sm:p-3.5',
        onClick && 'transition-shadow hover:shadow-md hover:border-slate-300',
        className,
      )}
    >
      {Icon && (
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-lg font-bold tabular-nums text-slate-900 sm:text-xl">{value}</p>
        <div className="flex items-center gap-1">
          {typeof trend === 'number' && (
            <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold', trend >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {sub && <p className="truncate text-[11px] text-slate-400">{sub}</p>}
        </div>
      </div>
    </Comp>
  )
}
