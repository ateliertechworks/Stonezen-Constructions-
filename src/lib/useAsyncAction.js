import { useCallback, useRef, useState } from 'react'

/**
 * Runs a promise-returning action and tracks whether it is in flight or failed.
 *
 * Generating a PDF is the first thing in this app that is genuinely async — it
 * has to fetch the renderer before it can draw anything. Without this the
 * Download button looked inert for a second or two on mobile data and, worse,
 * a failure went nowhere at all: the promise rejected into an unhandled
 * rejection and the user simply never got a file.
 */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const inFlight = useRef(false)

  const run = useCallback(async (fn) => {
    // A second tap while the first is still working would render the document
    // twice and, on the share path, open two sheets.
    if (inFlight.current) return undefined
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      console.error('Stonezen: action failed', e)
      setError(e?.message || 'Something went wrong. Please try again.')
      return undefined
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [])

  const clear = useCallback(() => setError(null), [])

  return { busy, error, run, clear }
}
