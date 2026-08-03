import { supabase } from '../supabase/client'
import { getBackgroundImagesFromUrls } from './background'
import { createSignedUrlMap } from './storage'
import type { Couple, CoupleMember, CoupleRole, TimelineEvent, TimelinePhoto } from '../../types/database'
import type {
  TimelineCursor,
  TimelineEventWithPhotos,
  TimelineFilters,
  TimelinePage,
  TimelinePhotoWithUrl,
  TimelineTree,
  TimelineTreeItem,
} from '../../types/timeline'

type MemberCoupleRow = {
  role: CoupleRole
  couples: Couple
}

type EventWithPhotosRow = TimelineEvent & {
  timeline_photos: TimelinePhoto[] | null
}

type BackgroundPhotoPathRow = Pick<TimelinePhoto, 'storage_path' | 'position'>

type BackgroundEventRow = Pick<TimelineEvent, 'cover_photo_path'> & {
  timeline_photos: BackgroundPhotoPathRow[] | null
}

type TimelinePhotosRow = Pick<TimelineEvent, 'cover_photo_path'> & {
  timeline_photos: TimelinePhoto[] | null
}

export type FetchTimelineOptions = {
  cursor?: TimelineCursor | null
  filters?: TimelineFilters
  pageSize?: number
}

const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  year: null,
  month: null,
  sortOrder: 'asc',
}
const DEFAULT_TIMELINE_PAGE_SIZE = 12
const MAX_TIMELINE_PAGE_SIZE = 48
const BACKGROUND_EVENT_LIMIT = 48
const TIMELINE_EVENT_SELECT =
  'id, couple_id, event_date, year, title, subtitle, description, location_name, event_time, category, tags, music_url, cover_photo_path, created_by, created_at, updated_at'

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

  const children = childrenResult.data ?? []
  const timelineIds = [root.id, ...children.map((timeline) => timeline.id)]
  const { data: eventRows, error: eventError } = await supabase
    .from('timeline_events')
    .select('couple_id, event_date')
    .in('couple_id', timelineIds)

  if (eventError) {
    throw eventError
  }

  const summaries = new Map<string, Pick<TimelineTreeItem, 'eventCount' | 'lastEventDate'>>()

  for (const event of eventRows ?? []) {
    const current = summaries.get(event.couple_id) ?? { eventCount: 0, lastEventDate: null }

    summaries.set(event.couple_id, {
      eventCount: current.eventCount + 1,
      lastEventDate:
        !current.lastEventDate || event.event_date > current.lastEventDate ? event.event_date : current.lastEventDate,
    })
  }

  return {
    root: {
      ...root,
      memberRole: membership.role,
    },
    children: children.map((timeline) => ({
      ...timeline,
      ...(summaries.get(timeline.id) ?? { eventCount: 0, lastEventDate: null }),
    })),
    memberRole: membership.role,
    hasPartner: Boolean(partnerResult.data),
  }
}

export async function getEventTimelineDestinations(coupleId: string, eventDate: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
		return []
	}

  const { couple, canEdit } = await getCouple(coupleId)

  if (!canEdit) {
    throw new Error('Você não tem permissão para criar eventos nesta timeline.')
  }

  const rootId = couple.parent_id ?? couple.id
	const { data: root, error: rootError } = await supabase
		.from('couples')
		.select('id, name, parent_id, created_at')
    .eq('id', rootId)
    .single()

  if (rootError) {
    throw rootError
  }

	const { data: children, error: childrenError } = await supabase
		.from('couples')
		.select('id, name, parent_id, created_at')
    .eq('parent_id', rootId)
    .order('created_at', { ascending: true })

  if (childrenError) {
    throw childrenError
  }

	const [eventYear, eventMonth] = eventDate.split('-').map(Number)

	return [root, ...(children ?? [])].filter((timeline) => {
		const createdAt = new Date(timeline.created_at)

		return createdAt.getFullYear() === eventYear && createdAt.getMonth() + 1 === eventMonth
	})
}

export async function fetchTimelineBackgroundImages(coupleIds: string[]) {
  const uniqueCoupleIds = Array.from(new Set(coupleIds.filter(Boolean)))

  if (uniqueCoupleIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('timeline_events')
    .select('cover_photo_path, timeline_photos(storage_path, position)')
    .in('couple_id', uniqueCoupleIds)
    .order('event_date', { ascending: false })
    .limit(BACKGROUND_EVENT_LIMIT)

  if (error) {
    throw error
  }

  const rows = (data ?? []) as unknown as BackgroundEventRow[]
  const paths = rows.map((event) => {
    const fallback = (event.timeline_photos ?? [])
      .slice()
      .sort((first, second) => (first.position ?? 0) - (second.position ?? 0))[0]?.storage_path

    return event.cover_photo_path ?? fallback ?? null
  })
  const signedUrls = await createSignedUrlMap(paths.filter((path): path is string => Boolean(path)))

  return getBackgroundImagesFromUrls(paths.map((path) => (path ? signedUrls.get(path) : null)))
}

export async function fetchTimelineTreeBackgroundImages(rootCoupleId: string) {
  const { couple } = await getCouple(rootCoupleId)
  const rootId = couple.parent_id ?? couple.id
  const { data, error } = await supabase
    .from('couples')
    .select('id')
    .eq('parent_id', rootId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return fetchTimelineBackgroundImages([rootId, ...(data ?? []).map((timeline) => timeline.id)])
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
  const [coupleResult, user] = await Promise.all([
    supabase.from('couples').select('*').eq('id', coupleId).maybeSingle(),
    getCurrentUser(),
  ])

  if (coupleResult.error) {
    throw coupleResult.error
  }

  if (!coupleResult.data) {
    throw new Error('Timeline não encontrada ou sem permissão de leitura.')
  }

  const couple = coupleResult.data
  const { data: membership, error: membershipError } = user
    ? await supabase
        .from('couple_members')
        .select('*')
        .eq('couple_id', couple.parent_id ?? couple.id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null, error: null }

  if (membershipError) {
    throw membershipError
  }

  const canEdit = membership?.role === 'owner' || membership?.role === 'partner'

  return {
    couple,
    isMember: Boolean(membership),
    canEdit,
  }
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  return { start, end }
}

function getCurrentMonthRange() {
  const today = new Date()

  return getMonthRange(today.getFullYear(), today.getMonth() + 1)
}

export async function fetchTimeline(coupleId: string, options: FetchTimelineOptions = {}): Promise<TimelinePage> {
  const filters = options.filters ?? DEFAULT_TIMELINE_FILTERS
  const pageSize = Math.min(Math.max(options.pageSize ?? DEFAULT_TIMELINE_PAGE_SIZE, 1), MAX_TIMELINE_PAGE_SIZE)
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
  const visibleTimelineIds = visibleTimelines.map((timeline) => timeline.id)
  let eventsQuery = supabase
    .from('timeline_events')
    .select(TIMELINE_EVENT_SELECT)
    .in('couple_id', visibleTimelineIds)

  if (filters.year !== null) {
    eventsQuery = eventsQuery.eq('year', filters.year)
  }

  if (filters.month !== null) {
    if (filters.year !== null) {
      const { start, end } = getMonthRange(filters.year, filters.month)
      eventsQuery = eventsQuery.gte('event_date', start).lt('event_date', end)
    } else {
      eventsQuery = eventsQuery.like('event_date', `%-${String(filters.month).padStart(2, '0')}-%`)
    }
  }

  if (options.cursor) {
    const cursorOperator = filters.sortOrder === 'asc' ? 'gt' : 'lt'
    eventsQuery = eventsQuery.or(
      `event_date.${cursorOperator}.${options.cursor.eventDate},and(event_date.eq.${options.cursor.eventDate},id.${cursorOperator}.${options.cursor.id})`,
    )
  }

  const shouldFetchMetadata = !options.cursor
  const currentMonthRange = getCurrentMonthRange()
  const [eventsResult, yearsResult, currentMonthResult] = await Promise.all([
    eventsQuery
      .order('event_date', { ascending: filters.sortOrder === 'asc' })
      .order('id', { ascending: filters.sortOrder === 'asc' })
      .limit(pageSize + 1),
    shouldFetchMetadata
      ? supabase.rpc('list_timeline_years', { target_couple_ids: visibleTimelineIds })
      : Promise.resolve({ data: [] as { year: number }[], error: null }),
    shouldFetchMetadata
      ? supabase
          .from('timeline_events')
          .select('id', { count: 'exact', head: true })
          .in('couple_id', visibleTimelineIds)
          .gte('event_date', currentMonthRange.start)
          .lt('event_date', currentMonthRange.end)
      : Promise.resolve({ count: 0, error: null }),
  ])

  if (eventsResult.error) {
    throw eventsResult.error
  }

  if (yearsResult.error) {
    throw yearsResult.error
  }

  if (currentMonthResult.error) {
    throw currentMonthResult.error
  }

  const rows = (eventsResult.data ?? []) as TimelineEvent[]
  const pageRows = rows.slice(0, pageSize)
  const signedUrls = await createSignedUrlMap(
    pageRows.map((event) => event.cover_photo_path).filter((path): path is string => Boolean(path)),
  )
  const events: TimelineEventWithPhotos[] = pageRows.map((event) => {
    const sourceTimeline = timelinesById.get(event.couple_id) ?? coupleAccess.couple

    return {
      ...event,
      photos: [],
      coverUrl: event.cover_photo_path ? signedUrls.get(event.cover_photo_path) ?? null : null,
      sourceTimeline: {
        id: sourceTimeline.id,
        name: sourceTimeline.name,
      },
    }
  })
  const lastEvent = events.at(-1)
  const years = Array.from(new Set((yearsResult.data ?? []).map((event) => event.year))).sort((a, b) => a - b)

  return {
    ...coupleAccess,
    events,
    years,
    includesChildren: childTimelines.length > 0,
    currentMonthEventCount: currentMonthResult.count ?? 0,
    nextCursor:
      rows.length > pageSize && lastEvent
        ? {
            eventDate: lastEvent.event_date,
            id: lastEvent.id,
          }
        : null,
  }
}

export async function fetchTimelineEventPhotos(event: TimelineEventWithPhotos) {
  const { data, error } = await supabase
    .from('timeline_events')
    .select('cover_photo_path, timeline_photos(*)')
    .eq('id', event.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Evento não encontrado ou sem permissão de leitura.')
  }

  const row = data as unknown as TimelinePhotosRow
  const photos = (row.timeline_photos ?? []).slice().sort((first, second) => (first.position ?? 0) - (second.position ?? 0))
  const signedUrls = await createSignedUrlMap([
    row.cover_photo_path,
    ...photos.map((photo) => photo.storage_path),
  ].filter((path): path is string => Boolean(path)))
  const photoItems: TimelinePhotoWithUrl[] = photos.map((photo) => ({
    ...photo,
    signedUrl: signedUrls.get(photo.storage_path) ?? null,
  }))
  const fallbackCover = photoItems[0]?.signedUrl ?? null

  return {
    ...event,
    photos: photoItems,
    coverUrl: row.cover_photo_path ? signedUrls.get(row.cover_photo_path) ?? fallbackCover : fallbackCover,
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
