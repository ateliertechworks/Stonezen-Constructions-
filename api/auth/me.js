/** GET /api/auth/me  (Authorization: Bearer <token>) -> { ok, user } */
import { getSql, send, withErrors } from '../_lib/db.js'
import { verifyToken, bearer, publicUser } from '../_lib/auth.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' })

  const payload = verifyToken(bearer(req))
  if (!payload) return send(res, 401, { ok: false, error: 'Session expired. Please sign in again.' })

  // Re-read the row so a deleted or role-changed user is reflected immediately
  // rather than trusting a token that may be up to a week old.
  const sql = getSql()
  const rows = await sql`SELECT id, name, email, role FROM users WHERE id = ${payload.sub} LIMIT 1`
  if (!rows.length) return send(res, 401, { ok: false, error: 'Account no longer exists.' })

  return send(res, 200, { ok: true, user: publicUser(rows[0]) })
})
