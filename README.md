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
npm test         # vitest — money math, store, auth, app boot
npm run lint
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

Demo login (pre-filled on the sign-in screen **in dev only** — a production
build ships an empty form):

```
stonezenconstructions@gmail.com / stonezen
```

If your browser cannot reach `localhost:5173`, Vite bound to IPv6 only; use
`npm run dev -- --host` to listen on IPv4 as well.

## Deploying

`Dockerfile` builds the static bundle and serves it through nginx with an SPA
fallback, long-lived caching for fingerprinted assets, and a `/healthz`
endpoint. On **Coolify**, add the repository as an *application*, choose the
Dockerfile build pack, expose port 80, and point the health check at
`/healthz`. Attaching a sub-domain later needs no code change — the app is
served entirely from the origin root and holds no absolute URLs.

`.github/workflows/ci.yml` runs lint, tests and the build on every push.

## Checking responsiveness

jsdom does no layout, so unit tests cannot see a page overflowing sideways.
`npm run audit:responsive` drives a locally installed Chrome over every route at
320 / 375 / 768 / 1024 / 1280 px and reports any horizontal overflow along with
the element that caused it:

```bash
npm run dev                 # in one terminal
npm run audit:responsive    # in another
SHOTS=1 OUT_DIR=/tmp/shots npm run audit:responsive   # also write screenshots
```

It exits quietly if no Chrome is installed, so it is safe to run anywhere. The
usual culprit it finds is a grid or flex child without `min-w-0` — see the note
at the top of `src/index.css`.

## How it stores data

Everything lives in `localStorage` under `stonezen_crm_v1` — no server, no network.
A `storage` listener keeps two open tabs in sync instead of letting the last
write silently win, and a failed write (quota exhausted, storage blocked) raises
a banner rather than pretending the change was saved.
The store (`src/lib/store.js`) exposes `getState`/`subscribe`/`setState` and is read
through `useSyncExternalStore`, so every screen updates the moment a record changes.

**Settings → Data** exports a JSON backup, imports one back, or clears
everything. Export regularly: clearing browser site data wipes it.

The app ships with **no sample records** — a new install starts empty. Only the
company profile, banking details and document defaults in `src/lib/seed.js` are
seeded, because a quotation cannot be issued without a letterhead and a GSTIN.
A browser that already loaded the old demo dataset clears it once on next load
(`purgeDemoRecords` in `src/lib/store.js`), matching on the exact demo ids so
anything genuinely entered is left alone.

Deleting a client who has payments or issued invoices **archives** them instead —
a received payment is a financial record and is never removed by a cascade.

## Accounts and security

Passwords are hashed with PBKDF2-SHA256 (210k iterations, per-user salt); an
account stored in plain text by an earlier build is upgraded on its next
successful sign-in. Sign-up is **closed by default** — the owner opens it from
**Settings → Security**, which is also where a recovery code is issued. Only a
hash of that code is kept, so a forgotten password is reset by presenting the
code rather than by the app printing one on screen.

Because each install keeps its own data in its own browser, this gate protects
*this device*, not a shared server.

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
| **Settings** | Company profile and logo, banking details, numbering prefixes, document defaults, security (password, recovery code, sign-up), data tools |

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

Durable multi-device storage, site photo capture and push follow-ups all need a
backend and are out of scope for the localStorage build.

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