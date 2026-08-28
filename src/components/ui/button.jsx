import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-white hover:bg-brand-light shadow-sm',
        secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
        outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
        success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
        whatsapp: 'bg-[#25D366] text-white hover:bg-[#1eb959] shadow-sm',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      // Touch first: a finger needs roughly 40px, a mouse does not. Every size
      // is comfortable on a phone and tightens up from `sm` on, so dense tables
      // stay dense on a desktop without being unusable on site.
      size: {
        default: 'h-10 px-3.5 py-2 text-sm sm:h-9 [&_svg]:size-4',
        sm: 'h-9 px-3 text-[13px] sm:h-8 [&_svg]:size-3.5',
        xs: 'h-8 px-2.5 text-xs rounded-md sm:h-7 [&_svg]:size-3.5',
        lg: 'h-11 px-6 text-base [&_svg]:size-5',
        icon: 'h-10 w-10 sm:h-9 sm:w-9 [&_svg]:size-4',
        iconSm: 'h-9 w-9 rounded-md sm:h-7 sm:w-7 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

const ICON_SIZES = new Set(['icon', 'iconSm'])

/**
 * An icon-only button carries no text, so without an accessible name a screen
 * reader announces nothing but "button". These buttons already pass a `title`
 * for the hover tooltip, so it is promoted to the accessible name here rather
 * than repeated by hand at every call site.
 */
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  const needsName = ICON_SIZES.has(size) && !props['aria-label'] && !props['aria-labelledby']
  const labelled = needsName && typeof props.title === 'string'
    ? { ...props, 'aria-label': props.title }
    : props
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...labelled} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
