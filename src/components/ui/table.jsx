import * as React from 'react'
import { cn } from '../../lib/utils'

export const TableWrap = ({ className, children }) => (
  <div className={cn('w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card', className)}>
    {children}
  </div>
)

export const Table = ({ className, ...props }) => (
  <table className={cn('w-full min-w-full caption-bottom text-sm', className)} {...props} />
)

export const THead = ({ className, ...props }) => (
  <thead className={cn('bg-slate-50 border-b border-slate-200', className)} {...props} />
)

export const TBody = ({ className, ...props }) => (
  <tbody className={cn('divide-y divide-slate-100', className)} {...props} />
)

export const TR = ({ className, ...props }) => (
  <tr className={cn('transition-colors hover:bg-slate-50/70', className)} {...props} />
)

export const TH = ({ className, ...props }) => (
  <th
    className={cn(
      'px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap',
      className,
    )}
    {...props}
  />
)

export const TD = ({ className, ...props }) => (
  <td className={cn('px-3 py-2.5 text-sm text-slate-700 align-middle', className)} {...props} />
)

export const TFoot = ({ className, ...props }) => (
  <tfoot className={cn('bg-slate-50 border-t-2 border-slate-200 font-semibold', className)} {...props} />
)
