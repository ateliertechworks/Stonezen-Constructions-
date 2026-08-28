/**
 * Local-only auth. There is no backend — accounts live in localStorage so a
 * single-device install of Stonezen OS still has a login gate and a named user.
 *
 * What that does and does not protect:
 *
 *   Because every install keeps its own data in its own browser, someone who
 *   opens the app elsewhere gets an empty book, not this company's. The gate
 *   therefore guards *this device* — a shared laptop, an unlocked office
 *   machine — rather than a shared server. That is why passwords are hashed
 *   (a stored password is readable by anyone who opens devtools) and why the
 *   reset flow requires a recovery code instead of printing one on screen.
 */
const AUTH_KEY = 'stonezen_auth_v1'
const USERS_KEY = 'stonezen_users_v1'
const RECOVERY_KEY = 'stonezen_recovery_v1'
const OPEN_REG_KEY = 'stonezen_open_registration_v1'

/** Sessions do not live forever on a shared machine. */
const SESSION_DAYS = 30

const PBKDF2_ITERATIONS = 210000

/**
 * The demo account, seeded only in development.
 *
 * A deployed build must not ship a working password: the bundle is public, so
 * anyone could read it. In production an install with no accounts asks the
 * owner to create the first one instead — see `needsFirstRunSetup`.
 */
// Written as a conditional so the bundler drops the credential entirely from a
// production build rather than leaving it in the shipped source as dead code.
const DEFAULT_USER = import.meta.env.DEV
  ? {
      name: 'B. Dhanasundaran',
      email: 'stonezenconstructions@gmail.com',
      role: 'Owner',
      // Seeded in plain text, upgraded to a hash on the first successful login.
      password: 'stonezen',
    }
  : null

/* ------------------------------------------------------------- hashing */

const enc = new TextEncoder()

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n))
}

/** PBKDF2-SHA256. Returns the base64 digest for a password and salt. */
async function derive(password, saltB64, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return toB64(bits)
}

async function hashSecret(secret) {
  const salt = toB64(randomBytes(16))
  return { salt, hash: await derive(secret, salt), iterations: PBKDF2_ITERATIONS, algo: 'pbkdf2-sha256' }
}

/** Constant-time-ish comparison, so a wrong password does not leak its prefix. */
function safeEqual(a = '', b = '') {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifySecret(secret, record) {
  if (!record?.hash || !record?.salt) return false
  const got = await derive(secret, record.salt, record.iterations || PBKDF2_ITERATIONS)
  return safeEqual(got, record.hash)
}

/* --------------------------------------------------------------- users */

const sameEmail = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

/**
 * The stored user list, always containing the owner account.
 *
 * A browser holding a list written by an earlier build must still be able to
 * sign in, so the default is merged in rather than used only when the key is
 * missing. An account that already claims that email — including one whose
 * password has since been changed — is left alone.
 */
function readUsers() {
  let stored = []
  try {
    const raw = JSON.parse(localStorage.getItem(USERS_KEY) || 'null')
    if (Array.isArray(raw)) stored = raw.filter((u) => u && typeof u.email === 'string')
  } catch { /* corrupt or absent — start from the default */ }

  if (!DEFAULT_USER) return stored

  const hasDefault = stored.some((u) => sameEmail(u.email, DEFAULT_USER.email))
  const users = hasDefault ? stored : [DEFAULT_USER, ...stored]
  if (!hasDefault) writeUsers(users)
  return users
}

/**
 * True when this install has no accounts at all, so the sign-up form should
 * offer to create the owner rather than refusing as closed.
 */
export function needsFirstRunSetup() {
  return readUsers().length === 0
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

const publicUser = (u) => ({ name: u.name, email: u.email, role: u.role })

/* ------------------------------------------------------------- session */

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null')
    if (!s) return null
    if (s.expires && Date.now() > s.expires) {
      localStorage.removeItem(AUTH_KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return !!getSession()
}

function startSession(user) {
  const session = {
    ...publicUser(user),
    since: new Date().toISOString(),
    expires: Date.now() + SESSION_DAYS * 86400000,
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify(session))
  return session
}

export function logout() {
  localStorage.removeItem(AUTH_KEY)
}

/* --------------------------------------------------------------- login */

/**
 * Signs in, upgrading a legacy plain-text account to a hash on the way through.
 *
 * The upgrade has to happen here rather than at read time: hashing needs the
 * password, and this is the only moment we legitimately hold it.
 */
export async function login(email, password) {
  const users = readUsers()
  const user = users.find((u) => sameEmail(u.email, email))
  const generic = { ok: false, error: 'Incorrect email or password.' }
  if (!user) return generic

  if (user.hash) {
    if (!(await verifySecret(password, user))) return generic
  } else {
    // Legacy record written before hashing existed.
    if (!safeEqual(String(user.password ?? ''), String(password))) return generic
    const creds = await hashSecret(password)
    const upgraded = { ...user, ...creds }
    delete upgraded.password
    writeUsers(users.map((u) => (sameEmail(u.email, user.email) ? upgraded : u)))
  }

  return { ok: true, session: startSession(user) }
}

/* ------------------------------------------------------------ register */

/**
 * Whether strangers may create their own account.
 *
 * Closed by default: on a hosted deployment an open form would let anyone who
 * finds the URL create a working login. The owner opens it from
 * Settings → Security when they need to add staff.
 */
export function isRegistrationOpen() {
  try {
    return JSON.parse(localStorage.getItem(OPEN_REG_KEY) || 'false') === true
  } catch {
    return false
  }
}

export function setRegistrationOpen(open) {
  localStorage.setItem(OPEN_REG_KEY, JSON.stringify(!!open))
}

export async function register({ name, email, password }) {
  const users = readUsers()
  const signedIn = !!getSession()
  // The very first account on a fresh install is the owner claiming it.
  const firstRun = users.length === 0

  if (!signedIn && !firstRun && !isRegistrationOpen()) {
    return {
      ok: false,
      error: 'New accounts are closed. Ask the account owner to open registration in Settings → Security.',
    }
  }
  if (String(password || '').length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  if (users.some((u) => sameEmail(u.email, email))) {
    return { ok: false, error: 'An account with that email already exists.' }
  }

  const user = {
    name: String(name || '').trim(),
    email: String(email).trim(),
    role: firstRun ? 'Owner' : 'Staff',
    ...(await hashSecret(password)),
  }
  writeUsers([...users, user])

  // Adding a colleague while signed in must not sign you out of your own session.
  if (signedIn) return { ok: true, user: publicUser(user) }
  return { ok: true, session: startSession(user) }
}

/* ------------------------------------------------------------ recovery */

/**
 * Issues a recovery code for the signed-in account and returns it once.
 *
 * Only the hash is kept, so the code cannot be read back out of storage later —
 * which is the whole point. A lost code is replaced by generating a new one
 * while still signed in.
 */
export async function generateRecoveryCode() {
  const session = getSession()
  if (!session) return { ok: false, error: 'Sign in first.' }

  // Crockford-ish alphabet: no O/0 or I/1 to mistype off a piece of paper.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const raw = [...randomBytes(20)].map((b) => alphabet[b % alphabet.length]).join('')
  const code = raw.match(/.{1,5}/g).join('-')

  const store = readRecovery()
  store[session.email.toLowerCase()] = await hashSecret(code)
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(store))
  return { ok: true, code }
}

function readRecovery() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECOVERY_KEY) || '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

export function hasRecoveryCode(email) {
  const session = email || getSession()?.email
  return !!(session && readRecovery()[String(session).toLowerCase()])
}

/**
 * Resets a password against a recovery code.
 *
 * The previous build issued a token and rendered it on the reset screen, which
 * meant anyone who could reach the page could also read the code it was
 * checking. The secret now has to come from outside the app.
 */
export async function resetPasswordWithCode(email, code, password) {
  if (String(password || '').length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  const users = readUsers()
  const user = users.find((u) => sameEmail(u.email, email))
  const record = user && readRecovery()[user.email.toLowerCase()]

  // One message for every failure, so this cannot be used to discover accounts.
  const generic = { ok: false, error: 'That email and recovery code do not match.' }
  if (!user || !record) return generic
  if (!(await verifySecret(String(code).trim().toUpperCase(), record))) return generic

  const updated = { ...user, ...(await hashSecret(password)) }
  delete updated.password
  writeUsers(users.map((u) => (sameEmail(u.email, user.email) ? updated : u)))

  // A used code is spent.
  const store = readRecovery()
  delete store[user.email.toLowerCase()]
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(store))

  return { ok: true, email: user.email }
}

/* ------------------------------------------------------------- profile */

export async function changePassword(currentPassword, newPassword) {
  const session = getSession()
  if (!session) return { ok: false, error: 'Sign in first.' }
  if (String(newPassword || '').length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  const users = readUsers()
  const user = users.find((u) => sameEmail(u.email, session.email))
  if (!user) return { ok: false, error: 'Account not found.' }

  const ok = user.hash
    ? await verifySecret(currentPassword, user)
    : safeEqual(String(user.password ?? ''), String(currentPassword))
  if (!ok) return { ok: false, error: 'Your current password is not correct.' }

  const updated = { ...user, ...(await hashSecret(newPassword)) }
  delete updated.password
  writeUsers(users.map((u) => (sameEmail(u.email, user.email) ? updated : u)))
  return { ok: true }
}

export function updateProfile(patch) {
  const session = getSession()
  if (!session) return
  // Never let a profile edit rewrite credentials or escalate a role.
  const { name } = patch
  const safe = {}
  if (typeof name === 'string') safe.name = name

  writeUsers(readUsers().map((u) => (sameEmail(u.email, session.email) ? { ...u, ...safe } : u)))
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ...session, ...safe }))
}

export function listUsers() {
  return readUsers().map(publicUser)
}
