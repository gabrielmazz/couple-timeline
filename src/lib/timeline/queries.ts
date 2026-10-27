import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { firebaseAuth, firestore } from '../firebase/client'
import { getBackgroundImagesFromUrls } from './background'
import { createSignedUrlMap } from './storage'
import type { Couple, CoupleMember, CoupleRole, Profile, TimelineEvent, TimelineEventComment, TimelineEventCommentReaction, TimelinePhoto } from '../../types/database'
import type { TimelineCursor, TimelineEventCommentWithAuthor, TimelineEventWithPhotos, TimelineFilters, TimelinePage, TimelinePhotoWithUrl, TimelineTree, TimelineTreeItem } from '../../types/timeline'

export type FetchTimelineOptions = {
  cursor?: TimelineCursor | null
  filters?: TimelineFilters
  pageSize?: number
}

const DEFAULT_TIMELINE_FILTERS: TimelineFilters = { year: null, month: null, sortOrder: 'asc' }
const DEFAULT_TIMELINE_PAGE_SIZE = 12
const MAX_TIMELINE_PAGE_SIZE = 48
const BACKGROUND_EVENT_LIMIT = 48

async function listByField<T>(collectionName: string, field: string, value: string): Promise<T[]> {
  const result = await getDocs(query(collection(firestore, collectionName), where(field, '==', value)))
  return result.docs.map((item) => ({ ...item.data(), id: item.id }) as T)
}

async function getRow<T>(collectionName: string, id: string): Promise<T | null> {
  const result = await getDoc(doc(firestore, collectionName, id))
  return result.exists() ? ({ ...result.data(), id: result.id } as T) : null
}

async function listEvents(coupleIds: string[]): Promise<TimelineEvent[]> {
  const uniqueIds = [...new Set(coupleIds.filter(Boolean))]
  const groups = await Promise.all(uniqueIds.map((id) => listByField<TimelineEvent>('timeline_events', 'couple_id', id)))
  return groups.flat()
}

function sortPhotos(photos: TimelinePhoto[]) {
  return photos.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}

async function getPhotos(eventId: string) {
  return sortPhotos(await listByField<TimelinePhoto>('timeline_photos', 'event_id', eventId))
}

export async function getCurrentUser() {
  await firebaseAuth.authStateReady()
  const user = firebaseAuth.currentUser
  return user ? { id: user.uid, uid: user.uid, email: user.email, displayName: user.displayName } : null
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Você precisa estar autenticado para continuar.')
  return user
}

export async function ensureProfile(name?: string | null) {
  const user = await requireUser()
  const ref = doc(firestore, 'profiles', user.id)
  const current = await getDoc(ref)
  if (current.exists()) {
    if (name) await setDoc(ref, { name, email: user.email }, { merge: true })
    return
  }
  await setDoc(ref, {
    id: user.id,
    name: name || user.displayName || user.email || null,
    email: user.email ?? null,
    birth_date: null,
    bio: null,
    created_at: new Date().toISOString(),
  })
}

export async function getUserTimelineTree(): Promise<TimelineTree | null> {
  const user = await requireUser()
  const rootRef = await getDoc(doc(firestore, 'user_roots', user.id))
  if (!rootRef.exists()) return null
  const rootId = rootRef.data().root_id as string
  const [root, access, children, members] = await Promise.all([
    getRow<Couple>('couples', rootId),
    getDoc(doc(firestore, 'access', rootId, 'members', user.id)),
    listByField<Couple>('couples', 'parent_id', rootId),
    listByField<CoupleMember>('couple_members', 'couple_id', rootId),
  ])
  if (!root || !access.exists()) throw new Error('Relacionamento não encontrado ou sem permissão de leitura.')
  const role = access.data().role as CoupleRole
  children.sort((a, b) => a.created_at.localeCompare(b.created_at))
  const eventRows = await listEvents([rootId, ...children.map((item) => item.id)])
  const summaries = new Map<string, Pick<TimelineTreeItem, 'eventCount' | 'lastEventDate'>>()
  for (const event of eventRows) {
    const current = summaries.get(event.couple_id) ?? { eventCount: 0, lastEventDate: null }
    summaries.set(event.couple_id, {
      eventCount: current.eventCount + 1,
      lastEventDate: !current.lastEventDate || event.event_date > current.lastEventDate ? event.event_date : current.lastEventDate,
    })
  }
  return {
    root: { ...root, memberRole: role },
    children: children.map((item) => ({ ...item, ...(summaries.get(item.id) ?? { eventCount: 0, lastEventDate: null }) })),
    memberRole: role,
    hasPartner: members.some((item) => item.role === 'partner'),
  }
}

export async function getEventTimelineDestinations(coupleId: string) {
  const { couple, canEdit } = await getCouple(coupleId)
  if (!canEdit) throw new Error('Você não tem permissão para criar eventos nesta timeline.')
  const rootId = couple.parent_id ?? couple.id
  const [root, children] = await Promise.all([
    getRow<Couple>('couples', rootId),
    listByField<Couple>('couples', 'parent_id', rootId),
  ])
  if (!root) throw new Error('Timeline principal não encontrada.')
  return [root, ...children.sort((a, b) => a.created_at.localeCompare(b.created_at))]
}

export async function fetchTimelineBackgroundImages(coupleIds: string[]) {
  const events = (await listEvents(coupleIds))
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
    .slice(0, BACKGROUND_EVENT_LIMIT)
  const paths = await Promise.all(events.map(async (event) => event.cover_photo_path ?? (await getPhotos(event.id))[0]?.storage_path ?? null))
  const signedUrls = await createSignedUrlMap(paths.filter((path): path is string => Boolean(path)))
  return getBackgroundImagesFromUrls(paths.map((path) => (path ? signedUrls.get(path) : null)))
}

export async function fetchTimelineTreeBackgroundImages(rootCoupleId: string) {
  const { couple } = await getCouple(rootCoupleId)
  const rootId = couple.parent_id ?? couple.id
  const children = await listByField<Couple>('couples', 'parent_id', rootId)
  return fetchTimelineBackgroundImages([rootId, ...children.map((item) => item.id)])
}

export async function getMembership(coupleId: string): Promise<CoupleMember | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const couple = await getRow<Couple>('couples', coupleId)
  if (!couple) return null
  const memberships = await listByField<CoupleMember>('couple_members', 'user_id', user.id)
  return memberships.find((item) => item.couple_id === (couple.parent_id ?? couple.id)) ?? null
}

export async function getCouple(coupleId: string) {
  const [couple, user] = await Promise.all([getRow<Couple>('couples', coupleId), getCurrentUser()])
  if (!couple) throw new Error('Timeline não encontrada ou sem permissão de leitura.')
  const access = user ? await getDoc(doc(firestore, 'access', couple.parent_id ?? couple.id, 'members', user.id)) : null
  const isMember = Boolean(access?.exists())
  const role = access?.data()?.role as CoupleRole | undefined
  return { couple, isMember, canEdit: role === 'owner' || role === 'partner' }
}

function compareEvents(a: Pick<TimelineEvent, 'event_date' | 'id'>, b: Pick<TimelineEvent, 'event_date' | 'id'>) {
  return a.event_date.localeCompare(b.event_date) || a.id.localeCompare(b.id)
}

export async function fetchTimeline(coupleId: string, options: FetchTimelineOptions = {}): Promise<TimelinePage> {
  const filters = options.filters ?? DEFAULT_TIMELINE_FILTERS
  const pageSize = Math.min(Math.max(options.pageSize ?? DEFAULT_TIMELINE_PAGE_SIZE, 1), MAX_TIMELINE_PAGE_SIZE)
  const access = await getCouple(coupleId)
  const children = access.couple.parent_id ? [] : await listByField<Couple>('couples', 'parent_id', coupleId)
  const timelines = [access.couple, ...children]
  const timelinesById = new Map(timelines.map((item) => [item.id, item]))
  const allEvents = await listEvents(timelines.map((item) => item.id))
  const direction = filters.sortOrder === 'asc' ? 1 : -1
  const cursor = options.cursor ? { event_date: options.cursor.eventDate, id: options.cursor.id } : null
  const rows = allEvents
    .filter((event) => filters.year === null || event.year === filters.year)
    .filter((event) => filters.month === null || Number(event.event_date.slice(5, 7)) === filters.month)
    .filter((event) => !cursor || compareEvents(event, cursor) * direction > 0)
    .sort((a, b) => compareEvents(a, b) * direction)
  const pageRows = rows.slice(0, pageSize)
  const signedUrls = await createSignedUrlMap(pageRows.map((event) => event.cover_photo_path).filter((path): path is string => Boolean(path)))
  const events: TimelineEventWithPhotos[] = pageRows.map((event) => ({
    ...event,
    photos: [],
    coverUrl: event.cover_photo_path ? signedUrls.get(event.cover_photo_path) ?? null : null,
    sourceTimeline: { id: event.couple_id, name: (timelinesById.get(event.couple_id) ?? access.couple).name },
  }))
  const today = new Date()
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`
  const last = events.at(-1)
  return {
    ...access,
    events,
    years: options.cursor ? [] : [...new Set(allEvents.map((event) => event.year))].sort((a, b) => a - b),
    includesChildren: children.length > 0,
    currentMonthEventCount: options.cursor ? 0 : allEvents.filter((event) => event.event_date.startsWith(monthPrefix)).length,
    nextCursor: rows.length > pageSize && last ? { eventDate: last.event_date, id: last.id } : null,
  }
}

export async function fetchTimelineEventPhotos(event: TimelineEventWithPhotos) {
  const row = await getRow<TimelineEvent>('timeline_events', event.id)
  if (!row) throw new Error('Evento não encontrado ou sem permissão de leitura.')
  const photos = await getPhotos(event.id)
  const signedUrls = await createSignedUrlMap([row.cover_photo_path, ...photos.map((photo) => photo.storage_path)].filter((path): path is string => Boolean(path)))
  const photoItems: TimelinePhotoWithUrl[] = photos.map((photo) => ({ ...photo, signedUrl: signedUrls.get(photo.storage_path) ?? null }))
  const fallbackCover = photoItems[0]?.signedUrl ?? null
  return { ...event, photos: photoItems, coverUrl: row.cover_photo_path ? signedUrls.get(row.cover_photo_path) ?? fallbackCover : fallbackCover }
}

export async function getTimelineEventComments(eventId: string): Promise<TimelineEventCommentWithAuthor[]> {
  await requireUser()
  const comments = (await listByField<TimelineEventComment>('timeline_event_comments', 'event_id', eventId))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const authorIds = [...new Set(comments.map((item) => item.author_id))]
  const [profiles, reactionGroups] = await Promise.all([
    Promise.all(authorIds.map((id) => getRow<Profile>('profiles', id))),
    Promise.all(comments.map((item) => listByField<TimelineEventCommentReaction>('timeline_event_comment_reactions', 'comment_id', item.id))),
  ])
  const names = new Map(profiles.filter((profile): profile is Profile => Boolean(profile)).map((profile) => [profile.id, profile.name]))
  return comments.map((item, index) => ({ ...item, authorName: names.get(item.author_id) || 'Pessoa do casal', reactions: reactionGroups[index] }))
}

export async function fetchEventForEdit(coupleId: string, eventId: string) {
  const { canEdit } = await getCouple(coupleId)
  if (!canEdit) throw new Error('Você não tem permissão para editar esta timeline.')
  const event = await getRow<TimelineEvent>('timeline_events', eventId)
  if (!event || event.couple_id !== coupleId) throw new Error('Evento não encontrado.')
  const photos = await getPhotos(eventId)
  const signedUrls = await createSignedUrlMap(photos.map((photo) => photo.storage_path))
  return { ...event, photos: photos.map((photo) => ({ ...photo, signedUrl: signedUrls.get(photo.storage_path) ?? null })) }
}
