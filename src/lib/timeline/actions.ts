import { z } from 'zod'
import { supabase } from '../supabase/client'
import { getYearFromDate } from '../utils'
import { removeEventImages, uploadEventImages } from './storage'
import { getUserTimelineTree, requireUser } from './queries'
import type { TimelineVisibility } from '../../types/database'

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

type EventWithPhotosForWrite = {
  id: string
  couple_id: string
  cover_photo_path: string | null
  timeline_photos: {
    id: string
    storage_path: string
    position: number | null
  }[]
}

export async function createCouple(input: CreateCoupleInput) {
  await requireUser()
  const parsed = coupleSchema.parse(input)
  const { data, error } = await supabase.rpc('create_couple_timeline', {
    timeline_name: parsed.name,
    timeline_visibility: parsed.visibility,
  })

  if (error) {
    throw error
  }

  return data
}

export async function addCoupleMemberByEmail(input: AddCoupleMemberInput) {
  await requireUser()
  const parsed = addMemberSchema.parse(input)

  const { error } = await supabase.rpc('add_couple_member_by_email', {
    target_couple_id: parsed.coupleId,
    member_email: parsed.email,
  })

  if (error) {
    throw error
  }
}

export async function updateChildTimeline(input: UpdateChildTimelineInput) {
  await requireUser()
  const name = coupleSchema.shape.name.parse(input.name)

  const { error } = await supabase.rpc('update_child_timeline', {
    target_timeline_id: input.timelineId,
    timeline_name: name,
  })

  if (error) {
    throw error
  }
}

export async function deleteChildTimeline(timelineId: string) {
	await requireUser()
	const tree = await getUserTimelineTree()
	const isOwnedChild = tree?.memberRole === 'owner' && tree.children.some((timeline) => timeline.id === timelineId)

	if (!isOwnedChild) {
		throw new Error('Você não tem permissão para excluir esta timeline vinculada.')
	}

	const { data: events, error: eventsError } = await supabase
		.from('timeline_events')
		.select('id')
		.eq('couple_id', timelineId)

  if (eventsError) {
    throw eventsError
  }

	const eventIds = (events ?? []).map((event) => event.id)
	let photoPaths: string[] = []

	if (eventIds.length > 0) {
		const { data: photos, error: photosError } = await supabase
			.from('timeline_photos')
			.select('storage_path')
			.in('event_id', eventIds)

		if (photosError) {
			throw photosError
		}

		photoPaths = (photos ?? []).map((photo) => photo.storage_path)
	}

  if (photoPaths.length > 0) {
    await removeEventImages(photoPaths)
  }

  const { error } = await supabase.rpc('delete_child_timeline', {
    target_timeline_id: timelineId,
  })

  if (error) {
    throw error
  }
}

export async function createTimelineEvent(input: CreateEventInput) {
  const user = await requireUser()
  const parsed = eventSchema.parse(input)
  const year = getYearFromDate(parsed.eventDate)
  const tags = Array.from(new Map(parsed.tags.map((tag) => [tag.toLocaleLowerCase('pt-BR'), tag])).values())

  const { data: event, error: eventError } = await supabase
    .from('timeline_events')
    .insert({
      couple_id: parsed.coupleId,
      event_date: parsed.eventDate,
      year,
      title: parsed.title,
      subtitle: parsed.subtitle || null,
      description: parsed.description || null,
      location_name: parsed.locationName || null,
      event_time: parsed.eventTime || null,
      category: parsed.category || null,
      tags,
      music_url: parsed.musicUrl || null,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (eventError) {
    throw eventError
  }

  const paths = await uploadEventImages(parsed.coupleId, event.id, input.files)

  if (paths.length > 0) {
    const { error: photosError } = await supabase.from('timeline_photos').insert(
      paths.map((path, index) => ({
        event_id: event.id,
        storage_path: path,
        position: index,
      })),
    )

    if (photosError) {
      await removeEventImages(paths)
      throw photosError
    }

    const coverPath = paths[input.coverFileIndex] ?? paths[0]
    const { error: coverError } = await supabase
      .from('timeline_events')
      .update({ cover_photo_path: coverPath })
      .eq('id', event.id)

    if (coverError) {
      throw coverError
    }
  }

  return event.id
}

export async function updateTimelineEvent(input: UpdateEventInput) {
  await requireUser()
  const parsed = eventSchema.extend({ sourceCoupleId: z.string().uuid() }).parse(input)
  const year = getYearFromDate(parsed.eventDate)
  const tags = Array.from(new Map(parsed.tags.map((tag) => [tag.toLocaleLowerCase('pt-BR'), tag])).values())
  const { data, error: loadError } = await supabase
    .from('timeline_events')
    .select('id, couple_id, cover_photo_path, timeline_photos(id, storage_path, position)')
    .eq('id', input.eventId)
    .eq('couple_id', parsed.sourceCoupleId)
    .single()

  if (loadError) {
    throw loadError
  }

  const current = data as unknown as EventWithPhotosForWrite
  const removedPhotos = current.timeline_photos.filter((photo) => input.removedPhotoIds.includes(photo.id))
  const remainingPhotosById = new Map(
    current.timeline_photos
      .filter((photo) => !input.removedPhotoIds.includes(photo.id))
      .map((photo) => [photo.id, photo]),
  )
  const remainingPhotos = [
    ...input.existingPhotoOrder
      .map((photoId) => remainingPhotosById.get(photoId))
      .filter((photo): photo is EventWithPhotosForWrite['timeline_photos'][number] => Boolean(photo)),
    ...Array.from(remainingPhotosById.values()).filter(
      (photo) => !input.existingPhotoOrder.includes(photo.id),
    ),
  ]

  if (removedPhotos.length > 0) {
    await removeEventImages(removedPhotos.map((photo) => photo.storage_path))

    const { error: deletePhotosError } = await supabase
      .from('timeline_photos')
      .delete()
      .in(
        'id',
        removedPhotos.map((photo) => photo.id),
      )

    if (deletePhotosError) {
      throw deletePhotosError
    }
  }

  const positionUpdates = await Promise.all(
    remainingPhotos.map((photo, position) =>
      supabase.from('timeline_photos').update({ position }).eq('id', photo.id).eq('event_id', input.eventId),
    ),
  )
  const positionError = positionUpdates.find(({ error }) => error)?.error

  if (positionError) {
    throw positionError
  }

  const startPosition = remainingPhotos.length
  const uploadedPaths = await uploadEventImages(parsed.coupleId, input.eventId, input.files)

  if (uploadedPaths.length > 0) {
    const { error: insertPhotosError } = await supabase.from('timeline_photos').insert(
      uploadedPaths.map((path, index) => ({
        event_id: input.eventId,
        storage_path: path,
        position: startPosition + index,
      })),
    )

    if (insertPhotosError) {
      await removeEventImages(uploadedPaths)
      throw insertPhotosError
    }
  }

  const validExistingCover = input.coverPhotoPath
    ? remainingPhotos.some((photo) => photo.storage_path === input.coverPhotoPath)
    : false
  const coverFromNewFile =
    input.coverFileIndex === null ? null : uploadedPaths[input.coverFileIndex] ?? null
  const nextCover =
    coverFromNewFile ||
    (validExistingCover ? input.coverPhotoPath : null) ||
    remainingPhotos[0]?.storage_path ||
    uploadedPaths[0] ||
    null

  const { error: updateError } = await supabase
    .from('timeline_events')
    .update({
      event_date: parsed.eventDate,
      year,
      title: parsed.title,
      subtitle: parsed.subtitle || null,
      description: parsed.description || null,
      location_name: parsed.locationName || null,
      event_time: parsed.eventTime || null,
      category: parsed.category || null,
      tags,
      music_url: parsed.musicUrl || null,
      cover_photo_path: nextCover,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.eventId)
    .eq('couple_id', parsed.sourceCoupleId)

  if (updateError) {
    throw updateError
  }
}

export async function deleteTimelineEvent(eventId: string) {
  await requireUser()
  const { data, error: loadError } = await supabase
    .from('timeline_events')
    .select('id, timeline_photos(storage_path)')
    .eq('id', eventId)
    .single()

  if (loadError) {
    throw loadError
  }

  const photos = (data as unknown as { timeline_photos: { storage_path: string }[] }).timeline_photos ?? []
  const paths = photos.map((photo) => photo.storage_path)

  if (paths.length > 0) {
    await removeEventImages(paths)
  }

  const { error: deleteError } = await supabase.from('timeline_events').delete().eq('id', eventId)

  if (deleteError) {
    throw deleteError
  }
}
