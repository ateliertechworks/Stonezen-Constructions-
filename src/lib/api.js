/**
 * The single place the browser talks to the Stonezen API.
 *
 * The base URL is baked in at build time by Vite. An empty value means "same
 * origin", which is what a deployment behind one domain wants; a full origin
 * is used while the SPA and the API sit on separate generated hostnames.
 */
const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
export const API_BASE = String(RAW_BASE).replace(/\/+$/, '')

const TOKEN_KEY = 'stonezen_token_v1'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* storage blocked */ }
}

/** Raised so callers can tell "the server said no" from "the server is gone". */
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/**
 * Performs a request and returns the parsed body.
 *
 * A 401 clears the stored token: it means the token expired or was signed with
 * a secret the server no longer has, and keeping it would leave the app looping
 * on a session that can never succeed.
 */
export async function request(path, { method = 'GET', body, timeoutMs = 30_000, keepalive = false } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // Lets a final save survive the tab closing. Unlike sendBeacon, keepalive
      // still carries the Authorization header.
      keepalive,
      signal: controller.signal,
    })
  } catch (e) {
    // Offline, DNS failure, CORS rejection, or the abort above.
    throw new ApiError(
      e.name === 'AbortError' ? 'The server took too long to respond.' : 'Could not reach the server.',
      0,
      null,
    )
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  let parsed = null
  let malformed = false
  try { parsed = text ? JSON.parse(text) : null } catch { malformed = true }

  if (res.status === 401) setToken(null)

  if (!res.ok) {
    throw new ApiError(parsed?.error || `Request failed (${res.status}).`, res.status, parsed)
  }
  // A 200 whose body is not JSON is not this API answering. It means the base
  // URL points at the SPA's own origin, where the nginx SPA fallback returns
  // index.html for every unknown path — the exact failure a missing build-time
  // VITE_API_BASE_URL produces. Raising here is what stops it reaching callers
  // as a null they immediately dereference.
  if (malformed) {
    throw new ApiError('The server sent an unexpected response. Check VITE_API_BASE_URL.', 0, null)
  }
  return parsed
}

export const get = (path, opts) => request(path, { ...opts, method: 'GET' })
export const post = (path, body, opts) => request(path, { ...opts, method: 'POST', body })
export const put = (path, body, opts) => request(path, { ...opts, method: 'PUT', body })
export const patch = (path, body, opts) => request(path, { ...opts, method: 'PATCH', body })
export const del = (path, opts) => request(path, { ...opts, method: 'DELETE' })
