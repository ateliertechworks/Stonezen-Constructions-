import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

/**
 * Icon-chip palette shared by StatCard and by any page that renders the same
 * figures in a different shell — e.g. the mobile Financial Overview on
 * Projects. Kept here rather than in StatCard so importing it does not break
 * that file's fast-refresh boundary.
 */
export const STAT_TONES = {
  brand: 'bg-navy-50 text-brand',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-violet-50 text-violet-600',
}

export const NONE = '__none__'

/** Radix Select cannot hold an empty-string value; map null <-> sentinel. */
export const toSel = (v) => (v === null || v === undefined || v === '' ? NONE : String(v))
export const fromSel = (v) => (v === NONE ? '' : v)

export function download(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function sortBy(arr, key, dir = 'desc') {
  return [...arr].sort((a, b) => {
    const av = typeof key === 'function' ? key(a) : a[key]
    const bv = typeof key === 'function' ? key(b) : b[key]
    if (av === bv) return 0
    return (av > bv ? 1 : -1) * (dir === 'desc' ? -1 : 1)
  })
}
