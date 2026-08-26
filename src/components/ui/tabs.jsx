import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto max-w-full', className)}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-semibold text-slate-500 transition-all',
      'hover:text-slate-700 focus-visible:outline-none data-[state=active]:bg-white data-[state=active]:text-brand data-[state=active]:shadow-sm',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn('mt-4 focus-visible:outline-none', className)} {...props} />
))
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
