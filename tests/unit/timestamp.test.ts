import { describe, expect, it } from 'vitest'
import { formatClock, formatTimestamp, sanitizeFilePart } from '../../src/content/frame/timestamp'

describe('timestamp formatting', () => {
  it('formats media time for display and file names', () => {
    expect(formatClock(45296.789)).toBe('12:34:56')
    expect(formatTimestamp(45296.789)).toBe('12-34-56.789')
  })

  it('normalizes invalid values to zero', () => {
    expect(formatTimestamp(Number.NaN)).toBe('00-00-00.000')
    expect(formatTimestamp(-5)).toBe('00-00-00.000')
  })

  it('sanitizes unsafe filename characters', () => {
    expect(sanitizeFilePart(' Demo: <frame> / 01?  ')).toBe('Demo_ _frame_ _ 01_')
  })
})
