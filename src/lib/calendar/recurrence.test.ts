import { describe, expect, it } from 'vitest'
import { getAnnualDate, getCalendarEntryDate } from './recurrence'

describe('calendar recurrence', () => {
  it('repeats a date every year from its original year', () => {
    const entry = { event_date: '2024-09-12', recurrence: 'yearly' as const }

    expect(getCalendarEntryDate(entry, 2023)).toBeNull()
    expect(getCalendarEntryDate(entry, 2026)).toBe('2026-09-12')
  })

  it('keeps one-time dates only in their original year', () => {
    const entry = { event_date: '2026-09-12', recurrence: 'none' as const }

    expect(getCalendarEntryDate(entry, 2025)).toBeNull()
    expect(getCalendarEntryDate(entry, 2026)).toBe('2026-09-12')
  })

  it('adjusts February 29 in non-leap years', () => {
    expect(getAnnualDate('02-29', 2025)).toBe('2025-02-28')
    expect(getAnnualDate('02-29', 2028)).toBe('2028-02-29')
  })
})
