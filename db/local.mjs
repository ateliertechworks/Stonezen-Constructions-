/**
 * Local Postgres, driven entirely by DATABASE_URL in .env.local.
 *
 *   npm run db:up      start (creating it the first time) the container
 *   npm run db:down    stop it — data survives in the named volume
 *   npm run db:schema  apply db/schema.sql
 *   npm run db:psql    open a psql shell
 *
 * The container's user / password / database name are read out of the same
 * DATABASE_URL the API uses, so there is exactly one place holding the local
 * credentials and the server and the database can never drift apart.
 *
 * Docker is used because it needs no root: a system Postgres install requires
 * sudo to create the role, this does not. Any other Postgres works too — point
 * DATABASE_URL at it and skip these scripts entirely.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NAME = 'stonezen-pg'
const VOLUME = 'stonezen-pgdata'
const IMAGE = 'postgres:16-alpine'

const die = (msg) => {
  console.error(msg)
  process.exit(1)
}

/** node --env-file only applies to the script it starts, so parse it here. */
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  let raw
  try {
    raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  } catch {
    die('No .env.local found. Copy .env.example to .env.local and set DATABASE_URL.')
  }
  const line = raw.split('\n').find((l) => l.trim().startsWith('DATABASE_URL='))
  if (!line) die('.env.local has no DATABASE_URL.')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

const url = new URL(databaseUrl())
const cfg = {
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ''),
  port: url.port || '5432',
}
if (!cfg.user || !cfg.password || !cfg.database) {
  die('DATABASE_URL must include a user, password and database name.')
}

const run = (args, opts = {}) => spawnSync('docker', args, { stdio: 'inherit', ...opts })
const quiet = (args) => spawnSync('docker', args, { encoding: 'utf8' })
const exists = () => quiet(['ps', '-aq', '-f', `name=^${NAME}$`]).stdout.trim() !== ''

const cmd = process.argv[2]

if (cmd === 'up') {
  if (exists()) {
    run(['start', NAME])
  } else {
    run([
      'run', '-d', '--name', NAME, '--restart', 'unless-stopped',
      '-e', `POSTGRES_USER=${cfg.user}`,
      '-e', `POSTGRES_PASSWORD=${cfg.password}`,
      '-e', `POSTGRES_DB=${cfg.database}`,
      '-p', `127.0.0.1:${cfg.port}:5432`,
      '-v', `${VOLUME}:/var/lib/postgresql/data`,
      IMAGE,
    ])
  }
  // The container reports ready a moment after `docker run` returns; without
  // this wait, a db:up && db:schema chain hits a refused connection.
  for (let i = 0; i < 30; i++) {
    if (quiet(['exec', NAME, 'pg_isready', '-U', cfg.user, '-d', cfg.database]).status === 0) {
      console.log(`Postgres ready on 127.0.0.1:${cfg.port} (database "${cfg.database}").`)
      process.exit(0)
    }
    spawnSync('sleep', ['0.5'])
  }
  die('Container started but Postgres never became ready. Check: docker logs ' + NAME)
}

if (cmd === 'down') process.exit(run(['stop', NAME]).status ?? 0)

if (cmd === 'psql') {
  process.exit(run(['exec', '-it', NAME, 'psql', '-U', cfg.user, '-d', cfg.database]).status ?? 0)
}

if (cmd === 'schema') {
  const sql = readFileSync(resolve(ROOT, 'db/schema.sql'))
  const r = run(
    ['exec', '-i', NAME, 'psql', '-U', cfg.user, '-d', cfg.database, '-v', 'ON_ERROR_STOP=1'],
    { input: sql, stdio: ['pipe', 'inherit', 'inherit'] },
  )
  process.exit(r.status ?? 0)
}

die('Usage: node db/local.mjs <up|down|psql|schema>')
