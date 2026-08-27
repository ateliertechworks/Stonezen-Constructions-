/**
 * Postgres connection for the API handlers.
 *
 * Two drivers, one interface. Handlers only ever write
 *
 *   const rows = await sql`SELECT … WHERE id = ${id}`
 *
 * and get an array of rows back, so which driver is underneath never leaks
 * into a handler:
 *
 *   - Neon (production / Vercel). `@neondatabase/serverless` over HTTP, not a
 *     TCP pool: serverless invocations are short-lived and a classic pool
 *     would exhaust Postgres connections under concurrency. Each call is a
 *     stateless HTTPS request.
 *
 *   - Any other Postgres (a local server, Docker, a self-hosted box). Neon's
 *     HTTP driver cannot speak the wire protocol to those, so `pg` is used
 *     with a small pool and wrapped in the same tagged-template shape.
 *
 * The choice is made from the host in DATABASE_URL — no extra env var to keep
 * in sync, and nothing to change when deploying.
 *
 * DATABASE_URL is read from the server-side environment ONLY. It is never
 * prefixed VITE_, so Vite cannot inline it into the browser bundle.
 */
import { neon } from '@neondatabase/serverless'
import pg from 'pg'

let cached = null

/** Neon's HTTP driver only works against Neon-hosted endpoints. */
function isNeonUrl(url) {
  try {
    return /(^|\.)neon\.(tech|build)$/i.test(new URL(url).hostname)
  } catch {
    return false
  }
}

/** localhost, 127.0.0.0/8, ::1 — reachable only from the machine itself. */
function isLoopbackUrl(url) {
  try {
    const h = new URL(url).hostname.replace(/^\[|\]$/g, '')
    return h === 'localhost' || h === '::1' || /^127\./.test(h)
  } catch {
    return false
  }
}

/**
 * Tagged-template wrapper over a `pg` pool that returns rows, matching what
 * `neon()` hands back — including being callable synchronously, so `getSql()`
 * keeps its existing signature and no handler changes. Values interpolated
 * into the template become $1, $2 … bound parameters: the SQL text is built
 * only from the static string parts, so interpolation cannot inject SQL.
 */
function localDriver(url) {
  const pool = new pg.Pool({
    connectionString: url,
    // Every warm serverless instance holds its own pool, so a generous size
    // multiplies across concurrent invocations and exhausts the server's
    // connection slots. One connection per instance is the safe shape there;
    // a long-lived dev server can keep a few.
    max: process.env.VERCEL ? 1 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  // An idle-client error (server restart, dropped socket) is emitted on the
  // pool; without a listener Node treats it as an unhandled 'error' event and
  // takes the process down.
  pool.on('error', (err) => console.error('[db] idle client error:', err.message))

  const sql = async (strings, ...values) => {
    const text = strings.reduce((acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''), '')
    const { rows } = await pool.query(text, values)
    return rows
  }
  sql.end = () => pool.end()
  return sql
}

/** Resolves the driver once and caches it, so one pool is shared per process. */
export function getSql() {
  if (cached) return cached
  const url = process.env.DATABASE_URL
  if (!url) {
    throw configError('no_database_url', 'The server has no database configured.')
  }
  // A serverless function has its own loopback: a localhost URL copied from a
  // developer's .env.local can never reach that developer's database. Left to
  // the driver this surfaces ten seconds later as a generic connection
  // failure, so name it up front — it is the single most common way a working
  // local setup fails once deployed.
  if (process.env.VERCEL && isLoopbackUrl(url)) {
    throw configError(
      'db_local_url',
      'This deployment is pointed at a database on localhost, which only exists on the developer machine. Point DATABASE_URL at a hosted Postgres.',
    )
  }
  cached = isNeonUrl(url) ? neon(url) : localDriver(url)
  return cached
}

/**
 * A deployment problem — not the caller's fault and not a bug to hide.
 *
 * These carry a stable `code` so the client can tell "this deployment is not
 * finished being set up" apart from "your password was wrong", and so a
 * deployed site can be diagnosed from the response alone. The messages
 * describe the *state* of the deployment only: never a host, a connection
 * string, a credential, or a stack trace.
 */
export function configError(code, message) {
  return Object.assign(new Error(message), { statusCode: 503, code })
}

/**
 * Turns a driver-level failure into one of those.
 *
 * Every one of these used to surface as the same opaque 500, which made a
 * misconfigured deployment indistinguishable from a genuine crash — the whole
 * reason a broken login was impossible to diagnose from the browser.
 *
 * `err.code` is a Postgres SQLSTATE for query failures and a Node syscall name
 * for connection failures; Neon's HTTP driver reports network trouble as a
 * fetch TypeError instead, hence the message check.
 */
export function classifyDbError(err) {
  const code = err?.code
  switch (code) {
    case '42P01': // undefined_table
      return configError('schema_missing', 'The database is reachable but the schema has not been applied yet.')
    case '3D000': // invalid_catalog_name
      return configError('database_missing', 'The configured database does not exist on the server.')
    case '28P01': // invalid_password
    case '28000': // invalid_authorization_specification
      return configError('db_auth_failed', 'The database rejected the configured credentials.')
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
    case 'ETIMEDOUT':
    case 'ECONNRESET':
    case 'EHOSTUNREACH':
      return configError('db_unreachable', 'The database is not reachable at the configured address.')
    default:
      break
  }
  // Neon's HTTP driver: a failed fetch, not a Postgres reply.
  if (err instanceof TypeError && /fetch/i.test(err.message || '')) {
    return configError('db_unreachable', 'The database is not reachable at the configured address.')
  }
  return null
}

/** Small helper so handlers return consistent JSON. */
export function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  // Auth responses must never be cached by a CDN or the browser.
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).end(JSON.stringify(body))
}

/**
 * Wraps a handler so thrown errors never leak stack traces or SQL to clients,
 * while still saying something true and actionable.
 *
 * Three outcomes:
 *   4xx  the caller's own error, echoed as-is ("Incorrect email or password.")
 *   503  a deployment that is not finished — specific message plus a `code`
 *   500  a genuine bug — stays generic; the detail goes to the server log only
 */
export function withErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (raw) {
      const err = raw?.statusCode ? raw : classifyDbError(raw) || raw
      const status = err?.statusCode || 500

      // A classified failure explains itself safely; anything else is a bug and
      // keeps the generic text so no internals reach the browser.
      const explained = Boolean(err.code) || status < 500

      if (status >= 500) {
        // Logged for the operator (Vercel → Deployment → Logs). The request
        // body is never touched here: it holds the password.
        const where = `${req.method} ${req.url?.split('?')[0] || ''}`
        console.error(`[api] ${where} -> ${status} ${err.code || 'server_error'}: ${raw?.message || raw}`)
        if (!err.code) console.error(raw)
      }

      send(res, status, {
        ok: false,
        error: explained ? err.message : 'Something went wrong. Please try again.',
        ...(err.code ? { code: err.code } : {}),
      })
    }
  }
}
