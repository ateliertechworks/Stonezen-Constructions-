-- Stonezen OS — PostgreSQL schema
--
-- Mirrors the shapes in src/lib/store.js and src/lib/seed.js so existing records
-- migrate without reshaping. Primary keys are TEXT on purpose: the app issues
-- human-readable numbers (CL-2026-001, PRJ-2026-001, QT-2026-004 …) through
-- nextNumber()/peekNumber(), and those IDs are printed on documents and
-- referenced across records. Replacing them with serials would break that.
--
-- Money is NUMERIC(14,2) — never float. Totals are still computed by
-- src/lib/calc.js so the figures stay identical to the current app.
--
-- Apply with:  psql "$DATABASE_URL" -f db/schema.sql

BEGIN;

-- ---------------------------------------------------------------------- users
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  -- scrypt digest, format: scrypt$N$r$p$<salt_b64>$<hash_b64>. Never plaintext.
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'Staff'
                            CHECK (role IN ('Owner', 'Staff')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_email_lower_idx ON users (lower(email));

-- -------------------------------------------------------------------- clients
CREATE TABLE clients (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  company        TEXT,
  contact_person TEXT,
  email          TEXT,
  phone          TEXT,
  whatsapp       TEXT,
  address        TEXT,
  city           TEXT,
  pincode        TEXT,
  gstin          TEXT,
  status         TEXT NOT NULL DEFAULT 'Prospect'
                 CHECK (status IN ('Active', 'Prospect', 'Inactive')),
  notes          TEXT,
  created_date   DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clients_status_idx ON clients (status);

-- ------------------------------------------------------------------- projects
CREATE TABLE projects (
  id                  TEXT PRIMARY KEY,
  client_id           TEXT REFERENCES clients (id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  site_address        TEXT,
  description         TEXT,
  manager             TEXT,
  status              TEXT NOT NULL DEFAULT 'Planning'
                      CHECK (status IN ('Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled')),
  value               NUMERIC(14,2) NOT NULL DEFAULT 0,
  start_date          DATE,
  expected_completion DATE,
  actual_completion   DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_client_idx ON projects (client_id);
CREATE INDEX projects_status_idx ON projects (status);

-- ----------------------------------------------------------------- quotations
-- items / payment_schedule / blocks stay JSONB: they are ordered, free-form
-- document structures owned by the builder UI, not queried relationally.
CREATE TABLE quotations (
  id                 TEXT PRIMARY KEY,
  client_id          TEXT REFERENCES clients  (id) ON DELETE CASCADE,
  project_id         TEXT REFERENCES projects (id) ON DELETE SET NULL,
  title              TEXT,
  quotation_date     DATE,
  valid_until        DATE,
  status             TEXT NOT NULL DEFAULT 'Draft'
                     CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired')),
  site_address       TEXT,
  contact_number     TEXT,
  email              TEXT,
  gstin              TEXT,
  gst_enabled        BOOLEAN NOT NULL DEFAULT false,
  gst                NUMERIC(5,2)  NOT NULL DEFAULT 18,
  gst_type           TEXT NOT NULL DEFAULT 'intra' CHECK (gst_type IN ('intra', 'inter')),
  discount           NUMERIC(6,2)  NOT NULL DEFAULT 0,
  additional_charges NUMERIC(14,2) NOT NULL DEFAULT 0,
  auto_round_off     BOOLEAN NOT NULL DEFAULT true,
  round_off          NUMERIC(10,2) NOT NULL DEFAULT 0,
  terms              TEXT,
  notes              TEXT,
  items              JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_schedule   JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocks             JSONB,
  last_contact       DATE,
  next_followup      DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX quotations_client_idx  ON quotations (client_id);
CREATE INDEX quotations_project_idx ON quotations (project_id);
CREATE INDEX quotations_status_idx  ON quotations (status);

-- ------------------------------------------------------------------- invoices
CREATE TABLE invoices (
  id                 TEXT PRIMARY KEY,
  client_id          TEXT REFERENCES clients    (id) ON DELETE CASCADE,
  project_id         TEXT REFERENCES projects   (id) ON DELETE SET NULL,
  -- quotation deletion unlinks rather than cascades, matching deleteQuotation().
  quotation_id       TEXT REFERENCES quotations (id) ON DELETE SET NULL,
  invoice_date       DATE,
  due_date           DATE,
  status             TEXT NOT NULL DEFAULT 'Draft'
                     CHECK (status IN ('Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled')),
  billing_address    TEXT,
  shipping_address   TEXT,
  gstin              TEXT,
  gst_enabled        BOOLEAN NOT NULL DEFAULT false,
  gst                NUMERIC(5,2)  NOT NULL DEFAULT 18,
  gst_type           TEXT NOT NULL DEFAULT 'intra' CHECK (gst_type IN ('intra', 'inter')),
  discount           NUMERIC(6,2)  NOT NULL DEFAULT 0,
  additional_charges NUMERIC(14,2) NOT NULL DEFAULT 0,
  auto_round_off     BOOLEAN NOT NULL DEFAULT true,
  round_off          NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_terms      TEXT,
  notes              TEXT,
  items              JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocks             JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invoices_client_idx    ON invoices (client_id);
CREATE INDEX invoices_project_idx   ON invoices (project_id);
CREATE INDEX invoices_quotation_idx ON invoices (quotation_id);
CREATE INDEX invoices_status_idx    ON invoices (status);

-- ------------------------------------------------------------------- payments
CREATE TABLE payments (
  id           TEXT PRIMARY KEY,
  client_id    TEXT REFERENCES clients  (id) ON DELETE CASCADE,
  project_id   TEXT REFERENCES projects (id) ON DELETE SET NULL,
  -- invoice deletion unlinks the payment, matching deleteInvoice().
  invoice_id   TEXT REFERENCES invoices (id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  method       TEXT,
  reference    TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_client_idx  ON payments (client_id);
CREATE INDEX payments_invoice_idx ON payments (invoice_id);
CREATE INDEX payments_date_idx    ON payments (payment_date);

-- ------------------------------------------------------------------- expenses
CREATE TABLE expenses (
  id             TEXT PRIMARY KEY,
  project_id     TEXT REFERENCES projects (id) ON DELETE CASCADE,
  expense_date   DATE NOT NULL,
  description    TEXT NOT NULL,
  category       TEXT,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  vendor         TEXT,
  payment_method TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX expenses_project_idx  ON expenses (project_id);
CREATE INDEX expenses_category_idx ON expenses (category);
CREATE INDEX expenses_date_idx     ON expenses (expense_date);

-- ------------------------------------------------------------------ followups
-- Today follow-ups are derived in calc.js from quotation status + last_contact.
-- This table persists the explicit ones (logged contact, scheduled next step)
-- without duplicating quotation fields.
CREATE TABLE followups (
  id           BIGSERIAL PRIMARY KEY,
  quotation_id TEXT REFERENCES quotations (id) ON DELETE CASCADE,
  client_id    TEXT REFERENCES clients    (id) ON DELETE CASCADE,
  due_date     DATE,
  contacted_at DATE,
  channel      TEXT CHECK (channel IN ('WhatsApp', 'Email', 'Call', 'Meeting', 'Other')),
  status       TEXT NOT NULL DEFAULT 'Pending'
               CHECK (status IN ('Pending', 'Done', 'Snoozed')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX followups_quotation_idx ON followups (quotation_id);
CREATE INDEX followups_status_idx    ON followups (status, due_date);

-- ------------------------------------------------------- activity + settings
CREATE TABLE activities (
  id         BIGSERIAL PRIMARY KEY,
  text       TEXT NOT NULL,
  type       TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activities_occurred_idx ON activities (occurred_at DESC);

-- Single-row company profile / banking / document defaults, plus the numbering
-- counters that nextNumber() increments.
CREATE TABLE app_settings (
  id         BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  settings   JSONB NOT NULL DEFAULT '{}'::jsonb,
  counters   JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------- updated_at triggers
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','clients','projects','quotations','invoices',
    'payments','expenses','followups','app_settings'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', t, t);
  END LOOP;
END $$;

COMMIT;
