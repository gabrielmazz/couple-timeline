import { supabase } from '../supabase/client'

export const TIMELINE_BUCKET = 'timeline-photos'
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export function validateImageFile(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Use apenas imagens JPG, PNG ou WebP.'
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return 'Cada imagem deve ter no máximo 5MB.'
  }

  return null
}

export function validateImageFiles(files: File[]) {
  for (const file of files) {
    const error = validateImageFile(file)

    if (error) {
      return `${file.name}: ${error}`
    }
  }

  return null
}

export function buildPhotoPath(coupleId: string, eventId: string, file: File, index: number) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeName = file.name
    .replace(/\.[^/.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return `couples/${coupleId}/events/${eventId}/${index}-${crypto.randomUUID()}-${safeName}.${extension}`
}

export async function uploadEventImages(coupleId: string, eventId: string, files: File[]) {
  const validationError = validateImageFiles(files)

  if (validationError) {
    throw new Error(validationError)
  }

  const uploaded: string[] = []

  for (const [index, file] of files.entries()) {
    const path = buildPhotoPath(coupleId, eventId, file, index)
    const { error } = await supabase.storage.from(TIMELINE_BUCKET).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })

    if (error) {
      if (uploaded.length > 0) {
        await removeEventImages(uploaded)
      }

      throw error
    }

    uploaded.push(path)
  }

  return uploaded
}

export async function removeEventImages(paths: string[]) {
  if (paths.length === 0) {
    return
  }

  const { error } = await supabase.storage.from(TIMELINE_BUCKET).remove(paths)

  if (error) {
    throw error
  }
}

export async function createSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(TIMELINE_BUCKET)
    .createSignedUrl(path, 60 * 60)

  if (error) {
    return null
  }

  return data.signedUrl
}

export async function createSignedUrlMap(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)))

  if (uniquePaths.length === 0) {
    return new Map<string, string | null>()
  }

  const { data, error } = await supabase.storage
    .from(TIMELINE_BUCKET)
    .createSignedUrls(uniquePaths, 60 * 60)

  if (error) {
    return new Map(uniquePaths.map((path) => [path, null]))
  }

  return new Map(data.map((item) => [item.path, item.signedUrl]))
}
