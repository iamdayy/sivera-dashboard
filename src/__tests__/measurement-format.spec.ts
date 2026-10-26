import { describe, expect, it } from 'vitest'
import { formatMeasurement, formatConfidence, formatSourceTimestamp } from '@/lib/measurement-format'

describe('measurement presentation', () => {
  it.each([null, undefined, NaN, Infinity, -Infinity, -1, '', '0', '0.25'])('does not present unavailable or invalid value %s as zero', value => {
    expect(formatMeasurement(value)).toBe('-')
  })

  it('preserves zero, Indonesian units, and a nonzero value below display precision', () => {
    expect(formatMeasurement(0)).toBe('0,000')
    expect(formatMeasurement(1234.5)).toBe('1.234,500')
    expect(formatMeasurement(0.00001)).toBe('< 0,001')
    expect(formatMeasurement(0.1, 0)).toBe('< 1')
    expect(formatMeasurement(0, 0)).toBe('0')
  })

  it('keeps confidence in its valid range without coercing missing values', () => {
    expect(formatConfidence(null)).toBe('-')
    expect(formatConfidence(NaN)).toBe('-')
    expect(formatConfidence(-0.1)).toBe('-')
    expect(formatConfidence(1.01)).toBe('-')
    expect(formatConfidence(0)).toBe('0,0%')
    expect(formatConfidence(0.875)).toBe('87,5%')
  })

  it('labels source time consistently in UTC and handles absent/invalid timestamps', () => {
    expect(formatSourceTimestamp(null)).toBe('Tidak tersedia')
    expect(formatSourceTimestamp('bad-date')).toBe('Tidak tersedia')
    expect(formatSourceTimestamp('2026-10-26T15:00:00+07:00')).toBe(formatSourceTimestamp('2026-10-26T08:00:00Z'))
    expect(formatSourceTimestamp('2026-10-26T08:00:00Z')).toContain('UTC')
  })
})
