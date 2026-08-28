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

/**
 * A labelled form control.
 *
 * The label is bound to the control by id rather than sitting next to it: an
 * unassociated label is announced by nothing, and clicking it does not focus
 * the field. Field wraps a single control, so it can generate the id and hand
 * it down — a control that already carries its own id keeps it.
 */
export function Field({ label, hint, children, className, required, htmlFor }) {
  const generatedId = React.useId()
  const controlId = htmlFor || children?.props?.id || generatedId
  const hintId = hint ? `${controlId}-hint` : undefined

  const control =
    React.isValidElement(children) && !htmlFor
      ? React.cloneElement(children, {
          id: controlId,
          'aria-describedby':
            [children.props['aria-describedby'], hintId].filter(Boolean).join(' ') || undefined,
          ...(required && children.props['aria-required'] === undefined
            ? { 'aria-required': true }
            : {}),
        })
      : children

  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <Label htmlFor={controlId}>
          {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
        </Label>
      )}
      {control}
      {hint && (
        <p id={hintId} className="mt-1 text-[11px] text-slate-400">
          {hint}
        </p>
      )}
    </div>
  )
}

export { Label }
