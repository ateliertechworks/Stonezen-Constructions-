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

-- Site photographs, deliberately NOT part of the JSONB document above.
--
-- Everything in app_state is pushed and pulled whole on every change: a photo
-- living there would be re-uploaded 1.5s after any keystroke anywhere in the
-- app, re-downloaded by every 20s poll, and counted against the browser's
-- ~5MB localStorage quota. Photos are therefore addressed one at a time and
-- fetched only when a project is actually opened.
--
-- project_id is the CRM's own text id (PRJ-2026-27-003), not a foreign key:
-- projects live in the JSON document, so there is no row to reference.
CREATE TABLE IF NOT EXISTS project_photos (
  id          BIGSERIAL   PRIMARY KEY,
  project_id  TEXT        NOT NULL,
  caption     TEXT        NOT NULL DEFAULT '',
  stage       TEXT        NOT NULL DEFAULT 'Completed',
  taken_on    DATE,
  mime        TEXT        NOT NULL DEFAULT 'image/jpeg',
  width       INTEGER     NOT NULL DEFAULT 0,
  height      INTEGER     NOT NULL DEFAULT 0,
  bytes       INTEGER     NOT NULL DEFAULT 0,
  -- Two base64 payloads: a grid-sized thumbnail sent with the listing, and the
  -- full image fetched only when one is opened. Sending full images with the
  -- listing would make opening a project download several megabytes on site.
  thumb       TEXT        NOT NULL,
  data        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  TEXT
);

CREATE INDEX IF NOT EXISTS project_photos_project_idx
  ON project_photos (project_id, created_at DESC);

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

-- Added after the first deploy; harmless on a database that already has them.
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS stage    TEXT NOT NULL DEFAULT 'Completed';
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS taken_on DATE;
