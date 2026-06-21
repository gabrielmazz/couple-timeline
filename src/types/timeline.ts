import type { Couple, TimelineEvent, TimelinePhoto } from './database'

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
  eventDate: string
  description: string
  musicUrl: string
  coverPhotoPath: string | null
}
