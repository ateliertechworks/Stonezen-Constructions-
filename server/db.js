import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  // Fail at boot rather than at the first request. A container that starts and
  // then answers every login with a 500 is far harder to diagnose than one
  // that refuses to start with this line in its logs.
  console.error('FATAL: DATABASE_URL is not set.')
  process.exit(1)
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

pool.on('error', (err) => {
  // A pooled connection dropped while idle (Postgres restarted, network blip).
  // Logging keeps it out of an unhandled rejection; the pool makes a new one.
  console.error('postgres pool error', err.message)
})

export const query = (text, params) => pool.query(text, params)

/**
 * Applies the schema, retrying while Postgres finishes starting.
 *
 * Coolify starts the API and the database together, so the first few attempts
 * routinely fail with ECONNREFUSED. Retrying here is the difference between a
 * clean first deploy and one that needs a manual restart.
 */
export async function migrate({ attempts = 30, delayMs = 2000 } = {}) {
  const sql = await readFile(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8')
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query(sql)
      console.log('schema applied')
      return
    } catch (e) {
      if (i === attempts) throw e
      console.log(`waiting for postgres (${i}/${attempts}): ${e.message}`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
}
