/**
 * Drives a local Chrome over every route at several viewport widths and reports
 * anything that overflows horizontally, plus which element caused it.
 *
 * jsdom cannot do layout, so this is the only way to catch real responsive
 * breakage. Usage: node scripts/responsive-audit.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:5173'
const SHOTS = process.env.SHOTS === '1'
const OUT = process.env.OUT_DIR || '/tmp/responsive'

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].find(existsSync)

if (!CHROME) {
  console.error('No local Chrome found — skipping responsive audit.')
  process.exit(0)
}

const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 780 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 800 },
  { name: '1280', width: 1280, height: 860 },
]

// Detail routes are omitted: with no sample data there is no record to open.
// Create a client and add its id here when auditing a populated install.
const ROUTES = [
  ['dashboard', '/'],
  ['clients', '/clients'],
  ['projects', '/projects'],
  ['quotations', '/quotations'],
  ['quotation-builder', '/quotations/new'],
  ['invoices', '/invoices'],
  ['invoice-builder', '/invoices/new'],
  ['accounts', '/accounts'],
  ['payments', '/accounts/payments'],
  ['expenses', '/accounts/expenses'],
  ['ledger', '/accounts/ledger'],
  ['followups', '/followups'],
  ['settings', '/settings'],
  ['search', '/search?q=a'],
  ['login', '/login'],
  // Detail routes only exist once there is a record to open, so they come from
  // the environment alongside AUDIT_DB: AUDIT_ROUTES="project=/projects/PRJ-…"
  ...(process.env.AUDIT_ROUTES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const at = pair.indexOf('=')
      return at === -1 ? [pair, pair] : [pair.slice(0, at), pair.slice(at + 1)]
    }),
]

const session = {
  name: 'B. Dhanasundaran',
  email: 'stonezenconstructions@gmail.com',
  role: 'Owner',
  since: new Date().toISOString(),
  expires: Date.now() + 30 * 86400000,
  token: 'audit-token',
  // Optional: point AUDIT_DB at a JSON export to audit the detail routes,
  // which are empty and therefore meaningless on a blank install.
  db: process.env.AUDIT_DB ? readFileSync(process.env.AUDIT_DB, 'utf8') : null,
}

/** Reports the widest offending elements, so the fix has somewhere to land. */
function findOverflow() {
  const docW = document.documentElement.clientWidth
  const bad = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    const style = getComputedStyle(el)
    if (style.position === 'fixed') continue
    // Anything reaching past the right edge, or starting left of it.
    const over = Math.round(r.right - docW)
    if (over > 1 || Math.round(r.left) < -1) {
      const scrollable = ['auto', 'scroll'].includes(style.overflowX)
      if (scrollable) continue
      bad.push({
        over,
        left: Math.round(r.left),
        width: Math.round(r.width),
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute('class') || '').slice(0, 110),
      })
    }
  }
  return {
    scrollW: document.documentElement.scrollWidth,
    clientW: docW,
    offenders: bad.sort((a, b) => b.over - a.over).slice(0, 4),
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1'],
})

if (SHOTS) mkdirSync(OUT, { recursive: true })

let problems = 0
const page = await browser.newPage()
await page.evaluateOnNewDocument((s) => {
  localStorage.setItem('stonezen_auth_v1', JSON.stringify(s))
  // `isAuthenticated` requires the bearer token as well as the cached user —
  // without it every route redirected to /login and this script has been
  // auditing the sign-in page thirteen times over.
  localStorage.setItem('stonezen_token_v1', s.token)
  if (s.db) localStorage.setItem('stonezen_crm_v1', s.db)
  localStorage.setItem('stonezen_demo_purged_v1', '1')
}, session)

for (const [label, route] of ROUTES) {
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 })
    // Long enough for Recharts to finish animating, or screenshots lie.
    await new Promise((r) => setTimeout(r, SHOTS ? 2200 : 320))
    const res = await page.evaluate(findOverflow)
    const overflowing = res.scrollW > res.clientW + 1
    if (overflowing) {
      problems++
      console.log(`\n✗ ${label} @ ${vp.name}px — scrollWidth ${res.scrollW} vs ${res.clientW}`)
      for (const o of res.offenders) {
        console.log(`    +${o.over}px  <${o.tag}> w=${o.width} left=${o.left}  ${o.cls}`)
      }
    }
    if (SHOTS && (vp.name === '375' || vp.name === '768' || vp.name === '1280')) {
      await page.screenshot({ path: `${OUT}/${label}-${vp.name}.png`, fullPage: false })
    }
  }
}

await browser.close()
console.log(problems ? `\n${problems} overflowing combinations.` : '\nNo horizontal overflow at any tested width.')
