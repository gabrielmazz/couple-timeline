import { supabase } from '../supabase/client'
import { createSignedUrlMap } from './storage'
import type { Couple, CoupleMember, CoupleRole, TimelineEvent, TimelinePhoto } from '../../types/database'
import type {
  TimelineEventWithPhotos,
  TimelinePayload,
  TimelinePhotoWithUrl,
  TimelineTree,
} from '../../types/timeline'

type MemberCoupleRow = {
  role: CoupleRole
  couples: Couple
}

type EventWithPhotosRow = TimelineEvent & {
  timeline_photos: TimelinePhoto[] | null
}

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return user
}

export async function requireUser() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Você precisa estar autenticado para continuar.')
  }

  return user
}

export async function ensureProfile(name?: string | null) {
  const user = await requireUser()

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    name: name || user.user_metadata.name || user.email || null,
    email: user.email ?? null,
  })

  if (error) {
    throw error
  }
}

export async function getUserTimelineTree(): Promise<TimelineTree | null> {
  const user = await requireUser()
  const { data: membershipData, error: membershipError } = await supabase
    .from('couple_members')
    .select('role, couples!inner(*)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    throw membershipError
  }

  if (!membershipData) {
    return null
  }

  const membership = membershipData as unknown as MemberCoupleRow
  const root = membership.couples
  const [childrenResult, partnerResult] = await Promise.all([
    supabase
      .from('couples')
      .select('*')
      .eq('parent_id', root.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('couple_members')
      .select('id')
      .eq('couple_id', root.id)
      .eq('role', 'partner')
      .maybeSingle(),
  ])

  if (childrenResult.error) {
    throw childrenResult.error
  }

  if (partnerResult.error) {
    throw partnerResult.error
  }

  return {
    root: {
      ...root,
      memberRole: membership.role,
    },
    children: childrenResult.data ?? [],
    memberRole: membership.role,
    hasPartner: Boolean(partnerResult.data),
  }
}

export async function getMembership(coupleId: string): Promise<CoupleMember | null> {
  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  const { data: couple, error: coupleError } = await supabase
    .from('couples')
    .select('id, parent_id')
    .eq('id', coupleId)
    .maybeSingle()

  if (coupleError) {
    throw coupleError
  }

  if (!couple) {
    return null
  }

  const { data, error } = await supabase
    .from('couple_members')
    .select('*')
    .eq('couple_id', couple.parent_id ?? couple.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function getCouple(coupleId: string) {
  const { data, error } = await supabase
    .from('couples')
    .select('*')
    .eq('id', coupleId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Timeline não encontrada ou sem permissão de leitura.')
  }

  const membership = await getMembership(coupleId)
  const canEdit = membership?.role === 'owner' || membership?.role === 'partner'

  return {
    couple: data,
    isMember: Boolean(membership),
    canEdit,
  }
}

export async function fetchTimeline(coupleId: string): Promise<TimelinePayload> {
  const coupleAccess = await getCouple(coupleId)
  const childTimelinesResult = coupleAccess.couple.parent_id
    ? { data: [] as Couple[], error: null }
    : await supabase
        .from('couples')
        .select('*')
        .eq('parent_id', coupleId)
        .order('created_at', { ascending: true })

  if (childTimelinesResult.error) {
    throw childTimelinesResult.error
  }

  const childTimelines = childTimelinesResult.data ?? []
  const visibleTimelines = [coupleAccess.couple, ...childTimelines]
  const timelinesById = new Map(visibleTimelines.map((timeline) => [timeline.id, timeline]))
  const { data, error } = await supabase
    .from('timeline_events')
    .select('*, timeline_photos(*)')
    .in(
      'couple_id',
      visibleTimelines.map((timeline) => timeline.id),
    )
    .order('event_date', { ascending: true })

  if (error) {
    throw error
  }

  const rows = (data ?? []) as unknown as EventWithPhotosRow[]
  const paths = rows.flatMap((event) => [
    event.cover_photo_path,
    ...(event.timeline_photos ?? []).map((photo) => photo.storage_path),
  ])
  const signedUrls = await createSignedUrlMap(paths.filter((path): path is string => Boolean(path)))
  const events: TimelineEventWithPhotos[] = rows.map((event) => {
    const sourceTimeline = timelinesById.get(event.couple_id) ?? coupleAccess.couple
    const photos: TimelinePhotoWithUrl[] = (event.timeline_photos ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((photo) => ({
        ...photo,
        signedUrl: signedUrls.get(photo.storage_path) ?? null,
      }))
    const fallbackCover = photos[0]?.signedUrl ?? null

    return {
      ...event,
      photos,
      coverUrl: event.cover_photo_path
        ? signedUrls.get(event.cover_photo_path) ?? fallbackCover
        : fallbackCover,
      sourceTimeline: {
        id: sourceTimeline.id,
        name: sourceTimeline.name,
      },
    }
  })
  const years = Array.from(new Set(events.map((event) => event.year))).sort((a, b) => a - b)

  return {
    ...coupleAccess,
    events,
    years,
    includesChildren: childTimelines.length > 0,
  }
}

export async function fetchEventForEdit(coupleId: string, eventId: string) {
  const { canEdit } = await getCouple(coupleId)

  if (!canEdit) {
    throw new Error('Você não tem permissão para editar esta timeline.')
  }

  const { data, error } = await supabase
    .from('timeline_events')
    .select('*, timeline_photos(*)')
    .eq('id', eventId)
    .eq('couple_id', coupleId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Evento não encontrado.')
  }

  const row = data as unknown as EventWithPhotosRow
  const photos = (row.timeline_photos ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const signedUrls = await createSignedUrlMap(photos.map((photo) => photo.storage_path))

  return {
    ...row,
    photos: photos.map((photo) => ({
      ...photo,
      signedUrl: signedUrls.get(photo.storage_path) ?? null,
    })),
  }
}
