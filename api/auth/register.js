/** POST /api/auth/register  { name, email, password } -> { ok, token, user } */
import { getSql, send, withErrors } from '../_lib/db.js'
import { hashPassword, issueToken } from '../_lib/auth.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })

  const { name, email, password } = req.body || {}
  if (!name || !email || !password) {
    return send(res, 400, { ok: false, error: 'Name, email and password are required.' })
  }

  const sql = getSql()
  const clean = String(email).trim()

  const existing = await sql`SELECT 1 FROM users WHERE lower(email) = lower(${clean}) LIMIT 1`
  if (existing.length) {
    return send(res, 409, { ok: false, error: 'An account with that email already exists.' })
  }

  const password_hash = await hashPassword(password)
  const rows = await sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (${String(name).trim()}, ${clean}, ${password_hash}, 'Staff')
    RETURNING id, name, email, role
  `
  return send(res, 201, { ok: true, ...issueToken(rows[0]) })
})
