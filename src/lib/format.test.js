import { describe, it, expect } from 'vitest'
import { formatINRCompact, formatINR, amountInWords } from './format'

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
