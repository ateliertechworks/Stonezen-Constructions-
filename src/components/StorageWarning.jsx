import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Tells the user when a change could not be saved.
 *
 * The store keeps working in memory when localStorage refuses a write — quota
 * exhausted, or storage blocked in a private window — so without this banner
 * the app looks like it is saving normally right up until the tab is closed
 * and the work disappears.
 */
export default function StorageWarning() {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const onFail = () => setFailed(true)
    window.addEventListener('stonezen:persist-failed', onFail)
    return () => window.removeEventListener('stonezen:persist-failed', onFail)
  }, [])

  if (!failed) return null

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[60] flex items-start justify-center gap-2 border-b border-red-300 bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-800"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Changes are not being saved — this browser&apos;s storage is full or blocked.
        Export a backup from Settings &rarr; Data before closing this tab.
      </span>
    </div>
  )
}
