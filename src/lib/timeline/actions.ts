import { z } from 'zod'
import { collection, doc, getDoc, getDocs, query, runTransaction, setDoc, where, writeBatch } from 'firebase/firestore'
import { firebaseAuth, firestore } from '../firebase/client'
import { getYearFromDate } from '../utils'
import { copyEventImages, removeEventImages, uploadEventImages } from './storage'
import { getCouple, getUserTimelineTree, requireUser } from './queries'
import type { Couple, FutureMoment, CoupleMonthlyPlan, TimelineEvent, TimelineEventComment, TimelineEventCommentReaction, TimelinePhoto, TimelineVisibility } from '../../types/database'

export const eventCategories = [
  'Primeiro encontro',
  'Primeiro beijo',
  'Início do namoro',
  'Pedido de namoro',
  'Noivado',
  'Pedido de casamento',
  'Viagem',
  'Fim de semana',
  'Passeio',
  'Praia',
  'Aventura',
  'Lua de mel',
  'Aniversário',
  'Aniversário de namoro',
  'Aniversário de casamento',
  'Pedido',
  'Casamento',
  'Jantar',
  'Almoço',
  'Café',
  'Piquenique',
  'Cinema',
  'Teatro',
  'Show',
  'Festival',
  'Festa',
  'Natal',
  'Ano Novo',
  'Dia dos Namorados',
  'Presente',
  'Surpresa',
  'Conquista',
  'Formatura',
  'Novo emprego',
  'Casa nova',
  'Mudança',
  'Adoção de pet',
  'Família',
  'Amigos',
  'Sessão de fotos',
  'Reconciliação',
  'Dia comum especial',
  'Outro',
] as const

const coupleSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.'),
  visibility: z.enum(['private', 'public']),
})

const addMemberSchema = z.object({
  coupleId: z.string().uuid(),
  email: z.string().trim().email('Informe um e-mail válido.'),
})

const eventSchema = z.object({
  coupleId: z.string().uuid(),
  title: z.string().trim().min(2, 'Informe um título.').max(120, 'Use até 120 caracteres.'),
  subtitle: z.string().trim().max(160, 'Use até 160 caracteres.').optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.'),
  locationName: z.string().trim().max(120, 'Use até 120 caracteres.').optional(),
  eventTime: z.string().trim().max(40, 'Use até 40 caracteres.').optional(),
  category: z.enum(eventCategories).optional().or(z.literal('')),
  tags: z
    .array(z.string().trim().min(1).max(30, 'Cada tag pode ter até 30 caracteres.'))
    .max(8, 'Adicione no máximo 8 tags.'),
  description: z.string().trim().max(5000, 'Use até 5000 caracteres.').optional(),
  musicUrl: z
    .string()
    .trim()
    .url('Informe uma URL válida.')
    .optional()
    .or(z.literal('')),
})

export const commentReactionEmojis = ['❤️', '😍', '😂', '🥹', '👏', '🔥'] as const

const eventCommentSchema = z.object({
  eventId: z.string().uuid(),
  coupleId: z.string().uuid(),
  parentCommentId: z.string().uuid().nullable().optional(),
  content: z.string().trim().min(1, 'Escreva um comentário.').max(1000, 'Use até 1000 caracteres.'),
})

const commentReactionSchema = z.object({
  commentId: z.string().uuid(),
  emoji: z.enum(commentReactionEmojis),
})

export type CreateCoupleInput = {
  name: string
  visibility: TimelineVisibility
}

export type AddCoupleMemberInput = {
  coupleId: string
  email: string
}

export type UpdateChildTimelineInput = {
  timelineId: string
  name: string
}

export type CreateEventInput = z.infer<typeof eventSchema> & {
  files: File[]
  coverFileIndex: number
}

export type UpdateEventInput = z.infer<typeof eventSchema> & {
  eventId: string
  sourceCoupleId: string
  files: File[]
  removedPhotoIds: string[]
  existingPhotoOrder: string[]
  coverPhotoPath: string | null
  coverFileIndex: number | null
}

export type CreateEventCommentInput = z.infer<typeof eventCommentSchema>
export type ToggleEventCommentReactionInput = z.infer<typeof commentReactionSchema>

type StoredRow = { id: string }

export type PendingInvite = {
  id: string
  couple_id: string
  email: string
  created_by: string
  status: 'pending'
  created_at: string
}

async function listByField<T extends StoredRow>(collectionName: string, field: string, value: string): Promise<T[]> {
  const result = await getDocs(query(collection(firestore, collectionName), where(field, '==', value)))
  return result.docs.map((item) => ({ ...item.data(), id: item.id }) as T)
}

async function getRow<T extends StoredRow>(collectionName: string, id: string): Promise<T | null> {
  const result = await getDoc(doc(firestore, collectionName, id))
  return result.exists() ? ({ ...result.data(), id: result.id } as T) : null
}

function eventValues(parsed: z.infer<typeof eventSchema>, userId: string, id: string, now: string): TimelineEvent {
  return {
    id, couple_id: parsed.coupleId, event_date: parsed.eventDate, year: getYearFromDate(parsed.eventDate),
    title: parsed.title, subtitle: parsed.subtitle || null, description: parsed.description || null,
    location_name: parsed.locationName || null, event_time: parsed.eventTime || null, category: parsed.category || null,
    tags: Array.from(new Map(parsed.tags.map((tag) => [tag.toLocaleLowerCase('pt-BR'), tag])).values()),
    music_url: parsed.musicUrl || null, cover_photo_path: null, created_by: userId, created_at: now, updated_at: now,
  }
}

export async function createCouple(input: CreateCoupleInput) {
  const user = await requireUser()
  const parsed = coupleSchema.parse(input)
  const tree = await getUserTimelineTree()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const timeline: Couple = {
    id, name: parsed.name, slug: 'timeline-' + id.slice(0, 8),
    visibility: tree?.root.visibility ?? parsed.visibility,
    created_by: tree?.root.created_by ?? user.id, parent_id: tree?.root.id ?? null,
    relationship_started_at: null, created_at: now,
  }

  if (tree) {
    if (tree.memberRole !== 'owner') throw new Error('Apenas o proprietário pode criar timelines vinculadas.')
    await setDoc(doc(firestore, 'couples', id), timeline)
    return timeline
  }

  const membershipId = crypto.randomUUID()
  const rootRef = doc(firestore, 'user_roots', user.id)
  await runTransaction(firestore, async (transaction) => {
    if ((await transaction.get(rootRef)).exists()) throw new Error('Você já possui uma timeline principal.')
    transaction.set(doc(firestore, 'couples', id), timeline)
    transaction.set(doc(firestore, 'couple_members', membershipId), {
      id: membershipId, couple_id: id, user_id: user.id, role: 'owner', created_at: now,
    })
    transaction.set(doc(firestore, 'access', id, 'members', user.id), {
      couple_id: id, user_id: user.id, role: 'owner', membership_id: membershipId,
    })
    transaction.set(rootRef, { root_id: id, membership_id: membershipId })
  })
  return timeline
}

export async function addCoupleMemberByEmail(input: AddCoupleMemberInput) {
  const user = await requireUser()
  const parsed = addMemberSchema.parse(input)
  const tree = await getUserTimelineTree()
  if (!tree || tree.root.id !== parsed.coupleId || tree.memberRole !== 'owner') {
    throw new Error('Apenas o proprietário pode convidar alguém para este relacionamento.')
  }
  if (tree.hasPartner) throw new Error('Este relacionamento já possui uma pessoa vinculada.')
  const email = parsed.email.trim().toLowerCase()
  if (user.email?.toLowerCase() === email) throw new Error('Informe o e-mail da outra pessoa.')
  const id = crypto.randomUUID()
  await setDoc(doc(firestore, 'invites', id), {
    id, couple_id: tree.root.id, email, created_by: user.id, status: 'pending', created_at: new Date().toISOString(),
  })
}

export async function listPendingInvites(): Promise<PendingInvite[]> {
  const user = await requireUser()
  const current = firebaseAuth.currentUser
  if (!user.email || !current?.emailVerified) return []
  const invites = await listByField<PendingInvite>('invites', 'email', user.email.toLowerCase())
  return invites.filter((item) => item.status === 'pending')
}

export async function acceptInvite(inviteId: string) {
  const user = await requireUser()
  if (!user.email || !firebaseAuth.currentUser?.emailVerified) {
    throw new Error('Confirme seu e-mail antes de aceitar um convite.')
  }
  const membershipId = crypto.randomUUID()
  const now = new Date().toISOString()
  const inviteRef = doc(firestore, 'invites', inviteId)
  const rootRef = doc(firestore, 'user_roots', user.id)
  await runTransaction(firestore, async (transaction) => {
    const [invite, root] = await Promise.all([transaction.get(inviteRef), transaction.get(rootRef)])
    if (!invite.exists() || invite.data().status !== 'pending' || invite.data().email !== user.email?.toLowerCase()) {
      throw new Error('Convite não encontrado ou já utilizado.')
    }
    if (root.exists()) throw new Error('Você já possui um relacionamento vinculado.')
    const coupleId = invite.data().couple_id as string
    transaction.update(inviteRef, { status: 'accepted', accepted_by: user.id, accepted_at: now })
    transaction.set(doc(firestore, 'couple_members', membershipId), {
      id: membershipId, couple_id: coupleId, user_id: user.id, role: 'partner', created_at: now,
    })
    transaction.set(doc(firestore, 'access', coupleId, 'members', user.id), {
      couple_id: coupleId, user_id: user.id, role: 'partner', membership_id: membershipId, invite_id: inviteId,
    })
    transaction.set(rootRef, { root_id: coupleId, membership_id: membershipId, invite_id: inviteId })
    transaction.set(doc(firestore, 'access', coupleId, 'slots', 'partner'), {
      user_id: user.id, invite_id: inviteId, membership_id: membershipId,
    })
  })
}

export async function createTimelineEventComment(input: CreateEventCommentInput) {
  const user = await requireUser()
  const parsed = eventCommentSchema.parse(input)
  const event = await getRow<TimelineEvent>('timeline_events', parsed.eventId)
  if (!event || event.couple_id !== parsed.coupleId) throw new Error('Evento não encontrado.')
  if (parsed.parentCommentId) {
    const parent = await getRow<TimelineEventComment>('timeline_event_comments', parsed.parentCommentId)
    if (!parent || parent.event_id !== parsed.eventId) throw new Error('Comentário original não encontrado.')
  }
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await setDoc(doc(firestore, 'timeline_event_comments', id), {
    id, event_id: parsed.eventId, couple_id: parsed.coupleId, parent_comment_id: parsed.parentCommentId ?? null,
    author_id: user.id, content: parsed.content, created_at: now, updated_at: now,
  })
  return id
}

async function reactionId(commentId: string, userId: string, emoji: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(commentId + '|' + userId + '|' + emoji)))
  bytes[6] = (bytes[6] & 15) | 80
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes.slice(0, 16), (value) => value.toString(16).padStart(2, '0')).join('')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
}

export async function toggleTimelineEventCommentReaction(input: ToggleEventCommentReactionInput) {
  const user = await requireUser()
  const parsed = commentReactionSchema.parse(input)
  const comment = await getRow<TimelineEventComment>('timeline_event_comments', parsed.commentId)
  if (!comment) throw new Error('Comentário não encontrado.')
  const reactions = await listByField<TimelineEventCommentReaction>('timeline_event_comment_reactions', 'comment_id', parsed.commentId)
  const existing = reactions.find((item) => item.user_id === user.id && item.emoji === parsed.emoji)
  const stableId = await reactionId(parsed.commentId, user.id, parsed.emoji)
  if (!existing) {
    await setDoc(doc(firestore, 'timeline_event_comment_reactions', stableId), {
      id: stableId, comment_id: parsed.commentId, user_id: user.id,
      emoji: parsed.emoji, created_at: new Date().toISOString(),
    })
    return true
  }
  return runTransaction(firestore, async (transaction) => {
    const existingRef = doc(firestore, 'timeline_event_comment_reactions', existing.id)
    const current = await transaction.get(existingRef)
    if (!current.exists()) throw new Error('A reação mudou em outra sessão. Recarregue e tente novamente.')
    transaction.delete(existingRef)
    return false
  })
}

export async function updateChildTimeline(input: UpdateChildTimelineInput) {
  await requireUser()
  const name = coupleSchema.shape.name.parse(input.name)
  const tree = await getUserTimelineTree()
  if (!tree || tree.memberRole !== 'owner' || !tree.children.some((item) => item.id === input.timelineId)) {
    throw new Error('Você não tem permissão para editar esta timeline vinculada.')
  }
  await runTransaction(firestore, async (transaction) => {
    const ref = doc(firestore, 'couples', input.timelineId)
    const current = await transaction.get(ref)
    if (!current.exists() || current.data().parent_id !== tree.root.id) throw new Error('Timeline vinculada não encontrada.')
    transaction.update(ref, { name })
  })
}
type EventDeletionPlan = {
  photos: TimelinePhoto[]
  comments: TimelineEventComment[]
  reactions: TimelineEventCommentReaction[]
  future: FutureMoment[]
  plans: CoupleMonthlyPlan[]
}

async function loadEventDeletionPlan(events: TimelineEvent[]): Promise<EventDeletionPlan> {
  const perEvent = await Promise.all(events.map(async (event) => {
    const [photos, comments] = await Promise.all([
      listByField<TimelinePhoto>('timeline_photos', 'event_id', event.id),
      listByField<TimelineEventComment>('timeline_event_comments', 'event_id', event.id),
    ])
    return { photos, comments }
  }))
  const comments = perEvent.flatMap((item) => item.comments)
  const tree = await getUserTimelineTree()
  const coupleIds = [...new Set([
    ...events.map((event) => event.couple_id),
    ...(tree ? [tree.root.id, ...tree.children.map((item) => item.id)] : []),
  ])]
  const [reactionGroups, futureGroups, planGroups] = await Promise.all([
    Promise.all(comments.map((item) => listByField<TimelineEventCommentReaction>('timeline_event_comment_reactions', 'comment_id', item.id))),
    Promise.all(coupleIds.map((id) => listByField<FutureMoment>('future_moments', 'couple_id', id))),
    Promise.all(coupleIds.map((id) => listByField<CoupleMonthlyPlan>('couple_monthly_plans', 'couple_id', id))),
  ])
  const eventIds = new Set(events.map((event) => event.id))
  return {
    photos: perEvent.flatMap((item) => item.photos),
    comments,
    reactions: reactionGroups.flat(),
    future: futureGroups.flat().filter((item) => item.completed_event_id && eventIds.has(item.completed_event_id)),
    plans: planGroups.flat().filter((item) => item.completed_event_id && eventIds.has(item.completed_event_id)),
  }
}

function assertBatchLimit(count: number) {
  if (count > 450) throw new Error('Esta operação contém muitos registros para excluir de forma atômica.')
}

function addEventDeletionToBatch(
  batch: ReturnType<typeof writeBatch>,
  eventIds: string[],
  plan: EventDeletionPlan,
  deletedFutureIds = new Set<string>(),
  deletedPlanIds = new Set<string>(),
) {
  for (const item of plan.reactions) batch.delete(doc(firestore, 'timeline_event_comment_reactions', item.id))
  for (const item of plan.comments) batch.delete(doc(firestore, 'timeline_event_comments', item.id))
  for (const item of plan.photos) batch.delete(doc(firestore, 'timeline_photos', item.id))
  for (const item of plan.future) {
    if (!deletedFutureIds.has(item.id)) batch.update(doc(firestore, 'future_moments', item.id), { completed_event_id: null })
  }
  for (const item of plan.plans) {
    if (!deletedPlanIds.has(item.id)) batch.update(doc(firestore, 'couple_monthly_plans', item.id), { completed_event_id: null })
  }
  for (const id of eventIds) batch.delete(doc(firestore, 'timeline_events', id))
}

export async function deleteChildTimeline(timelineId: string) {
  await requireUser()
  const tree = await getUserTimelineTree()
  if (!tree || tree.memberRole !== 'owner' || !tree.children.some((item) => item.id === timelineId)) {
    throw new Error('Você não tem permissão para excluir esta timeline vinculada.')
  }
  const otherIds = [tree.root.id, ...tree.children.filter((item) => item.id !== timelineId).map((item) => item.id)]
  const otherEvents = (await Promise.all(otherIds.map((id) =>
    listByField<TimelineEvent>('timeline_events', 'couple_id', id),
  ))).flat()
  const otherPhotos = (await Promise.all(otherEvents.map((event) =>
    listByField<TimelinePhoto>('timeline_photos', 'event_id', event.id),
  ))).flat()
  if (otherPhotos.some((photo) => photo.storage_path.startsWith('couples/' + timelineId + '/'))) {
    throw new Error('Esta timeline contém imagens usadas por eventos de outra timeline. Mova as imagens antes de excluí-la.')
  }
  const [events, gifts, calendar, future, plans] = await Promise.all([
    listByField<TimelineEvent>('timeline_events', 'couple_id', timelineId),
    listByField<StoredRow>('couple_gifts', 'couple_id', timelineId),
    listByField<StoredRow>('couple_calendar_entries', 'couple_id', timelineId),
    listByField<FutureMoment>('future_moments', 'couple_id', timelineId),
    listByField<CoupleMonthlyPlan>('couple_monthly_plans', 'couple_id', timelineId),
  ])
  const eventIds = events.map((item) => item.id)
  const plan = await loadEventDeletionPlan(events)
  assertBatchLimit(1 + eventIds.length + gifts.length + calendar.length + future.length + plans.length +
    plan.photos.length + plan.comments.length + plan.reactions.length + plan.future.length + plan.plans.length)
  const batch = writeBatch(firestore)
  addEventDeletionToBatch(batch, eventIds, plan, new Set(future.map((item) => item.id)), new Set(plans.map((item) => item.id)))
  for (const item of gifts) batch.delete(doc(firestore, 'couple_gifts', item.id))
  for (const item of calendar) batch.delete(doc(firestore, 'couple_calendar_entries', item.id))
  for (const item of future) batch.delete(doc(firestore, 'future_moments', item.id))
  for (const item of plans) batch.delete(doc(firestore, 'couple_monthly_plans', item.id))
  batch.delete(doc(firestore, 'couples', timelineId))
  await batch.commit()
  // R2 objects remain recoverable; deleting the child also removes its image authorization.
}

export async function createTimelineEvent(input: CreateEventInput) {
  const user = await requireUser()
  const parsed = eventSchema.parse(input)
  const { canEdit } = await getCouple(parsed.coupleId)
  if (!canEdit) throw new Error('Você não tem permissão para criar eventos nesta timeline.')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  assertBatchLimit(input.files.length + 1)
  const paths = await uploadEventImages(parsed.coupleId, id, input.files)
  const event = eventValues(parsed, user.id, id, now)
  event.cover_photo_path = paths[input.coverFileIndex] ?? paths[0] ?? null
  const batch = writeBatch(firestore)
  batch.set(doc(firestore, 'timeline_events', id), event)
  paths.forEach((path, position) => {
    const photoId = crypto.randomUUID()
    batch.set(doc(firestore, 'timeline_photos', photoId), {
      id: photoId, event_id: id, storage_path: path, position, caption: null, created_at: now,
    })
  })
  await batch.commit()
  return id
}

export async function updateTimelineEvent(input: UpdateEventInput) {
  const user = await requireUser()
  const parsed = eventSchema.extend({ sourceCoupleId: z.string().uuid() }).parse(input)
  const [source, target, event, photos] = await Promise.all([
    getCouple(parsed.sourceCoupleId),
    getCouple(parsed.coupleId),
    getRow<TimelineEvent>('timeline_events', input.eventId),
    listByField<TimelinePhoto>('timeline_photos', 'event_id', input.eventId),
  ])
  if (!source.canEdit || !target.canEdit ||
      (source.couple.parent_id ?? source.couple.id) !== (target.couple.parent_id ?? target.couple.id)) {
    throw new Error('Você não tem permissão para mover este evento.')
  }
  if (!event || event.couple_id !== parsed.sourceCoupleId) throw new Error('Evento não encontrado.')
  const removed = photos.filter((item) => input.removedPhotoIds.includes(item.id))
  const remainingById = new Map(photos.filter((item) => !input.removedPhotoIds.includes(item.id)).map((item) => [item.id, item]))
  const remaining = [
    ...input.existingPhotoOrder.map((id) => remainingById.get(id)).filter((item): item is TimelinePhoto => Boolean(item)),
    ...Array.from(remainingById.values()).filter((item) => !input.existingPhotoOrder.includes(item.id)),
  ]
  const copied = parsed.sourceCoupleId === parsed.coupleId ? new Map<string, string>() :
    await copyEventImages(remaining.map((photo) => photo.storage_path), parsed.coupleId)
  assertBatchLimit(1 + removed.length + remaining.length + input.files.length)
  const uploadedPaths = await uploadEventImages(parsed.coupleId, input.eventId, input.files)
  const now = new Date().toISOString()
  const newPhotos = uploadedPaths.map((path, index) => ({
    id: crypto.randomUUID(), event_id: input.eventId, storage_path: path,
    position: remaining.length + index, caption: null, created_at: now,
  }))
  const selectedExisting = input.coverPhotoPath && remaining.some((item) => item.storage_path === input.coverPhotoPath)
    ? copied.get(input.coverPhotoPath) ?? input.coverPhotoPath : null
  const cover = (input.coverFileIndex === null ? null : uploadedPaths[input.coverFileIndex]) ??
    selectedExisting ?? (remaining[0] ? copied.get(remaining[0].storage_path) ?? remaining[0].storage_path : null) ?? uploadedPaths[0] ?? null
  await runTransaction(firestore, async (transaction) => {
    const eventRef = doc(firestore, 'timeline_events', input.eventId)
    const current = await transaction.get(eventRef)
    if (!current.exists() || current.data().couple_id !== parsed.sourceCoupleId || current.data().updated_at !== event.updated_at) {
      throw new Error('O evento foi alterado em outra sessão. Recarregue antes de salvar.')
    }
    const photoSnapshots = await Promise.all(photos.map((photo) => transaction.get(doc(firestore, 'timeline_photos', photo.id))))
    if (photoSnapshots.some((snapshot, index) => !snapshot.exists() || snapshot.data()?.storage_path !== photos[index].storage_path)) {
      throw new Error('As fotos foram alteradas em outra sessão. Recarregue antes de salvar.')
    }
    for (const item of removed) transaction.delete(doc(firestore, 'timeline_photos', item.id))
    remaining.forEach((item, position) => transaction.update(doc(firestore, 'timeline_photos', item.id), { position, storage_path: copied.get(item.storage_path) ?? item.storage_path }))
    for (const item of newPhotos) transaction.set(doc(firestore, 'timeline_photos', item.id), item)
    const next = eventValues(parsed, user.id, event.id, now)
    transaction.update(eventRef, { ...next, created_by: event.created_by, created_at: event.created_at, cover_photo_path: cover })
  })
  if (removed.length) {
    try {
      await removeEventImages(removed.map((item) => item.storage_path))
    } catch {
      throw new Error('O evento foi salvo, mas não foi possível remover os arquivos antigos do R2.')
    }
  }
}

export async function deleteTimelineEvent(eventId: string) {
  await requireUser()
  const event = await getRow<TimelineEvent>('timeline_events', eventId)
  if (!event) throw new Error('Evento não encontrado.')
  const { canEdit } = await getCouple(event.couple_id)
  if (!canEdit) throw new Error('Você não tem permissão para excluir este evento.')
  const plan = await loadEventDeletionPlan([event])
  assertBatchLimit(1 + plan.photos.length + plan.comments.length + plan.reactions.length + plan.future.length + plan.plans.length)
  const batch = writeBatch(firestore)
  addEventDeletionToBatch(batch, [eventId], plan)
  await batch.commit()
  if (plan.photos.length) {
    try {
      await removeEventImages(plan.photos.map((item) => item.storage_path))
    } catch {
      throw new Error('O evento foi excluído, mas não foi possível remover os arquivos do R2.')
    }
  }
}
