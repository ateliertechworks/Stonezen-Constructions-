import crypto from 'node:crypto'
import { query } from './db.js'

const PBKDF2_ITERATIONS = 210_000
const SESSION_DAYS = 30

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error('FATAL: AUTH_SECRET must be set to at least 32 characters.')
  process.exit(1)
}
const SECRET = process.env.AUTH_SECRET

/* ------------------------------------------------------------- hashing */

const derive = (password, salt, iterations = PBKDF2_ITERATIONS) =>
  new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password), Buffer.from(salt, 'base64'), iterations, 32, 'sha256', (err, key) =>
      err ? reject(err) : resolve(key.toString('base64')),
    )
  })

export async function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('base64')
  return { salt, hash: await derive(secret, salt), iterations: PBKDF2_ITERATIONS }
}

export async function verifySecret(secret, record) {
  if (!record?.hash || !record?.salt) return false
  const got = await derive(secret, record.salt, record.iterations || PBKDF2_ITERATIONS)
  const a = Buffer.from(got)
  const b = Buffer.from(record.hash)
  // timingSafeEqual throws on a length mismatch, which would itself leak.
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/* -------------------------------------------------------------- tokens */

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url')

/**
 * A signed bearer token, verified without a server-side session table.
 *
 * Deliberately not a cookie: the SPA and the API are served from different
 * origins, and a cross-site cookie needs SameSite=None, which browsers only
 * honour with Secure — impossible while the test URLs are plain http. A bearer
 * token works identically on http and https, so the same code survives the
 * move to the real domain.
 */
export function issueToken(user) {
  const payload = {
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + SESSION_DAYS * 86_400_000,
  }
  const body = b64url(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

export function readToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const expected = sign(body)
  const a = Buffer.from(sig || '')
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

/* ---------------------------------------------------------- middleware */

/** Rejects the request unless it carries a valid bearer token. */
export function requireAuth(req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const session = token && readToken(token)
  if (!session) return res.status(401).json({ error: 'Not signed in.' })
  req.user = session
  next()
}

export function requireOwner(req, res, next) {
  if (req.user?.role !== 'Owner') return res.status(403).json({ error: 'Owner only.' })
  next()
}

/* --------------------------------------------------------------- users */

export const publicUser = (u) => ({ name: u.name, email: u.email, role: u.role })

export async function findUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [String(email).trim()])
  return rows[0] || null
}

export async function countUsers() {
  const { rows } = await query('SELECT count(*)::int AS n FROM users')
  return rows[0].n
}

export async function createUser({ name, email, password, role }) {
  const { salt, hash, iterations } = await hashSecret(password)
  const { rows } = await query(
    `INSERT INTO users (name, email, role, salt, hash, iterations)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [String(name || '').trim(), String(email).trim(), role, salt, hash, iterations],
  )
  return rows[0]
}
