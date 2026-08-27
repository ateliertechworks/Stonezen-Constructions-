# Stonezen OS

Construction business management for **Stonezen Constructions** (ER. B. Dhanasundaran,
Building Consultant & Contractor, Coimbatore).

Runs the full lifecycle in one place: **Clients → Projects → Quotations → Invoices →
Payments → Expenses**, with a drag-and-drop document builder, GST-aware totals,
print-quality PDFs and WhatsApp/email follow-up tools.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

`npm run dev` serves the SPA **and** the `api/` handlers on one origin — a small
dev-only Vite middleware (`vite.config.js`) maps `/api/*` to the same files
Vercel runs as serverless functions, so dev and production exercise identical
code. `vercel dev` also works and bypasses the middleware.

Set `DATABASE_URL` in `.env.local` to develop against a real database. Without
it the API returns 503 and sign-in falls back to the local demo account. See
[Local database](#local-database) to bring one up in a minute.

Demo login (pre-filled on the sign-in screen) works in `npm run dev` only —
production builds authenticate against PostgreSQL:

```
stonezenconstructions@gmail.com / stonezen
```

## Authentication

Sign-in and registration go through the backend:

```
Sign In → POST /api/auth/login → Postgres user lookup
        → scrypt verify → signed session token → Dashboard
```

- Passwords are hashed with **scrypt** (Node stdlib, no native build step) and
  stored as `scrypt$N$r$p$salt$hash`. Plaintext is never stored or logged.
- Sessions are HMAC-SHA256 signed tokens, verified with `timingSafeEqual` and
  carrying an expiry (`AUTH_TTL_SECONDS`, default 7 days).
- Unknown email and wrong password return the *same* message, and an unknown
  email still runs a hash comparison, so responses don't leak which addresses exist.
- `getSession` / `isAuthenticated` / `logout` stay synchronous, so `ProtectedRoute`
  and the layout are unchanged; only the two submit handlers await.
- In `npm run dev` with no API running, sign-in falls back to the old local check
  so the app still boots. That branch is a build-time constant and is **compiled
  out of production bundles** — a deployed app is API-only.

Create the first account:

```bash
npm run db:seed -- "B. Dhanasundaran" owner@example.com 'a-strong-password'
```

## Database

Schema lives in `db/schema.sql` (users, clients, projects, quotations, invoices,
payments, expenses, followups, activities, app_settings) with foreign keys,
`NUMERIC(14,2)` money columns and `updated_at` triggers. Primary keys are `TEXT`
on purpose — the app issues human-readable numbers (`CL-2026-001`, `PRJ-2026-001`)
that are printed on documents and cross-referenced between records.

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

`api/_lib/db.js` picks its driver from the host in `DATABASE_URL`, so the same
handlers run against either kind of database:

- **Neon** (production/Vercel) — `@neondatabase/serverless` over HTTP, not a TCP
  pool: serverless invocations are short-lived and a pool would exhaust Postgres
  connections.
- **Any other Postgres** (local, Docker, self-hosted) — `pg` with a small pool,
  wrapped in the same tagged-template interface. Neon's HTTP driver cannot speak
  the wire protocol to those.

`GET /api/health` reports whether the function runtime and database are reachable
without echoing any credentials.

### Local database

Docker is used because it needs no root — installing a system Postgres means
`sudo` to create the role. The container's user, password, database and port are
all read from `DATABASE_URL` in `.env.local`, so there is one place to change.

```bash
npm run db:up      # start Postgres 16 on 127.0.0.1:5433 (creates it first time)
npm run db:schema  # apply db/schema.sql
npm run db:seed -- "Your Name" you@example.com 'a-strong-password'
npm run dev        # sign in against the database
npm run db:psql    # psql shell
npm run db:down    # stop it — data survives in the stonezen-pgdata volume
```

Already have a Postgres you like? Point `DATABASE_URL` at it, apply the schema
with `psql`, and skip these scripts entirely.

Check the wiring at any time — locally or against a deployment:

```bash
npm run db:doctor                 # can this database serve sign-in?
curl -s localhost:5173/api/health # {"ok":true,"status":"ready",…}
```

### When sign-in fails

`/api/health` and a failed sign-in report the same `status` / `code`, so one
request identifies the problem without reading any logs:

| code | meaning | fix |
|---|---|---|
| `no_database_url` | `DATABASE_URL` is not set on that deployment | set it in Vercel → Settings → Environment Variables, then redeploy |
| `db_local_url` | it points at `localhost` | **Vercel cannot reach your machine.** Point it at a hosted Postgres (Neon) |
| `db_unreachable` | nothing answers at that address | check host/port and that the server accepts external connections |
| `db_auth_failed` | wrong database user or password | check the credentials inside `DATABASE_URL` |
| `database_missing` | the server has no such database | create it, or fix the name at the end of the URL |
| `schema_missing` | connected, but no tables | `psql "$DATABASE_URL" -f db/schema.sql` |
| `no_auth_secret` | `AUTH_SECRET` missing or under 16 chars | set it in the same place, then redeploy |

A wrong password stays a plain `401 Incorrect email or password.` — it carries
no `code`, so a real rejection is never confused with a broken deployment.

### Deploying

Vercel runs each `api/` file as a serverless function with its own loopback
interface, so a `localhost` database is unreachable from it no matter what is
in `.env.local`. A deployment needs:

1. A **hosted** Postgres — Neon's pooled connection string, `?sslmode=require`.
2. The schema applied to it: `psql "$DATABASE_URL" -f db/schema.sql`.
3. An account seeded in it: `DATABASE_URL='…' node db/seed-admin.mjs "Name" you@example.com 'password'`.
4. `DATABASE_URL` and `AUTH_SECRET` set in Vercel → Settings → Environment
   Variables (Production **and** Preview), then a redeploy — environment
   changes do not apply to already-built deployments.

Confirm 1–3 before deploying with `DATABASE_URL='…' npm run db:doctor`, and
confirm 4 afterwards with `curl -s https://your-app.vercel.app/api/health`.

### Configuration

Copy `.env.example` to `.env.local`; on Vercel set the same keys under
Project → Settings → Environment Variables.

| Variable | Where it lives | Notes |
|---|---|---|
| `DATABASE_URL` | server only | Neon **pooled** string with `?sslmode=require`, or any Postgres URL (e.g. `postgresql://user:pass@127.0.0.1:5433/stonezen`) |
| `AUTH_SECRET` | server only | token signing key; `openssl rand -base64 48` |
| `AUTH_TTL_SECONDS` | server only | session lifetime, default `604800` |
| `VITE_API_BASE_URL` | client (public) | blank = same-origin `/api` |

Only `VITE_`-prefixed variables reach the browser. `DATABASE_URL` and
`AUTH_SECRET` must never be given that prefix. `.env*` is gitignored.

## How it stores data

CRM records currently live in `localStorage` under `stonezen_crm_v1`. The store
(`src/lib/store.js`) exposes `getState`/`subscribe`/`setState` and is read through
`useSyncExternalStore`, so every screen updates the moment a record changes.

Authentication has moved to PostgreSQL; the CRM entities have a matching schema
ready and migrate next, table by table, behind the same store interface.

**Settings → Data** exports a JSON backup, imports one back, restores the sample
dataset, or clears everything. Export regularly: clearing browser site data wipes it.

## What's in it

| Area | What it does |
|---|---|
| **Dashboard** | Revenue/profit/pipeline KPIs, revenue-vs-expense chart, payment and project status donuts, activity feed |
| **Clients** | Card or table view, contact actions, per-client hub with Overview / Projects / Quotations / Invoices / **Ledger** / Payments tabs |
| **Projects** | Contract value vs collections vs expenses, live profit and margin, linked documents, site expense register |
| **Quotations** | Three-panel builder — details + line items + GST/totals + milestone schedule, drag-and-drop layout, block palette, live preview |
| **Invoices** | Same builder for billing; converts from a quotation in one click; tracks paid/balance and derived status |
| **Payments / Expenses** | Ledgers that feed invoice balances, project profit and the accounts view |
| **Accounts** | Monthly trend, expense breakdown, GST summary (CGST/SGST/IGST), outstanding receivables, CSV export |
| **Follow-ups** | Sent quotations ranked by how long they've been quiet, with ready-written WhatsApp and email messages |
| **Documents** | Every quotation and invoice in one list, each downloadable as PDF |
| **Settings** | Company profile and logo, banking details, numbering prefixes, document defaults, data tools |

## Documents and PDFs

A document is an ordered list of **blocks** (letterhead, client details, items table,
totals, payment schedule, notes, terms, bank info, signature, plus free heading/text/
divider/spacer). Reorder them by dragging, toggle visibility, duplicate, or edit each
block's properties. The layout is saved with the record.

PDFs are produced by writing a self-contained HTML document into a hidden iframe and
calling `window.print()` (`src/lib/pdf.js`). `html2canvas` is deliberately avoided —
it cannot resolve Tailwind's colour tokens and renders blank or mis-coloured pages.
The print route gives crisp, selectable, correctly paginated A4 output, and the
document is pinned to `color-scheme: light` so a viewer in dark mode still gets a
white page.

## Money and tax

`src/lib/calc.js` is the single source of truth for every figure:

- Subtotal → discount → taxable → GST → additional charges → round-off → grand total
- **Intra-state** splits GST into CGST + SGST; **inter-state** applies IGST
- Invoice status is derived from payments and the due date, not just the stored field —
  a draft with money against it stops reading as a draft
- All amounts render in Indian grouping (`₹1,23,456`), with lakh/crore short forms on
  dense cards and an amount-in-words line on every document

## Layout of the source

```
src/
  lib/         store, calculations, formatting, comms templates, PDF builders, auth
  components/
    ui/        buttons, inputs, dialogs, tables, badges, stat cards (Radix + Tailwind)
    forms/     client, project, payment and expense dialogs
    docs/      block registry, layout builder, block palette, properties panel,
               items editor, schedule editor, totals panel, document renderer
    charts.jsx validated chart palette, tooltip and legend
  pages/       one file per route, plus auth/
```