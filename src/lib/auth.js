/**
 * Local-only auth. There is no backend — credentials live in localStorage so a
 * single-device install of Stonezen OS still has a login gate and named user.
 */
const AUTH_KEY = 'stonezen_auth_v1'
const USERS_KEY = 'stonezen_users_v1'
const RESET_KEY = 'stonezen_reset_v1'

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

export function login(email, password) {
  const user = readUsers().find(
    (u) => u.email.toLowerCase() === String(email).trim().toLowerCase() && u.password === password,
  )
  if (!user) return { ok: false, error: 'Incorrect email or password.' }
  const session = { name: user.name, email: user.email, role: user.role, since: new Date().toISOString() }
  localStorage.setItem(AUTH_KEY, JSON.stringify(session))
  return { ok: true, session }
}

export function register({ name, email, password }) {
  const users = readUsers()
  if (users.some((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())) {
    return { ok: false, error: 'An account with that email already exists.' }
  }
  const user = { name, email: String(email).trim(), password, role: 'Staff' }
  writeUsers([...users, user])
  return login(user.email, password)
}

export function logout() {
  localStorage.removeItem(AUTH_KEY)
}

/** Issues a local reset token; in a hosted build this would be emailed. */
export function requestReset(email) {
  const user = readUsers().find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())
  if (!user) return { ok: false, error: 'No account found with that email.' }
  const token = Math.random().toString(36).slice(2, 8).toUpperCase()
  localStorage.setItem(RESET_KEY, JSON.stringify({ email: user.email, token, at: Date.now() }))
  return { ok: true, token, email: user.email }
}

export function resetPassword(token, password) {
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

export function updateProfile(patch) {
  const session = getSession()
  if (!session) return
  const users = readUsers().map((u) => (u.email === session.email ? { ...u, ...patch } : u))
  writeUsers(users)
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ...session, ...patch }))
}
