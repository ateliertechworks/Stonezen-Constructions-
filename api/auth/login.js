/** POST /api/auth/login  { email, password } -> { ok, token, user } */
import { getSql, send, withErrors } from '../_lib/db.js'
import { verifyPassword, issueToken } from '../_lib/auth.js'

export default withErrors(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' })

  const { email, password } = req.body || {}
  if (!email || !password) {
    return send(res, 400, { ok: false, error: 'Email and password are required.' })
  }

  const sql = getSql()
  const rows = await sql`
    SELECT id, name, email, role, password_hash
    FROM users
    WHERE lower(email) = lower(${String(email).trim()})
    LIMIT 1
  `

  // Same message and a real hash comparison either way, so response time and
  // wording don't reveal whether the address exists.
  const user = rows[0]
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA')

  if (!user || !ok) {
    return send(res, 401, { ok: false, error: 'Incorrect email or password.' })
  }

  return send(res, 200, { ok: true, ...issueToken(user) })
})
