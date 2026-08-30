import crypto from 'node:crypto'
import express from 'express'
import { migrate, query, pool } from './db.js'
import {
  requireAuth, requireOwner, issueToken, publicUser,
  findUserByEmail, countUsers, createUser, verifySecret, hashSecret,
} from './auth.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

// The whole CRM database arrives in one request body, so the default 100kb
// limit would reject a real company's data outright.
app.use(express.json({ limit: '25mb' }))

/* ----------------------------------------------------------------- cors */

// Explicit allowlist, not '*': these endpoints carry client records and GST
// invoices, and '*' would let any site on the internet read them from a
// signed-in user's browser.
const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean)

app.use((req, res, next) => {
  const origin = req.get('origin')
  if (origin && ALLOWED.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Vary', 'Origin')
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS')
    res.set('Access-Control-Max-Age', '86400')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && ALLOWED.includes(origin) ? 204 : 403)
  next()
})

/* ------------------------------------------------------------ throttle */

// A password guesser gets 10 tries per email per 15 minutes. In-memory is
// enough: there is one API container, and a restart costing an attacker their
// counter also costs them their progress.
const attempts = new Map()
const WINDOW_MS = 15 * 60_000
const MAX_ATTEMPTS = 10

function throttled(key) {
  const now = Date.now()
  const rec = attempts.get(key)
  if (!rec || now > rec.resetAt) return false
  return rec.count >= MAX_ATTEMPTS
}
function recordAttempt(key, failed) {
  const now = Date.now()
  const rec = attempts.get(key)
  if (!failed) return attempts.delete(key)
  if (!rec || now > rec.resetAt) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
  else rec.count += 1
}
// Unbounded growth would be a slow memory leak on a shared box.
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of attempts) if (now > v.resetAt) attempts.delete(k)
}, WINDOW_MS).unref()

/* -------------------------------------------------------------- health */

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1')
    res.json({ ok: true, db: true })
  } catch (e) {
    res.status(503).json({ ok: false, db: false, error: e.message })
  }
})

/* ---------------------------------------------------------------- auth */

const settingValue = async (key, fallback) => {
  const { rows } = await query('SELECT value FROM settings WHERE key = $1', [key])
  return rows.length ? rows[0].value : fallback
}

/** What the sign-in screen needs before anyone types anything. */
app.get('/api/auth/bootstrap', async (_req, res, next) => {
  try {
    res.json({
      needsFirstRunSetup: (await countUsers()) === 0,
      registrationOpen: (await settingValue('registration_open', false)) === true,
    })
  } catch (e) { next(e) }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })

    const key = String(email).trim().toLowerCase()
    if (throttled(key)) {
      return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' })
    }

    const user = await findUserByEmail(email)
    // One message for both branches, so this cannot be used to discover which
    // email addresses have accounts.
    const generic = { error: 'Incorrect email or password.' }
    if (!user || !(await verifySecret(password, user))) {
      recordAttempt(key, true)
      return res.status(401).json(generic)
    }

    recordAttempt(key, false)
    res.json({ token: issueToken(user), user: publicUser(user) })
  } catch (e) { next(e) }
})

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {}
    if (!email) return res.status(400).json({ error: 'Email is required.' })
    if (String(password || '').length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }

    const firstRun = (await countUsers()) === 0
    if (!firstRun) {
      // Closed by default. An open form on a public URL would let anyone who
      // finds the API create a working login into the company's books.
      const open = (await settingValue('registration_open', false)) === true
      if (!open) {
        return res.status(403).json({
          error: 'New accounts are closed. Ask the account owner to open registration in Settings → Security.',
        })
      }
    }

    if (await findUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with that email already exists.' })
    }

    const user = await createUser({ name, email, password, role: firstRun ? 'Owner' : 'Staff' })
    res.status(201).json({ token: issueToken(user), user: publicUser(user) })
  } catch (e) { next(e) }
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: { name: req.user.name, email: req.user.email, role: req.user.role } })
})

app.get('/api/auth/users', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT name, email, role FROM users ORDER BY id')
    res.json({ users: rows })
  } catch (e) { next(e) }
})

app.post('/api/auth/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    if (String(newPassword || '').length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }
    const user = await findUserByEmail(req.user.email)
    if (!user || !(await verifySecret(currentPassword, user))) {
      return res.status(401).json({ error: 'Your current password is not correct.' })
    }
    const { salt, hash, iterations } = await hashSecret(newPassword)
    await query('UPDATE users SET salt=$1, hash=$2, iterations=$3 WHERE id=$4', [salt, hash, iterations, user.id])
    res.json({ ok: true })
  } catch (e) { next(e) }
})

app.patch('/api/auth/profile', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim()
    if (!name) return res.status(400).json({ error: 'Name is required.' })
    // Only the display name. A profile edit must never be able to rewrite
    // credentials or promote the account to Owner.
    const { rows } = await query(
      'UPDATE users SET name=$1 WHERE lower(email)=lower($2) RETURNING name, email, role',
      [name, req.user.email],
    )
    if (!rows.length) return res.status(404).json({ error: 'Account not found.' })
    res.json({ ok: true, user: rows[0], token: issueToken(rows[0]) })
  } catch (e) { next(e) }
})

app.post('/api/auth/registration', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const open = req.body?.open === true
    await query(
      `INSERT INTO settings (key, value) VALUES ('registration_open', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(open)],
    )
    res.json({ ok: true, registrationOpen: open })
  } catch (e) { next(e) }
})

/**
 * Issues a recovery code for the signed-in account and returns it exactly once.
 *
 * There is no email server, so this is the only way back into an account whose
 * password is forgotten. Only the hash is stored, which is why a lost code has
 * to be replaced by generating a new one rather than looked up.
 */
app.post('/api/auth/recovery', requireAuth, async (req, res, next) => {
  try {
    // Crockford-ish alphabet: no O/0 or I/1 to mistype off a piece of paper.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = crypto.randomBytes(20)
    const code = [...bytes].map((b) => alphabet[b % alphabet.length]).join('').match(/.{1,5}/g).join('-')

    const { salt, hash, iterations } = await hashSecret(code)
    await query(
      'UPDATE users SET recovery_salt=$1, recovery_hash=$2, recovery_iterations=$3 WHERE lower(email)=lower($4)',
      [salt, hash, iterations, req.user.email],
    )
    res.json({ ok: true, code })
  } catch (e) { next(e) }
})

app.get('/api/auth/recovery', requireAuth, async (req, res, next) => {
  try {
    const user = await findUserByEmail(req.user.email)
    res.json({ hasRecoveryCode: !!user?.recovery_hash })
  } catch (e) { next(e) }
})

app.post('/api/auth/reset', async (req, res, next) => {
  try {
    const { email, code, password } = req.body || {}
    if (String(password || '').length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }
    const key = `reset:${String(email).trim().toLowerCase()}`
    if (throttled(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' })

    const user = await findUserByEmail(email)
    // One message for every failure, so this cannot be used to discover accounts.
    const generic = { error: 'That email and recovery code do not match.' }
    const record = user && user.recovery_hash
      ? { salt: user.recovery_salt, hash: user.recovery_hash, iterations: user.recovery_iterations }
      : null
    if (!record || !(await verifySecret(String(code || '').trim().toUpperCase(), record))) {
      recordAttempt(key, true)
      return res.status(401).json(generic)
    }

    recordAttempt(key, false)
    const { salt, hash, iterations } = await hashSecret(password)
    // A used code is spent, so a copied-down code cannot be replayed later.
    await query(
      `UPDATE users SET salt=$1, hash=$2, iterations=$3,
         recovery_salt=NULL, recovery_hash=NULL, recovery_iterations=NULL
       WHERE id=$4`,
      [salt, hash, iterations, user.id],
    )
    res.json({ ok: true, email: user.email })
  } catch (e) { next(e) }
})

/* --------------------------------------------------------------- state */

app.get('/api/state', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT version, blob, updated_at, updated_by FROM app_state WHERE id = 1')
    const row = rows[0] || { version: 0, blob: null }
    res.json({
      version: Number(row.version),
      blob: row.blob && Object.keys(row.blob).length ? row.blob : null,
      updatedAt: row.updated_at ?? null,
      updatedBy: row.updated_by ?? null,
    })
  } catch (e) { next(e) }
})

/**
 * Replaces the stored database, but only if the client was working from the
 * version that is currently stored.
 *
 * This check is the whole safety story for whole-document sync. Without it, a
 * device that had been offline would push its stale copy and silently erase
 * every change made on the other device. With it, that push is refused and the
 * client is handed the newer data to reconcile against.
 */
app.put('/api/state', requireAuth, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { version, blob } = req.body || {}
    if (typeof blob !== 'object' || blob === null || Array.isArray(blob)) {
      return res.status(400).json({ error: 'blob must be an object.' })
    }
    if (!Number.isInteger(version) || version < 0) {
      return res.status(400).json({ error: 'version must be a non-negative integer.' })
    }

    await client.query('BEGIN')
    // FOR UPDATE serialises two devices pushing at the same instant; without it
    // both could read the same version and both believe they were current.
    const { rows } = await client.query('SELECT version FROM app_state WHERE id = 1 FOR UPDATE')
    const current = Number(rows[0]?.version ?? 0)

    if (current !== version) {
      await client.query('ROLLBACK')
      const { rows: fresh } = await query('SELECT version, blob, updated_by FROM app_state WHERE id = 1')
      return res.status(409).json({
        error: 'The saved data changed on another device.',
        version: Number(fresh[0].version),
        blob: fresh[0].blob,
        updatedBy: fresh[0].updated_by,
      })
    }

    const next = current + 1
    await client.query(
      'UPDATE app_state SET version=$1, blob=$2, updated_at=now(), updated_by=$3 WHERE id = 1',
      [next, JSON.stringify(blob), req.user.email],
    )
    await client.query('COMMIT')
    res.json({ ok: true, version: next })
  } catch (e) {
    try { await client.query('ROLLBACK') } catch { /* already unwound */ }
    next(e)
  } finally {
    client.release()
  }
})

/* --------------------------------------------------------------- error */

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }))

app.use((err, _req, res, _next) => {
  // The message can contain connection strings and SQL; log it, never ship it.
  console.error('unhandled', err)
  res.status(500).json({ error: 'Server error.' })
})

/* ---------------------------------------------------------------- boot */

const port = Number(process.env.PORT || 8080)
migrate()
  .then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`stonezen api listening on ${port}`))
  })
  .catch((e) => {
    console.error('FATAL: could not apply schema', e)
    process.exit(1)
  })
