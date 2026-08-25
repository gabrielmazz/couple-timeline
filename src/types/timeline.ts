import type {
  Couple,
  CoupleRole,
  EventCategory,
  TimelineEvent,
  TimelineEventComment,
  TimelineEventCommentReaction,
  TimelinePhoto,
} from './database'

export type CoupleListItem = Couple & {
  memberRole: CoupleRole
}

export type TimelineTreeItem = Couple & {
  eventCount: number
  lastEventDate: string | null
}

export type TimelineTree = {
  root: CoupleListItem
  children: TimelineTreeItem[]
  memberRole: CoupleRole
  hasPartner: boolean
}

export type EventTimelineDestination = Pick<Couple, 'id' | 'name' | 'parent_id' | 'created_at'>

export type TimelinePhotoWithUrl = TimelinePhoto & {
  signedUrl: string | null
}

export type TimelineEventWithPhotos = TimelineEvent & {
  photos: TimelinePhotoWithUrl[]
  coverUrl: string | null
  sourceTimeline: Pick<Couple, 'id' | 'name'>
}

export type TimelineEventCommentWithAuthor = TimelineEventComment & {
  authorName: string
  reactions: TimelineEventCommentReaction[]
}

export type TimelineSortOrder = 'asc' | 'desc'

export type TimelineFilters = {
  year: number | null
  month: number | null
  sortOrder: TimelineSortOrder
}

export type TimelineCursor = {
  eventDate: string
  id: string
}

export type TimelinePayload = {
  couple: Couple
  events: TimelineEventWithPhotos[]
  years: number[]
  isMember: boolean
  canEdit: boolean
  includesChildren: boolean
}

export type TimelinePage = TimelinePayload & {
  currentMonthEventCount: number
  nextCursor: TimelineCursor | null
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
