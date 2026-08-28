import React from 'react'
import { AlertTriangle, Download, RotateCcw } from 'lucide-react'

/**
 * Catches a render error instead of leaving a blank page.
 *
 * The business data lives only in this browser, so the recovery screen leads
 * with a backup button: someone staring at a crash needs a way to get their
 * records out before they try anything else. It reads localStorage directly
 * rather than importing the store, because the store is a plausible cause of
 * whatever just broke.
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Stonezen: render failed', error, info)
  }

  downloadBackup = () => {
    try {
      const raw = localStorage.getItem('stonezen_crm_v1') || '{}'
      const blob = new Blob([raw], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stonezen-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      console.error('Stonezen: backup failed', e)
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900">Something broke on this screen</h1>
              <p className="mt-1.5 text-[14px] text-slate-600">
                Your records are still saved in this browser — this is a display problem, not
                lost data. Download a backup first, then reload.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.downloadBackup}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Download backup
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reload the app
            </button>
          </div>

          <details className="mt-5">
            <summary className="cursor-pointer text-[12.5px] font-semibold text-slate-500 hover:text-slate-700">
              Technical details
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-[11.5px] leading-relaxed text-slate-100">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
