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
npm test         # vitest — money math, store, sync, auth, app boot
npm run lint
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

The app is a browser client for the API in `server/` — accounts and the database
live in Postgres, so a dev server needs one to talk to. Vite inlines `VITE_*` at
build time and there is no dev proxy, so the API's origin is set before starting:

```bash
cd server && npm install
DATABASE_URL=postgres://user:pass@localhost:5432/stonezen \
  AUTH_SECRET=$(openssl rand -hex 32) \
  ALLOWED_ORIGINS=http://localhost:5173 npm start                        # :8080

echo 'VITE_API_BASE_URL=http://localhost:8080' > .env.local               # back in the root
npm run dev
```

`ALLOWED_ORIGINS` matters even locally: the app on `:5173` and the API on `:8080`
are different origins, so an API started without it answers every request with a
CORS failure. An empty `VITE_API_BASE_URL` means *same origin* instead, which is
what a deployment behind one domain wants.

### Signing in

**No credentials ship with the app.** While the `users` table is empty,
`/api/auth/bootstrap` reports `needsFirstRunSetup` and the sign-in screen offers
**Create the owner account** instead — that first registration is the only one
given the `Owner` role. Every account after it is `Staff`, and can only be
created while the owner has opened sign-up in **Settings → Security**.

A dev build pre-fills the form with `stonezenconstructions@gmail.com / stonezen`
(`src/pages/auth/Login.jsx`) to save typing during development. It is a prefill,
not an account: it signs you in only if that account exists in the database you
are pointed at. A production build ships an empty form.

Passwords are never recoverable from the database — only reset, with the
recovery code from **Settings → Security**. To see which accounts a server
already has: `SELECT email, role, created_at FROM users;`

If your browser cannot reach `localhost:5173`, Vite bound to IPv6 only; use
`npm run dev -- --host` to listen on IPv4 as well.

## Deploying

Two services and a Postgres database on **Coolify**, both built from this one
repository.

**API** — `server/Dockerfile`, built from the repository root. Expose port 8080
and point the health check at `/api/health`, which answers 503 while Postgres is
unreachable, so a container that cannot see the database never reads as healthy.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Missing at boot, the container exits rather than answering every request with a 500. |
| `AUTH_SECRET` | Signs session tokens; **32 characters minimum**, also enforced at boot. Changing it signs everyone out. |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API — the app's own URL. An explicit allowlist, never `*`: these endpoints carry client records and GST invoices. |
| `PORT` | Defaults to 8080. |

**App** — the root `Dockerfile` builds the static bundle and serves it through
nginx with an SPA fallback, long-lived caching for fingerprinted assets, and a
`/healthz` endpoint. Expose port 80 and point the health check there. Set
`VITE_API_BASE_URL` to the API's origin as a **build** variable — Vite inlines it
into the bundle, so supplying it to the running container does nothing.

`server/schema.sql` is applied by the API itself at boot, retrying while Postgres
finishes starting, so a first deploy that races the database recovers instead of
needing a manual restart. The API listens *before* it migrates, deliberately: a
schema failure is then readable from `/api/health` rather than dying with the
container.

Attaching a sub-domain needs no code change beyond rebuilding the app with the
new `VITE_API_BASE_URL` and adding the new origin to `ALLOWED_ORIGINS`.

`.github/workflows/ci.yml` runs lint, tests and the build on every push.

## Installing it on a phone

The app is a PWA, so the client installs it from the browser and gets a home-screen
icon that opens without browser chrome. `public/manifest.webmanifest` declares it,
`public/sw.js` caches the shell so it opens with no signal, and `src/main.jsx`
registers the worker in production builds only.

**Android / Chrome needs HTTPS.** Service workers are refused outside a secure
context, so on a plain-http host the worker never registers and Chrome offers no
install. Attaching a real domain (Coolify issues a Let's Encrypt certificate) is
what turns installability on — nothing in the code changes.

**iPhone / Safari works over http today**: Share → *Add to Home Screen*. iOS
ignores the manifest's icons and reads `apple-touch-icon.png`, which is why both
are declared in `index.html`.

Icons are generated from one source PNG rather than hand-exported. `image/logo-mark.png`
is the in-app mark; `public/` holds the favicons, the iOS touch icon, and 192/512
manifest icons in both `any` and `maskable` form — maskable carries extra padding
and an opaque background because Android crops it to the launcher's own shape.

The service worker deliberately never touches the API: non-GET, cross-origin and
`/api/` all bypass it. A cached `GET /state` would hand `sync.js` a stale version
number, which is the one thing the version check exists to prevent.

## Checking responsiveness

jsdom does no layout, so unit tests cannot see a page overflowing sideways.
`npm run audit:responsive` drives a locally installed Chrome over every route at
320 / 375 / 768 / 1024 / 1280 px and reports any horizontal overflow along with
the element that caused it:

```bash
npm run dev                 # in one terminal
npm run audit:responsive    # in another
SHOTS=1 OUT_DIR=/tmp/shots npm run audit:responsive   # also write screenshots

# Detail routes need a record to open, so point it at a JSON export:
AUDIT_DB=./backup.json \
AUDIT_ROUTES="project=/projects/PRJ-2026-27-001,quote=/quotations/QT-2026-27-001/preview" \
  npm run audit:responsive
```

It exits quietly if no Chrome is installed, so it is safe to run anywhere. The
usual culprit it finds is a grid or flex child without `min-w-0` — see the note
at the top of `src/index.css`.

## How it stores data

The database lives in Postgres as a **single JSONB document** (`app_state`), and
every browser keeps a local copy in `localStorage` under `stonezen_crm_v1`.

One document rather than a table per entity, because the store has always
serialised the whole database on every write and the UI reads it synchronously
through `useSyncExternalStore`. Keeping that shape left the 73 mutation call
sites across the app — and every money path — untouched. The store
(`src/lib/store.js`) still exposes `getState`/`subscribe`/`setState`, so every
screen updates the moment a record changes, and a `storage` listener keeps two
open tabs in step.

`src/lib/sync.js` moves that document both ways: pushes are debounced 1.5s so a
typed sentence is one request rather than forty, and flushed with `keepalive`
when a tab is hidden; pulls run every 20s and whenever a tab returns to the
foreground. **The version check is what makes this safe** — the server stores a
version with the document and refuses a push that names a stale one. Without it,
a device coming back online would silently overwrite everything the other
device did. A refused push (409) raises a conflict for the user to resolve;
neither copy is discarded automatically.

The local copy is a cache, not the record: it is what lets the app open offline
and survive a reload with no network. A failed local write (quota exhausted,
storage blocked) raises a banner rather than pretending the change was saved.

**Settings → Data** exports a JSON backup, imports one back, or clears
everything. Backups still matter — the server holds one document, and an import
overwrites it for every device.

The app ships with **no sample records** — a new install starts empty. Only the
company profile, banking details and document defaults in `src/lib/seed.js` are
seeded, because a quotation cannot be issued without a letterhead and a GSTIN.
A browser that already loaded the old demo dataset clears it once on next load
(`purgeDemoRecords` in `src/lib/store.js`), matching on the exact demo ids so
anything genuinely entered is left alone.

Deleting a client who has payments or issued invoices **archives** them instead —
a received payment is a financial record and is never removed by a cascade.

## Accounts and security

Accounts live in Postgres and are shared by every device, so signing in on a
phone reaches the same books.

Passwords are hashed with PBKDF2-SHA256 (210k iterations, per-user salt) and
compared in constant time. Sign-in is throttled to 10 attempts per email per 15
minutes, and answers a wrong password and an unknown email identically. Sign-up
is **closed by default** except on first run — the owner opens it from
**Settings → Security**, which is also where a recovery code is issued. Only a
hash of that code is kept, so a forgotten password is reset by presenting the
code rather than by the app printing one on screen.

Sessions are signed bearer tokens (HMAC-SHA256, 30 days), held in
`localStorage` and sent as `Authorization: Bearer`. Deliberately not cookies:
the app and the API sit on different origins, and a cross-site cookie needs
`SameSite=None; Secure`, which cannot work over the plain-http test URLs. A 401
clears the stored token rather than looping on a session that can never succeed.

## What's in it

| Area | What it does |
|---|---|
| **Dashboard** | Revenue/profit/pipeline KPIs, revenue-vs-expense chart, payment and project status donuts, activity feed |
| **Clients** | Card or table view, contact actions, per-client hub with Overview / Projects / Quotations / Invoices / **Ledger** / Payments tabs |
| **Projects** | Contract value vs collections vs expenses, live profit and margin, linked documents, site expense register, **site photo gallery** |
| **Quotations** | Three-panel builder — details + line items + GST/totals + milestone schedule, drag-and-drop layout, block palette, live preview |
| **Invoices** | Same builder for billing; converts from a quotation through a dialog that takes extra items; tracks paid/balance and derived status |
| **Payments / Expenses** | Ledgers that feed invoice balances, project profit and the accounts view |
| **Accounts** | Monthly trend, expense breakdown, GST summary (CGST/SGST/IGST), outstanding receivables, CSV export |
| **Follow-ups** | Sent quotations ranked by how long they've been quiet, with ready-written WhatsApp and email messages |
| **Documents** | Every quotation and invoice in one list, each downloadable as a real PDF file or shared straight to WhatsApp |
| **Settings** | Company profile and logo, banking details, numbering prefixes, document defaults, security (password, recovery code, sign-up), data tools |

## Documents and PDFs

A document is an ordered list of **blocks** (letterhead, client details, items table,
totals, payment schedule, notes, terms, bank info, signature, plus free heading/text/
divider/spacer). Reorder them by dragging, toggle visibility, duplicate, or edit each
block's properties. The layout is saved with the record.

There are two output paths, both live.

**Download** builds a real `.pdf` file with pdfmake (`src/lib/pdfDoc.js` holds the
document definitions, `src/lib/pdf.js` drives them) and hands it to the device, so
tapping Download on a phone puts a file in Downloads. That is the whole reason it
exists: `window.print()` on a phone opens a print preview and leaves the user
hunting for "Save as PDF", which some Android builds do not offer at all without a
printer configured. Where the OS share sheet accepts files, a **Share PDF** button
appears next to it — that is the reliable route on iOS, and it puts the document
straight into WhatsApp.

**Print** keeps the original route: a self-contained HTML document written into a
hidden iframe followed by `window.print()`, which is still what a desktop user wants
when a printer is the destination. The document is pinned to `color-scheme: light`
so a viewer in dark mode still gets a white page.

`html2canvas` is deliberately avoided on both paths — it cannot resolve Tailwind's
colour tokens, renders blank or mis-coloured pages, and would turn selectable text
into a picture of text. The pdfmake output stays vector: text is selectable, a
typical invoice is 40–180 KB, and pagination is handled by the renderer.

pdfmake and its fonts are about 1.9 MB, so they are loaded with a dynamic `import()`
on the first Download rather than shipped in the main bundle — this app is opened on
a phone on site, and most sessions never generate a document. Its bundled Roboto is
also what makes `₹` (U+20B9) and the `−` used on discount lines print at all; the PDF
standard fonts have neither, and every amount would come out as a hollow box.
`src/lib/pdfDoc.test.js` asserts that glyph coverage directly, so a pdfmake upgrade
that swapped the font would fail the build rather than the client's copy.

### Turning a quotation into an invoice

**Convert to invoice** on a quotation opens a dialog rather than creating one
outright: it lists what is about to be carried across, lets any line be dropped or
restored, takes extra items agreed on site since the quotation went out, and lets the
dates, discount, GST and milestone schedule be changed. Nothing is written — and no
invoice number is consumed — until Create is pressed. Quotation lines measure `area`
and invoice lines bill `quantity`, so they are re-keyed on the way across.

## Site photos

Each project has a **Site Photos** gallery for pictures of the finished work.
Uploads are downscaled in the browser to 1600px (plus a 480px thumbnail) before they
leave the device, because a phone shoots 3–6 MB and the app displays nothing sharper.

These live in their own `project_photos` table and are addressed one at a time
(`GET/POST /api/projects/:id/photos`, `GET/PATCH/DELETE /api/photos/:id`) —
**deliberately outside the synced document**. Everything in `app_state` is pushed and
pulled whole: a photo in there would be re-uploaded 1.5 s after any keystroke
anywhere in the app, re-downloaded by every 20 s poll, and counted against the
browser's ~5 MB `localStorage` quota. The grid loads thumbnails only; the full image
is fetched when a photo is opened.

Projects live in the JSON document, so `project_id` is the CRM's own text id rather
than a foreign key and nothing cascades — deleting a project (or clearing all data)
calls the photo endpoint explicitly. A project is capped at 60 photos so a runaway
upload cannot fill a database shared with other applications.

## Money and tax

`src/lib/calc.js` is the single source of truth for every figure:

- Subtotal → discount → taxable → GST → additional charges → round-off → grand total
- **Intra-state** splits GST into CGST + SGST; **inter-state** applies IGST
- Invoice status is derived from payments and the due date, not just the stored field —
  a draft with money against it stops reading as a draft
- All amounts render in Indian grouping (`₹1,23,456`), with lakh/crore short forms on
  dense cards and an amount-in-words line on every document

Document numbers follow the Indian financial year (April–March), so the series
restarts each April: `INV-2026-27-001`. The number is allocated when a document
is saved, never when a builder opens, so two drafts cannot claim the same one.

## Not yet built

Three things from the readiness review are deliberately still open, because each
is a feature build rather than a fix:

- **Per-line HSN/SAC codes and per-line GST rates.** GST is still a single
  document-level rate, and intra/inter state is a manual toggle.
- **Retention, TDS §194C and mobilisation advance.** Project profit therefore
  counts the full invoiced value as collectable.
- **Milestone billing.** A quotation's payment schedule prints, but does not
  generate the invoices that claim it.

Push follow-ups are not built. Site photos and durable multi-device storage are —
see *Site photos* and *How it stores data*.

## Layout of the source

```
src/
  lib/         store, sync, API client, calculations, formatting, comms
               templates, auth, project photos
               pdf.js      print HTML + the download/share entry points
               pdfDoc.js   pdfmake document definitions for the real PDF files
               download.js saving and sharing a generated file
  components/
    ui/        buttons, inputs, dialogs, tables, badges, stat cards (Radix + Tailwind)
    forms/     client, project, payment and expense dialogs, convert-to-invoice
    docs/      block registry, layout builder, block palette, properties panel,
               items editor, schedule editor, totals panel, document renderer
    projects/  site photo gallery
    charts.jsx validated chart palette, tooltip and legend
  pages/       one file per route, plus auth/
server/        Express API — auth, the state document, project photos,
               schema.sql, its Dockerfile
```