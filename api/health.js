/**
 * GET /api/health -> reports whether the function runtime, the database and the
 * signing key are in place. Useful to confirm a deployment is wired up without
 * exposing anything sensitive — it never echoes a connection string, a host or
 * a credential, only whether each piece is present and working.
 *
 * `status` is the one field to read:
 *   ready            everything the API needs is in place
 *   no_database_url  DATABASE_URL is not set on this deployment
 *   db_local_url     set to localhost, which a deployed function cannot reach
 *   db_unreachable   set, but nothing answers at that address
 *   db_auth_failed   the server rejected the configured credentials
 *   database_missing the server is up but has no such database
 *   schema_missing   connected, but db/schema.sql has not been applied
 *   no_auth_secret   AUTH_SECRET is missing or too short to sign sessions
 */
import { classifyDbError, getSql, send, withErrors } from './_lib/db.js'

export default withErrors(async (req, res) => {
  const hasAuthSecret = (process.env.AUTH_SECRET || '').length >= 16

  const out = {
    ok: true,
    status: 'ready',
    api: 'up',
    database: 'unknown',
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasAuthSecret,
  }

  try {
    const sql = getSql()
    // Touching `users` proves both reachability and that the schema is applied,
    // which are separate failures worth telling apart.
    const rows = await sql`SELECT count(*)::int AS users FROM users`
    out.database = 'connected'
    out.users = rows[0].users
  } catch (raw) {
    // Same classification a failing login goes through, so both report the
    // identical code — and a raw driver message never reaches the response.
    const err = raw?.statusCode ? raw : classifyDbError(raw)
    out.ok = false
    out.database = 'unavailable'
    out.status = err?.code || 'server_error'
    out.detail = err?.message || 'The database check failed. See the server log.'
    if (!err) console.error('[api] /api/health -> unclassified failure:', raw)
  }

  // A database can be perfect and sign-in still fail without a signing key.
  if (out.ok && !hasAuthSecret) {
    out.ok = false
    out.status = 'no_auth_secret'
    out.detail = 'AUTH_SECRET is missing or shorter than 16 characters.'
  }

  return send(res, out.ok ? 200 : 503, out)
})
