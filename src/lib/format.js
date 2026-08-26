const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const INR2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatINR(n, decimals = false) {
  const v = Number(n || 0)
  const neg = v < 0
  const s = (decimals ? INR2 : INR).format(Math.abs(v))
  return `${neg ? '-' : ''}₹${s}`
}

export function formatNum(n, decimals = 2) {
  const v = Number(n || 0)
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : decimals,
    maximumFractionDigits: decimals,
  }).format(v)
}

export function formatINRCompact(n) {
  const v = Number(n || 0)
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2).replace(/\.00$/, '')}Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2).replace(/\.00$/, '')}L`
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `${sign}₹${INR.format(abs)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDateLong(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatDate(iso)}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
}

export function monthKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key) {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${String(y).slice(2)}`
}

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDaysISO(iso, days) {
  const d = new Date(iso || todayISO())
  d.setDate(d.getDate() + Number(days || 0))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysSince(iso) {
  if (!iso) return 0
  const ms = new Date(todayISO()).getTime() - new Date(iso).getTime()
  return Math.max(0, Math.round(ms / 86400000))
}

export function daysUntil(iso) {
  if (!iso) return 0
  const ms = new Date(iso).getTime() - new Date(todayISO()).getTime()
  return Math.round(ms / 86400000)
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** 685193 -> "Six Lakh Eighty Five Thousand One Hundred Ninety Three Rupees Only" */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n < 20) return ONES[n]
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`
}

export function amountInWords(amount) {
  let n = Math.floor(Math.abs(Number(amount) || 0))
  if (n === 0) return 'Zero Rupees Only'
  const parts = []
  const crore = Math.floor(n / 10000000); n %= 10000000
  const lakh = Math.floor(n / 100000); n %= 100000
  const thousand = Math.floor(n / 1000); n %= 1000
  const hundred = Math.floor(n / 100); n %= 100
  if (crore) parts.push(`${twoDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (hundred) parts.push(`${ONES[hundred]} Hundred`)
  if (n) parts.push(twoDigits(n))
  return `${parts.join(' ')} Rupees Only`
}
