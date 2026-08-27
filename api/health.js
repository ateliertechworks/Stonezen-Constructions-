/**
 * GET /api/health -> reports whether the function runtime and the database are
 * reachable. Useful to confirm a Vercel deployment is wired to Postgres without
 * exposing anything sensitive — it never echoes the connection string.
 */
import { getSql, send, withErrors } from './_lib/db.js'

export default withErrors(async (req, res) => {
  const out = {
    ok: true,
    api: 'up',
    database: 'unknown',
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
  }
  try {
    const sql = getSql()
    const rows = await sql`SELECT count(*)::int AS users FROM users`
    out.database = 'connected'
    out.users = rows[0].users
  } catch (err) {
    out.ok = false
    out.database = 'unreachable'
    out.detail = err.statusCode === 503 ? 'DATABASE_URL not configured' : 'connection failed'
  }
  return send(res, out.ok ? 200 : 503, out)
})
