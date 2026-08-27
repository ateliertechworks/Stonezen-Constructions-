/**
 * Authentication.
 *
 * Sign-in and registration go to the backend (`/api/auth/*`), which verifies a
 * scrypt hash in PostgreSQL and returns a signed session token. No password is
 * ever stored in the browser.
 *
 * `getSession` / `isAuthenticated` / `logout` stay synchronous so ProtectedRoute
 * and Layout keep working unchanged — only the two submit handlers await.
 *
 * In `npm run dev` (Vite alone, no serverless functions) the API is absent, so
 * login falls back to the original local check. That fallback is compiled out of
 * production builds: a deployed app is API-only.
 */
import { apiFetch, isApiUnavailable } from './api'

const AUTH_KEY = 'stonezen_auth_v1'
const USERS_KEY = 'stonezen_users_v1'
const RESET_KEY = 'stonezen_reset_v1'
const TOKEN_KEY = 'stonezen_token_v1'

const ALLOW_LOCAL_FALLBACK = import.meta.env.DEV

const DEFAULT_USER = {
  name: 'B. Dhanasundaran',
  email: 'stonezenconstructions@gmail.com',
  password: 'stonezen',
  role: 'Owner',
}

function readUsers() {
  try {
    const raw = JSON.parse(localStorage.getItem(USERS_KEY) || 'null')
    if (Array.isArray(raw) && raw.length) return raw
  } catch { /* fall through to default */ }
  localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_USER]))
  return [DEFAULT_USER]
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null')
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return !!getSession()
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function startSession({ user, token }) {
  const session = { name: user.name, email: user.email, role: user.role, since: new Date().toISOString() }
  localStorage.setItem(AUTH_KEY, JSON.stringify(session))
  if (token) localStorage.setItem(TOKEN_KEY, token)
  return session
}

/** Local sign-in used only as a dev fallback when no API is running. */
function localLogin(email, password) {
  const user = readUsers().find(
    (u) => u.email.toLowerCase() === String(email).trim().toLowerCase() && u.password === password,
  )
  if (!user) return { ok: false, error: 'Incorrect email or password.' }
  return { ok: true, session: startSession({ user }) }
}

export async function login(email, password) {
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    return { ok: true, session: startSession(data) }
  } catch (err) {
    if (ALLOW_LOCAL_FALLBACK && isApiUnavailable(err)) return localLogin(email, password)
    return { ok: false, error: err.message || 'Could not sign in. Please try again.' }
  }
}

export async function register({ name, email, password }) {
  try {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { name, email, password },
    })
    return { ok: true, session: startSession(data) }
  } catch (err) {
    if (ALLOW_LOCAL_FALLBACK && isApiUnavailable(err)) {
      const users = readUsers()
      if (users.some((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())) {
        return { ok: false, error: 'An account with that email already exists.' }
      }
      const user = { name, email: String(email).trim(), password, role: 'Staff' }
      writeUsers([...users, user])
      return { ok: true, session: startSession({ user }) }
    }
    return { ok: false, error: err.message || 'Could not create the account.' }
  }
}

export function logout() {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

const RESET_UNAVAILABLE =
  'Password resets are handled by your administrator — this build has no mail server. ' +
  'Ask them to reissue your password with db/seed-admin.mjs.'

/**
 * Dev-only self-service reset against the local user list.
 *
 * Once sign-in goes through PostgreSQL there is nothing here that could change
 * the real account, so rather than reporting a success that would not let you
 * log in, production says so plainly. The guard is a build-time constant, so
 * the local-user code below is dropped from the production bundle entirely.
 */
export function requestReset(email) {
  if (!ALLOW_LOCAL_FALLBACK) return { ok: false, error: RESET_UNAVAILABLE }

  const user = readUsers().find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())
  if (!user) return { ok: false, error: 'No account found with that email.' }
  const token = Math.random().toString(36).slice(2, 8).toUpperCase()
  localStorage.setItem(RESET_KEY, JSON.stringify({ email: user.email, token, at: Date.now() }))
  return { ok: true, token, email: user.email }
}

export function resetPassword(token, password) {
  if (!ALLOW_LOCAL_FALLBACK) return { ok: false, error: RESET_UNAVAILABLE }

  let pending = null
  try {
    pending = JSON.parse(localStorage.getItem(RESET_KEY) || 'null')
  } catch { /* ignore */ }
  if (!pending || pending.token !== String(token).trim().toUpperCase()) {
    return { ok: false, error: 'That reset code is not valid.' }
  }
  const users = readUsers().map((u) => (u.email === pending.email ? { ...u, password } : u))
  writeUsers(users)
  localStorage.removeItem(RESET_KEY)
  return { ok: true, email: pending.email }
}

/**
 * Updates the displayed session (sidebar name/role). The local user list is
 * only touched in dev; persisting a profile change to Postgres arrives with the
 * users endpoint in the next migration step.
 */
export function updateProfile(patch) {
  const session = getSession()
  if (!session) return
  if (ALLOW_LOCAL_FALLBACK) {
    writeUsers(readUsers().map((u) => (u.email === session.email ? { ...u, ...patch } : u)))
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ...session, ...patch }))
}
