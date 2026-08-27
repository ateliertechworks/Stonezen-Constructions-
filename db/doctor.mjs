/**
 * Checks a database the way the API will, before a deploy depends on it.
 *
 *   npm run db:doctor                       # the local .env.local database
 *   DATABASE_URL='postgres://…' npm run db:doctor   # the one Vercel will use
 *
 * Answers the three questions a failing sign-in leaves open: can this database
 * be reached, has db/schema.sql been applied, and is there an account to sign
 * in with. It prints the host and database name so a localhost URL is obvious
 * at a glance, and never the user, the password or AUTH_SECRET.
 */
import { classifyDbError, getSql } from '../api/_lib/db.js'

const raw = process.env.DATABASE_URL
if (!raw) {
  console.error('DATABASE_URL is not set. Use `npm run db:doctor` (reads .env.local) or set it inline.')
  process.exit(1)
}

let where = '(unparseable DATABASE_URL)'
let loopback = false
try {
  const u = new URL(raw)
  const host = u.hostname.replace(/^\[|\]$/g, '')
  where = `${host}:${u.port || 5432}/${u.pathname.replace(/^\//, '')}`
  loopback = host === 'localhost' || host === '::1' || /^127\./.test(host)
} catch { /* reported as-is below */ }

console.log(`Target : ${where}`)

const TABLES = [
  'users', 'clients', 'projects', 'quotations', 'invoices',
  'payments', 'expenses', 'followups', 'activities', 'app_settings',
]

const fail = (msg, hint) => {
  console.error(`Result : FAILED — ${msg}`)
  if (hint) console.error(`Fix    : ${hint}`)
  process.exit(1)
}

let sql
try {
  sql = getSql()
  const present = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${TABLES})
  `
  const missing = TABLES.filter((t) => !present.some((r) => r.table_name === t))
  if (missing.length === TABLES.length) {
    fail('connected, but the schema has not been applied.', `psql "$DATABASE_URL" -f db/schema.sql`)
  }
  if (missing.length) {
    fail(`schema is incomplete — missing: ${missing.join(', ')}.`, `psql "$DATABASE_URL" -f db/schema.sql`)
  }

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM users`
  console.log(`Schema : all ${TABLES.length} tables present`)
  console.log(`Users  : ${count}`)
  if (count === 0) {
    fail('no account exists, so no one can sign in.', 'node db/seed-admin.mjs "Name" you@example.com \'a-strong-password\'')
  }

  console.log('Result : OK — this database can serve sign-in.')
  if (loopback) {
    console.log('Note   : this is a loopback address. It works locally and is unreachable from Vercel.')
  }
} catch (err) {
  const known = err?.statusCode ? err : classifyDbError(err)
  const hints = {
    db_unreachable: 'Check the host and port, and that the server accepts connections from here.',
    db_auth_failed: 'Check the user and password in DATABASE_URL.',
    database_missing: 'Create the database, or correct the name at the end of DATABASE_URL.',
    schema_missing: 'psql "$DATABASE_URL" -f db/schema.sql',
  }
  fail(known ? known.message : `unexpected error: ${err?.message || err}`, hints[known?.code])
} finally {
  await sql?.end?.()
}
