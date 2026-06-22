import type { Couple, CoupleRole, EventCategory, TimelineEvent, TimelinePhoto } from './database'

export type CoupleListItem = Couple & {
  memberRole: CoupleRole
}

export type TimelineTree = {
  root: CoupleListItem
  children: Couple[]
  memberRole: CoupleRole
  hasPartner: boolean
}

export type TimelinePhotoWithUrl = TimelinePhoto & {
  signedUrl: string | null
}

export type TimelineEventWithPhotos = TimelineEvent & {
  photos: TimelinePhotoWithUrl[]
  coverUrl: string | null
  sourceTimeline: Pick<Couple, 'id' | 'name'>
}

export type TimelinePayload = {
  couple: Couple
  events: TimelineEventWithPhotos[]
  years: number[]
  isMember: boolean
  canEdit: boolean
  includesChildren: boolean
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
