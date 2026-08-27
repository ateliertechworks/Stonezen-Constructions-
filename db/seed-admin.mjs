/**
 * Creates or updates the first Stonezen user with a securely hashed password.
 *
 *   npm run db:seed -- "B. Dhanasundaran" owner@example.com 'a-strong-password'
 *
 * (that script reads .env.local for DATABASE_URL; without it, pass the variable
 * yourself: DATABASE_URL=... node db/seed-admin.mjs "<name>" <email> <password>)
 *
 * Reads the password from argv[3] or, preferably, the ADMIN_PASSWORD env var so
 * it never lands in shell history. Never commit real credentials.
 */
import { getSql } from '../api/_lib/db.js'
import { hashPassword } from '../api/_lib/auth.js'

const [, , nameArg, emailArg, passArg] = process.argv
const name = nameArg || process.env.ADMIN_NAME
const email = emailArg || process.env.ADMIN_EMAIL
const password = passArg || process.env.ADMIN_PASSWORD

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}
if (!name || !email || !password) {
  console.error('Usage: DATABASE_URL=... node db/seed-admin.mjs "<name>" <email> <password>')
  console.error('   or set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD')
  process.exit(1)
}

// getSql() picks the Neon HTTP driver or a local `pg` pool from the URL, so
// this script seeds a hosted database and a local one with the same code.
const sql = getSql()
const password_hash = await hashPassword(password)

const rows = await sql`
  INSERT INTO users (name, email, password_hash, role)
  VALUES (${name}, ${email}, ${password_hash}, 'Owner')
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'Owner'
  RETURNING id, name, email, role
`
console.log('Owner account ready:', rows[0])

// The local `pg` pool keeps the event loop alive; Neon's HTTP driver has no
// connection to close and exposes no end().
await sql.end?.()
