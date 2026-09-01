import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog'
import { Button } from './button'
import { cn } from '../../lib/utils'

export default function ConfirmDialog({
  open, onOpenChange, title = 'Are you sure?', description,
  confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, variant = 'destructive',
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          {/* A question that destroys nothing should not wear a warning icon —
              it trains the user to click through the ones that do. */}
          <div
            className={cn(
              'mb-3 flex h-10 w-10 items-center justify-center rounded-full',
              variant === 'destructive' ? 'bg-red-50' : 'bg-navy-50',
            )}
          >
            {variant === 'destructive' ? (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            ) : (
              <HelpCircle className="h-5 w-5 text-brand" />
            )}
          </div>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={() => {
              onConfirm?.()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
