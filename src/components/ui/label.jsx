import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '../../lib/utils'

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-[12px] font-semibold text-slate-600 leading-none block mb-1.5', className)}
    {...props}
  />
))
Label.displayName = 'Label'

export function Field({ label, hint, children, className, required }) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <Label>
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

export { Label }
