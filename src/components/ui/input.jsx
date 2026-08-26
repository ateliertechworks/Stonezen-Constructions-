import * as React from 'react'
import { cn } from '../../lib/utils'

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm transition-colors',
      'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:border-brand',
      'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

/** Number input that keeps an empty string editable instead of snapping to 0. */
const NumberInput = React.forwardRef(({ value, onValueChange, className, ...props }, ref) => (
  <Input
    ref={ref}
    type="number"
    inputMode="decimal"
    value={value === 0 && props['data-blank-zero'] ? '' : value}
    onChange={(e) => {
      const raw = e.target.value
      onValueChange?.(raw === '' ? 0 : Number(raw))
    }}
    className={cn('text-right tabular-nums', className)}
    {...props}
  />
))
NumberInput.displayName = 'NumberInput'

export { Input, NumberInput }
