import type { Profile } from './database'
import type { TimelineTree } from './timeline'

export type ProfilePageData = {
  profile: Profile
  partner: Profile | null
  tree: TimelineTree | null
}

export type ProfileFormModel = {
  name: string
  birthDate: string
  bio: string
}

export type RelationshipFormModel = {
  startedAt: string
}
