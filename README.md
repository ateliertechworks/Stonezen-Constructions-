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

Demo login (pre-filled on the sign-in screen):

```
stonezenconstructions@gmail.com / stonezen
```

## How it stores data

Everything lives in `localStorage` under `stonezen_crm_v1` — no server, no network.
The store (`src/lib/store.js`) exposes `getState`/`subscribe`/`setState` and is read
through `useSyncExternalStore`, so every screen updates the moment a record changes.

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
