import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog'
import { Button } from './button'

export default function ConfirmDialog({
  open, onOpenChange, title = 'Are you sure?', description,
  confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, variant = 'destructive',
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-600" />
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
