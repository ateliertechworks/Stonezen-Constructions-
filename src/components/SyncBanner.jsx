import { useState, useSyncExternalStore } from 'react'
import { CloudOff, CloudUpload, AlertTriangle } from 'lucide-react'
import {
  watchSync, getSyncStatus, resolveUsingServer, resolveUsingLocal,
} from '../lib/sync'

/**
 * Shows what sync is doing, and stops everything when it needs a decision.
 *
 * A conflict is the one case that must not be a passive indicator. It means
 * two devices edited the same books, and whichever way it resolves, some work
 * is discarded — so it takes over the screen rather than sitting in a corner
 * waiting to be noticed.
 */
export default function SyncBanner() {
  const sync = useSyncExternalStore(watchSync, getSyncStatus, getSyncStatus)
  const [busy, setBusy] = useState(false)

  if (sync.status === 'conflict' && sync.conflict) {
    const choose = async (fn) => {
      setBusy(true)
      await fn()
      setBusy(false)
    }
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" role="alertdialog" aria-modal="true">
        <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">This data changed elsewhere</h2>
              <p className="mt-1 text-[13px] text-slate-600">
                Changes were saved{sync.conflict.updatedBy ? ` by ${sync.conflict.updatedBy}` : ''} on
                another device while you were working here. Keeping one copy will discard the other.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => choose(resolveUsingServer)}
              className="rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              Use the other device&rsquo;s copy (discard my changes here)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => choose(resolveUsingLocal)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-semibold text-slate-700 disabled:opacity-60"
            >
              Keep this device&rsquo;s copy (overwrite the other)
            </button>
          </div>
        </div>
      </div>
    )
  }

  const map = {
    syncing: { icon: CloudUpload, text: 'Saving…', tone: 'text-slate-500' },
    offline: { icon: CloudOff, text: 'Offline — changes saved on this device', tone: 'text-amber-700' },
    error: { icon: CloudOff, text: sync.error || 'Sync problem', tone: 'text-red-700' },
  }
  const entry = map[sync.status]
  if (!entry) return null
  const Icon = entry.icon

  return (
    <div
      // Clear of the mobile furniture: the tab bar owns the bottom 56px and a
      // page's action bar sits on top of that, so at `bottom-3` this pill
      // covered the Save and PDF buttons on every builder screen.
      className={`pointer-events-none fixed bottom-[116px] right-3 z-50 sm:bottom-3 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[12px] shadow-sm ${entry.tone}`}
      role="status"
      aria-live="polite"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {entry.text}
    </div>
  )
}
