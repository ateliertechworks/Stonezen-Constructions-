import { formatINRCompact, formatINR } from '../lib/format'

/**
 * Chart parameters, validated with the dataviz palette validator against a
 * white card surface (see the palette reference). Categorical slots are
 * assigned in fixed order and never cycled; status colours are reserved.
 */
export const SERIES = {
  revenue: '#2a78d6', // categorical slot 1
  expense: '#eb6834', // categorical slot 2
  profit: '#1baf7a', // categorical slot 3
}

export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  neutral: '#64748b',
}

export const CHROME = {
  grid: '#e2e8f0',
  axis: '#94a3b8',
  ink: '#0f172a',
  surface: '#ffffff',
}

export const axisProps = {
  tick: { fill: CHROME.axis, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: CHROME.grid },
}

/** Shared tooltip — text stays in ink tokens, colour lives in the swatch. */
export function ChartTooltip({ active, payload, label, compact = false }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      {label && <p className="mb-1 text-[11px] font-bold text-slate-900">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-[11.5px] text-slate-600">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: p.color || p.payload?.fill }} />
          <span className="flex-1">{p.name}</span>
          <span className="font-bold tabular-nums text-slate-900">
            {compact ? p.value : formatINR(p.value)}
          </span>
        </p>
      ))}
    </div>
  )
}

export const compactTick = (v) => formatINRCompact(v).replace('₹', '')

/** Legend row — identity is never colour-alone, so every entry is labelled. */
export function Legend({ items, className = '' }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} />
          <span>{it.label}</span>
          {it.value !== undefined && <span className="font-bold tabular-nums text-slate-900">{it.value}</span>}
        </li>
      ))}
    </ul>
  )
}
