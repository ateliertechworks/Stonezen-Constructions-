/**
 * Password hashing and session tokens.
 *
 * Hashing uses Node's built-in scrypt — memory-hard, in the standard library,
 * and with no native module to fail at build time on Vercel. Stored format:
 *
 *   scrypt$N$r$p$<salt-base64>$<hash-base64>
 *
 * Parameters live in the string so cost can be raised later without
 * invalidating existing hashes.
 *
 * Session tokens are HMAC-SHA256 signed:  <payload-b64url>.<signature-b64url>
 * Signature is verified with timingSafeEqual before the payload is trusted.
 */
import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(_scrypt)

const N = 16384 // CPU/memory cost
const R = 8
const P = 1
const KEYLEN = 64

/* ------------------------------------------------------------------ hashing */

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters.'), { statusCode: 400 })
  }
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltB64, hashB64] = parts
  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  let actual
  try {
    actual = await scrypt(String(password), salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p),
    })
  } catch {
    return false
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/* ------------------------------------------------------------------- tokens */

const b64url = (buf) => Buffer.from(buf).toString('base64url')

function secret() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 16) {
    throw Object.assign(new Error('AUTH_SECRET is not configured'), { statusCode: 503 })
  }
  return s
}

function sign(payloadB64) {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url')
}

export function issueToken(user) {
  const ttl = Number(process.env.AUTH_TTL_SECONDS || 604800)
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + ttl,
  }
  const body = b64url(JSON.stringify(payload))
  return { token: `${body}.${sign(body)}`, expiresIn: ttl, user: publicUser(user) }
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  const expected = Buffer.from(sign(body))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null

  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

/** Strips password_hash — this shape is what the browser is allowed to see. */
export function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role }
}

export function bearer(req) {
  const h = req.headers?.authorization || ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}
