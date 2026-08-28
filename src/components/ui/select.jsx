import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm',
      'data-[placeholder]:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:opacity-50',
      '[&>span]:line-clamp-1 [&>span]:text-left',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

const SelectContent = React.forwardRef(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-[60] max-h-72 min-w-[9rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn('p-1', position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]')}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-7 pr-2 text-sm outline-none',
      'focus:bg-navy-50 focus:text-brand data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-1.5 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

const SelectLabel = ({ className, ...props }) => (
  <SelectPrimitive.Label className={cn('px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400', className)} {...props} />
)

/**
 * Convenience wrapper: options can be strings or {value,label} objects.
 *
 * `id` and the aria props are forwarded to the trigger so a surrounding Field
 * label actually points at something focusable.
 */
export function SimpleSelect({
  value, onValueChange, options = [], placeholder = 'Select…', className, disabled, id, ...aria
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={className} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.value
          const lab = typeof o === 'string' ? o : o.label
          return (
            <SelectItem key={val} value={val}>
              {lab}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel }
