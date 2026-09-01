import { describe, it, expect } from 'vitest'
import { formatINRCompact, formatINR, amountInWords, localISO } from './format'

describe('compact currency', () => {
  it('drops a trailing zero instead of printing 13.50L', () => {
    expect(formatINRCompact(1350000)).toBe('₹13.5L')
    expect(formatINRCompact(450000)).toBe('₹4.5L')
  })

  it('drops the decimals entirely when they are all zero', () => {
    expect(formatINRCompact(1800000)).toBe('₹18L')
    expect(formatINRCompact(20000000)).toBe('₹2Cr')
  })

  it('keeps a meaningful second decimal', () => {
    expect(formatINRCompact(105000)).toBe('₹1.05L')
  })

  it('scales through thousands, lakhs and crores', () => {
    expect(formatINRCompact(999)).toBe('₹999')
    expect(formatINRCompact(12000)).toBe('₹12K')
    expect(formatINRCompact(4965256)).toBe('₹49.65L')
    expect(formatINRCompact(63142950)).toBe('₹6.31Cr')
  })

  it('keeps the sign on a negative figure', () => {
    expect(formatINRCompact(-1350000)).toBe('-₹13.5L')
  })

  it('treats blank and missing values as zero', () => {
    expect(formatINRCompact(null)).toBe('₹0')
    expect(formatINRCompact('')).toBe('₹0')
  })
})

describe('full currency and words', () => {
  it('groups in the Indian system', () => {
    expect(formatINR(6851930)).toBe('₹68,51,930')
  })

  it('writes an amount in words', () => {
    expect(amountInWords(685193)).toBe('Six Lakh Eighty Five Thousand One Hundred Ninety Three Rupees Only')
  })
})

describe('localISO', () => {
  // `toISOString().slice(0, 10)` would answer 19 August here: 1am on the 20th
  // in a UTC+5:30 timezone is still 19:30 on the 19th in UTC. Site photos are
  // dated with this, and being a day out is visible to the client.
  it('gives the local calendar day, not the UTC one', () => {
    const oneAmIST = new Date(2026, 7, 20, 1, 0, 0)
    expect(localISO(oneAmIST)).toBe('2026-08-20')
    expect(localISO(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
    expect(localISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })

  it('pads single-digit months and days', () => {
    expect(localISO(new Date(2026, 2, 5, 12))).toBe('2026-03-05')
  })

  it('returns an empty string for an unusable date', () => {
    expect(localISO(new Date('nonsense'))).toBe('')
  })
})
