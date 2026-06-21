import { z } from 'zod'
import { supabase } from '../supabase/client'
import { getYearFromDate, slugify } from '../utils'
import { removeEventImages, uploadEventImages } from './storage'
import { requireUser } from './queries'
import type { TimelineVisibility } from '../../types/database'

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
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.'),
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

export type CreateEventInput = z.infer<typeof eventSchema> & {
  files: File[]
  coverFileIndex: number
}

export type UpdateEventInput = z.infer<typeof eventSchema> & {
  eventId: string
  files: File[]
  removedPhotoIds: string[]
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
  const user = await requireUser()
  const parsed = coupleSchema.parse(input)
  const baseSlug = slugify(parsed.name) || 'timeline'
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`

  const { data: couple, error: coupleError } = await supabase
    .from('couples')
    .insert({
      name: parsed.name,
      slug,
      visibility: parsed.visibility,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (coupleError) {
    throw coupleError
  }

  const { error: memberError } = await supabase.from('couple_members').insert({
    couple_id: couple.id,
    user_id: user.id,
    role: 'owner',
  })

  if (memberError) {
    throw memberError
  }

  return couple
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

export async function createTimelineEvent(input: CreateEventInput) {
  const user = await requireUser()
  const parsed = eventSchema.parse(input)
  const year = getYearFromDate(parsed.eventDate)

  const { data: event, error: eventError } = await supabase
    .from('timeline_events')
    .insert({
      couple_id: parsed.coupleId,
      event_date: parsed.eventDate,
      year,
      title: parsed.title,
      description: parsed.description || null,
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
  const parsed = eventSchema.parse(input)
  const year = getYearFromDate(parsed.eventDate)
  const { data, error: loadError } = await supabase
    .from('timeline_events')
    .select('id, couple_id, cover_photo_path, timeline_photos(id, storage_path, position)')
    .eq('id', input.eventId)
    .eq('couple_id', parsed.coupleId)
    .single()

  if (loadError) {
    throw loadError
  }

  const current = data as unknown as EventWithPhotosForWrite
  const removedPhotos = current.timeline_photos.filter((photo) => input.removedPhotoIds.includes(photo.id))
  const remainingPhotos = current.timeline_photos.filter((photo) => !input.removedPhotoIds.includes(photo.id))

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
      description: parsed.description || null,
      music_url: parsed.musicUrl || null,
      cover_photo_path: nextCover,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.eventId)
    .eq('couple_id', parsed.coupleId)

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
