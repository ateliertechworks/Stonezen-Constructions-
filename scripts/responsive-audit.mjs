/**
 * Drives a local Chrome over every route at several viewport widths and reports
 * anything that overflows horizontally, plus which element caused it.
 *
 * jsdom cannot do layout, so this is the only way to catch real responsive
 * breakage. Usage: node scripts/responsive-audit.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'

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

const ROUTES = [
  ['dashboard', '/'],
  ['clients', '/clients'],
  ['client-profile', '/clients/CL-2026-001'],
  ['projects', '/projects'],
  ['project-detail', '/projects/PRJ-2026-001'],
  ['quotations', '/quotations'],
  ['quotation-builder', '/quotations/new'],
  ['quotation-preview', '/quotations/QT-2026-001/preview'],
  ['invoices', '/invoices'],
  ['invoice-builder', '/invoices/new'],
  ['invoice-preview', '/invoices/INV-2026-001/preview'],
  ['accounts', '/accounts'],
  ['payments', '/accounts/payments'],
  ['expenses', '/accounts/expenses'],
  ['ledger', '/accounts/ledger'],
  ['followups', '/followups'],
  ['settings', '/settings'],
  ['search', '/search?q=a'],
  ['login', '/login'],
]

const session = {
  name: 'B. Dhanasundaran',
  email: 'stonezenconstructions@gmail.com',
  role: 'Owner',
  since: new Date().toISOString(),
  expires: Date.now() + 30 * 86400000,
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
