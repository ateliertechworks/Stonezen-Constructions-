import { AlertTriangle, X } from 'lucide-react'

/**
 * A dismissible banner for an action that failed after the user asked for it.
 *
 * Deliberately fixed to the bottom of the viewport: the buttons that raise it
 * live in a sidebar on desktop and a bottom bar on mobile, and an inline
 * message next to either one would be off-screen half the time.
 */
export default function ActionError({ action, className = '' }) {
  if (!action?.error) return null
  return (
    <div
      role="alert"
      className={`fixed inset-x-3 bottom-24 z-[70] mx-auto flex max-w-md items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800 shadow-lg sm:bottom-6 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{action.error}</span>
      <button
        type="button"
        onClick={action.clear}
        className="-mr-1 shrink-0 rounded p-1 text-red-500 hover:bg-red-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
