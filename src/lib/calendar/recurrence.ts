import type { CoupleCalendarEntry } from '../../types/database'

export function getAnnualDate(monthDay: string, year: number) {
  const [month, day] = monthDay.split('-').map(Number)
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, maxDay)).padStart(2, '0')}`
}

export function getCalendarEntryDate(entry: Pick<CoupleCalendarEntry, 'event_date' | 'recurrence'>, year: number) {
  const originalYear = Number(entry.event_date.slice(0, 4))

  if (entry.recurrence === 'yearly') {
    return year >= originalYear ? getAnnualDate(entry.event_date.slice(5), year) : null
  }

  return originalYear === year ? entry.event_date : null
}
