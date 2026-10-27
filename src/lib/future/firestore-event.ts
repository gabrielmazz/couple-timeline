import type { EventCategory, TimelineEvent } from '../../types/database'

export function todayDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function makeTimelineEvent(input: { id: string; coupleId: string; userId: string; date: string; title: string; description: string | null; location: string | null; category: EventCategory }): TimelineEvent {
  const now = new Date().toISOString()
  return { id: input.id, couple_id: input.coupleId, event_date: input.date, year: Number(input.date.slice(0, 4)), title: input.title, subtitle: null, description: input.description, location_name: input.location, event_time: null, category: input.category, tags: [], music_url: null, cover_photo_path: null, created_by: input.userId, created_at: now, updated_at: now }
}
