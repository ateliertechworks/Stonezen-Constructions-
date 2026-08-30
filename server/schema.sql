-- Stonezen OS server schema.
--
-- Two things live here and nothing else: the accounts that gate access, and
-- the CRM database itself as a single JSONB document.
--
-- Why one document rather than a table per entity: the browser store has
-- always serialised the whole database on every write, and the UI reads it
-- synchronously through useSyncExternalStore. Keeping that shape means the
-- 73 mutation call sites across the app stay untouched. JSONB (not TEXT) so
-- the data is still queryable from psql if it ever needs inspecting or
-- migrating to real tables later.

CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL DEFAULT '',
  email      TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'Staff',
  salt       TEXT        NOT NULL,
  hash       TEXT        NOT NULL,
  iterations INTEGER     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Only the hash of a recovery code is kept, never the code itself. That is
  -- the point of it: a code readable from storage would protect nothing.
  recovery_salt       TEXT,
  recovery_hash       TEXT,
  recovery_iterations INTEGER
);

-- Email is the login identity, so uniqueness must ignore case: signing up as
-- Owner@x.com and owner@x.com would otherwise create two accounts.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS app_state (
  id         INTEGER     PRIMARY KEY DEFAULT 1,
  version    BIGINT      NOT NULL DEFAULT 0,
  blob       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  -- One company, one database. The check makes a second row impossible rather
  -- than merely unusual, so a bug cannot quietly split the data in two.
  CONSTRAINT app_state_singleton CHECK (id = 1)
);

INSERT INTO app_state (id, version, blob)
VALUES (1, 0, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- The CREATE TABLE above only runs on a fresh database. These make the same
-- file safe to re-run against one that already has the tables, which is what
-- happens on every deploy.
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_salt       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_hash       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_iterations INTEGER;
