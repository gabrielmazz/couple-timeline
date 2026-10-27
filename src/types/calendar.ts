import type {
  CalendarEntryCategory,
  CalendarEntryRecurrence,
  Couple,
  CoupleCalendarEntry,
  CoupleRole,
  Profile,
  TimelineEvent,
} from './database'

export type CalendarEntryFormModel = {
  title: string
  description: string
  eventDate: string
  eventTime: string
  locationName: string
  category: CalendarEntryCategory
  recurrence: CalendarEntryRecurrence
  reminderDaysBefore: string
}

export type CalendarMember = Pick<Profile, 'id' | 'name' | 'birth_date'> & {
  role: CoupleRole
}

export type CalendarTimelineEvent = Pick<
  TimelineEvent,
  'id' | 'couple_id' | 'event_date' | 'event_time' | 'title' | 'category' | 'location_name'
> & {
  timelineName: string
}

export type CalendarPageData = {
  couple: Couple
  entries: CoupleCalendarEntry[]
  timelineEvents: CalendarTimelineEvent[]
  members: CalendarMember[]
  canEdit: boolean
}
