import { cn, STAT_TONES } from '../../lib/utils'

/**
 * Phone-only condensation of a page's four stat cards.
 *
 * Same figures, one panel: a 2x2 grid of cards spends most of its height on
 * card chrome, while four labelled rows read faster on a narrow screen and
 * hand the list back most of the viewport. Mirrors the Financial Overview
 * panel on Projects — fixed 36px rows so the four scan as a column, icon
 * chips on a common left edge, right-aligned tabular values.
 *
 * Renders below sm only; the caller keeps its existing cards from sm up.
 */
export default function MobileOverview({ title, items, className }) {
  return (
    <section className={cn('mb-3 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-card sm:hidden', className)}>
      <h2 className="pb-0.5 text-[13px] font-semibold leading-4 text-slate-900">{title}</h2>
      <dl>
        {items.map(({ key, label, value, icon: Icon, tone, valueClass, ruled }) => (
          <div
            key={key}
            className={cn('flex h-8 items-center gap-2.5', ruled && 'border-t border-slate-100')}
          >
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', STAT_TONES[tone])}>
              <Icon className="h-4 w-4" />
            </span>
            <dt className={cn('min-w-0 flex-1 truncate text-[13px] text-slate-600', ruled && 'font-semibold text-slate-700')}>
              {label}
            </dt>
            <dd className={cn('shrink-0 text-[14px] font-bold tabular-nums', valueClass || 'text-slate-900')}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
