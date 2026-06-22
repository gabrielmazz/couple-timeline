import type { Couple, EventCategory, TimelineEvent, TimelinePhoto } from './database'

export type CoupleListItem = Couple & {
  memberRole: string
}

export type TimelinePhotoWithUrl = TimelinePhoto & {
  signedUrl: string | null
}

export type TimelineEventWithPhotos = TimelineEvent & {
  photos: TimelinePhotoWithUrl[]
  coverUrl: string | null
}

export type TimelinePayload = {
  couple: Couple
  events: TimelineEventWithPhotos[]
  years: number[]
  isMember: boolean
  canEdit: boolean
}

export type EventFormModel = {
  title: string
  subtitle: string
  eventDate: string
  locationName: string
  eventTime: string
  category: EventCategory | ''
  tags: string[]
  description: string
  musicUrl: string
  coverPhotoPath: string | null
}
