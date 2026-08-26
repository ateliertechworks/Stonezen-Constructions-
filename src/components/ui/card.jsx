import * as React from 'react'
import { cn } from '../../lib/utils'

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('bg-white rounded-xl border border-slate-200 shadow-card', className)} {...props} />
))
Card.displayName = 'Card'

const CardHeader = ({ className, ...props }) => (
  <div className={cn('flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100', className)} {...props} />
)
const CardTitle = ({ className, ...props }) => (
  <h3 className={cn('text-sm font-bold text-slate-800', className)} {...props} />
)
const CardDescription = ({ className, ...props }) => (
  <p className={cn('text-xs text-slate-500', className)} {...props} />
)
const CardContent = ({ className, ...props }) => <div className={cn('p-4', className)} {...props} />
const CardFooter = ({ className, ...props }) => (
  <div className={cn('flex items-center gap-2 px-4 py-3 border-t border-slate-100', className)} {...props} />
)

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
