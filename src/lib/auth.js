/**
 * Server-backed auth.
 *
 * Accounts live in Postgres and are shared by every device, so signing in on a
 * phone reaches the same company as signing in on the office machine. What
 * stays in the browser is only the issued bearer token and a cached copy of
 * the signed-in user, which is what lets `getSession` and `isAuthenticated`
 * remain synchronous — `ProtectedRoute` and `Layout` read them during render
 * and cannot await.
 *
 * The cached session is a convenience, never an authority: it says who the
 * browser last signed in as, while the token is the only thing the server
 * trusts. A tampered cache gets an unchanged token and is refused server-side.
 */
import { get, post, request, setToken, getToken, ApiError } from './api'
import { stopSync } from './sync'

const AUTH_KEY = 'stonezen_auth_v1'

/* ------------------------------------------------------------- session */

function cacheSession(user, token) {
  if (token) setToken(token)
  const session = {
    name: user.name,
    email: user.email,
    role: user.role,
    since: new Date().toISOString(),
  }
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(session)) } catch { /* storage blocked */ }
  return session
}

export function getSession() {
  // No token means no session, whatever the cache says.
  if (!getToken()) return null
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null')
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return !!getSession()
}

export function logout() {
  // Stop syncing before the token goes, or the next scheduled push fires
  // without one and the user is told sync failed as they sign out.
  stopSync()
  setToken(null)
  try { localStorage.removeItem(AUTH_KEY) } catch { /* storage blocked */ }
}

/**
 * Confirms with the server that the stored token is still good.
 *
 * Called once on start-up. A token signed with a rotated AUTH_SECRET, or one
 * belonging to a deleted account, looks perfectly valid to the browser — only
 * the server can say otherwise. A network failure is deliberately not treated
 * as a rejection, so a brief outage does not sign the user out.
 */
export async function verifySession() {
  if (!getToken()) return null
  try {
    const { user } = await get('/auth/me')
    return cacheSession(user)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      logout()
      return null
    }
    return getSession()
  }
}

/* --------------------------------------------------------------- login */

const failure = (e) => ({
  ok: false,
  error: e instanceof ApiError ? e.message : 'Could not reach the server.',
})

export async function login(email, password) {
  try {
    const { token, user } = await post('/auth/login', { email, password })
    return { ok: true, session: cacheSession(user, token) }
  } catch (e) {
    return failure(e)
  }
}

/* ------------------------------------------------------------ register */

/**
 * Whether this install has no accounts at all, so the sign-up form should
 * offer to create the owner rather than refusing as closed.
 *
 * Asynchronous because only the server knows: unlike the old browser-only
 * build, a fresh browser is not a fresh install.
 */
export async function bootstrap() {
  try {
    return await get('/auth/bootstrap')
  } catch {
    return { needsFirstRunSetup: false, registrationOpen: false, unreachable: true }
  }
}

export async function needsFirstRunSetup() {
  return (await bootstrap()).needsFirstRunSetup === true
}

export async function isRegistrationOpen() {
  return (await bootstrap()).registrationOpen === true
}

export async function setRegistrationOpen(open) {
  try {
    await post('/auth/registration', { open: !!open })
    return { ok: true }
  } catch (e) {
    return failure(e)
  }
}

export async function register({ name, email, password }) {
  try {
    const { token, user } = await post('/auth/register', { name, email, password })
    // Adding a colleague while signed in must not replace your own session.
    if (getSession()) return { ok: true, user }
    return { ok: true, session: cacheSession(user, token) }
  } catch (e) {
    return failure(e)
  }
}

/* ------------------------------------------------------------ recovery */

export async function generateRecoveryCode() {
  try {
    const { code } = await post('/auth/recovery')
    return { ok: true, code }
  } catch (e) {
    return failure(e)
  }
}

export async function hasRecoveryCode() {
  try {
    return (await get('/auth/recovery')).hasRecoveryCode === true
  } catch {
    return false
  }
}

export async function resetPasswordWithCode(email, code, password) {
  try {
    const res = await post('/auth/reset', { email, code, password })
    return { ok: true, email: res.email }
  } catch (e) {
    return failure(e)
  }
}

/* ------------------------------------------------------------- profile */

export async function changePassword(currentPassword, newPassword) {
  try {
    await post('/auth/change-password', { currentPassword, newPassword })
    return { ok: true }
  } catch (e) {
    return failure(e)
  }
}

export async function updateProfile(patch) {
  const name = typeof patch?.name === 'string' ? patch.name : null
  if (name === null) return { ok: false, error: 'Nothing to update.' }
  try {
    const { user, token } = await request('/auth/profile', { method: 'PATCH', body: { name } })
    cacheSession(user, token)
    return { ok: true }
  } catch (e) {
    return failure(e)
  }
}

export async function listUsers() {
  try {
    return (await get('/auth/users')).users
  } catch {
    const s = getSession()
    return s ? [s] : []
  }
}
