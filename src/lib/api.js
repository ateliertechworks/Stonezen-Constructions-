/**
 * Thin fetch wrapper for the Stonezen backend.
 *
 * Only VITE_-prefixed variables reach the browser, and the only one used here
 * is a base URL. Credentials live exclusively on the server.
 */
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export const apiUrl = (path) => `${BASE}${path}`

/** Resolves to parsed JSON, or throws an Error carrying `status`. */
export async function apiFetch(path, { method = 'GET', body, token, signal } = {}) {
  const res = await fetch(apiUrl(path), {
    method,
    signal,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  let data = null
  let notJson = false
  try {
    data = await res.json()
  } catch {
    // Empty body, or an HTML page from the SPA fallback — i.e. nothing that
    // looks like our API answered.
    notJson = true
  }

  if (!res.ok || data?.ok === false) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    err.notJson = notJson
    throw err
  }
  return data
}

/**
 * True when there is no usable API behind this origin — as opposed to the API
 * answering with a real rejection like "wrong password".
 *
 * Covers all the ways a missing backend shows up:
 *   - TypeError            fetch never completed (server down, CORS)
 *   - 404 / 405            nothing mounted at the path (plain `vite` dev server)
 *   - 503                  handler ran but DATABASE_URL / AUTH_SECRET is missing
 *   - non-JSON body        SPA fallback returned index.html
 *
 * Callers must still gate this behind a dev-only flag: in production a missing
 * API is an outage to surface, never a reason to accept local credentials.
 */
export function isApiUnavailable(err) {
  if (err instanceof TypeError) return true
  if (err?.notJson) return true
  return err?.status === 404 || err?.status === 405 || err?.status === 503
}
