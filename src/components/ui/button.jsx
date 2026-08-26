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
      size: {
        default: 'h-9 px-3.5 py-2 [&_svg]:size-4',
        sm: 'h-8 px-3 text-[13px] [&_svg]:size-3.5',
        xs: 'h-7 px-2.5 text-xs rounded-md [&_svg]:size-3.5',
        lg: 'h-11 px-6 text-base [&_svg]:size-5',
        icon: 'h-9 w-9 [&_svg]:size-4',
        iconSm: 'h-7 w-7 rounded-md [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
