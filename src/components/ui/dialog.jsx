import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

const DialogContent = React.forwardRef(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-1.5rem)] max-w-lg',
        'max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl animate-slide-up',
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-3.5 top-3.5 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }) => <div className={cn('mb-4 pr-6', className)} {...props} />
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-base font-bold text-slate-900', className)} {...props} />
))
DialogTitle.displayName = 'DialogTitle'
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('mt-1 text-sm text-slate-500', className)} {...props} />
))
DialogDescription.displayName = 'DialogDescription'
const DialogFooter = ({ className, ...props }) => (
  <div className={cn('mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
)

export {
  Dialog, DialogTrigger, DialogClose, DialogContent,
  DialogHeader, DialogTitle, DialogDescription, DialogFooter,
}
