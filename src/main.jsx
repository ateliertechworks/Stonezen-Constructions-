import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

/**
 * Registers the service worker that makes the app installable.
 *
 * Only in a production build: the dev server serves modules the worker's
 * caching would fight with. `serviceWorker` is undefined outside a secure
 * context, so this is also a no-op on a plain-http host — the optional chain
 * is what keeps that a silent skip rather than a boot error. Installability on
 * Android needs https; iOS "Add to Home Screen" works without it.
 */
if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker?.register('/sw.js').catch((e) => {
      console.warn('Stonezen: service worker registration failed', e)
    })
  })
}
