import * as React from 'react'
import { cn } from '../../lib/utils'

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[70px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm',
      'placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:border-brand',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export { Textarea }
