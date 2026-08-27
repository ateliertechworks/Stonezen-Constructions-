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
    max: 5,
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
    throw Object.assign(new Error('DATABASE_URL is not configured'), { statusCode: 503 })
  }
  cached = isNeonUrl(url) ? neon(url) : localDriver(url)
  return cached
}

/** Small helper so handlers return consistent JSON. */
export function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  // Auth responses must never be cached by a CDN or the browser.
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).end(JSON.stringify(body))
}

/** Wraps a handler so thrown errors never leak stack traces or SQL to clients. */
export function withErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (err) {
      const status = err?.statusCode || 500
      if (status >= 500) console.error('[api]', err)
      send(res, status, {
        ok: false,
        error: status >= 500 ? 'Something went wrong. Please try again.' : err.message,
      })
    }
  }
}
