import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '../../lib/utils'

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-brand data-[state=unchecked]:bg-slate-300',
      className,
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitives.Root>
))
Switch.displayName = 'Switch'

export function SwitchRow({ label, hint, checked, onCheckedChange, className }) {
  return (
    <label className={cn('flex items-center justify-between gap-3 cursor-pointer py-1', className)}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}

export { Switch }
