import { supabase } from '../supabase/client'

export const TIMELINE_BUCKET = 'timeline-photos'
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

type TimelineImageProvider = 'supabase' | 'r2' | 'r2-public'

type SignedUrlMapResponse = {
  urls?: Record<string, string | null>
  error?: string
}

type UploadImageResponse = {
  path?: string
  error?: string
}

type DeleteImagesResponse = {
  error?: string
}

const configuredImageProvider = import.meta.env.VITE_TIMELINE_IMAGE_PROVIDER as string | undefined
const configuredImageApiUrl = import.meta.env.VITE_TIMELINE_IMAGE_API_URL as string | undefined
const configuredImagePublicUrl = import.meta.env.VITE_TIMELINE_IMAGE_PUBLIC_URL as string | undefined

const normalizedImageProvider = configuredImageProvider?.trim().toLowerCase()

export const timelineImageProvider: TimelineImageProvider =
  normalizedImageProvider === 'r2'
    ? 'r2'
    : normalizedImageProvider === 'r2-public' || normalizedImageProvider === 'r2-dev'
      ? 'r2-public'
      : 'supabase'

const timelineImageApiUrl = configuredImageApiUrl?.replace(/\/+$/, '') ?? ''
const explicitTimelineImagePublicUrl = configuredImagePublicUrl?.replace(/\/+$/, '') ?? ''
const timelineImagePublicUrl =
  explicitTimelineImagePublicUrl || (timelineImageProvider === 'r2-public' ? timelineImageApiUrl : '')

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

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return session?.access_token ?? null
}

function ensureTimelineImageApiUrl() {
  if (!timelineImageApiUrl) {
    throw new Error('Configure VITE_TIMELINE_IMAGE_API_URL para usar imagens no Cloudflare R2.')
  }

  return timelineImageApiUrl
}

function ensureTimelineImagePublicUrl() {
  if (!timelineImagePublicUrl) {
    throw new Error('Configure VITE_TIMELINE_IMAGE_PUBLIC_URL para usar imagens públicas no Cloudflare R2.')
  }

  return timelineImagePublicUrl
}

async function parseImageApiResponse<T extends { error?: string }>(response: Response) {
  const data = (await response.json().catch(() => ({}))) as T

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Não foi possível concluir a operação de imagens.')
  }

  return data
}

async function uploadEventImagesToSupabase(coupleId: string, eventId: string, files: File[]) {
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

async function uploadEventImagesToR2(coupleId: string, eventId: string, files: File[]) {
  const apiUrl = ensureTimelineImageApiUrl()
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('Você precisa estar autenticado para enviar imagens.')
  }

  const uploaded: string[] = []

  try {
    for (const [index, file] of files.entries()) {
      const path = buildPhotoPath(coupleId, eventId, file, index)
      const formData = new FormData()
      formData.set('coupleId', coupleId)
      formData.set('eventId', eventId)
      formData.set('path', path)
      formData.set('file', file)

      const response = await fetch(`${apiUrl}/api/images/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })
      const data = await parseImageApiResponse<UploadImageResponse>(response)

      if (!data.path) {
        throw new Error('A API de imagens não retornou o path enviado.')
      }

      uploaded.push(data.path)
    }

    return uploaded
  } catch (error) {
    if (uploaded.length > 0) {
      await removeEventImages(uploaded)
    }

    throw error
  }
}

export async function uploadEventImages(coupleId: string, eventId: string, files: File[]) {
  const validationError = validateImageFiles(files)

  if (validationError) {
    throw new Error(validationError)
  }

  if (timelineImageProvider === 'r2') {
    return uploadEventImagesToR2(coupleId, eventId, files)
  }

  if (timelineImageProvider === 'r2-public') {
    throw new Error('O modo R2 público é apenas para leitura. Use Supabase ou Worker para enviar novas imagens.')
  }

  return uploadEventImagesToSupabase(coupleId, eventId, files)
}

async function removeEventImagesFromSupabase(paths: string[]) {
  if (paths.length === 0) {
    return
  }

  const { error } = await supabase.storage.from(TIMELINE_BUCKET).remove(paths)

  if (error) {
    throw error
  }
}

async function removeEventImagesFromR2(paths: string[]) {
  if (paths.length === 0) {
    return
  }

  const apiUrl = ensureTimelineImageApiUrl()
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('Você precisa estar autenticado para remover imagens.')
  }

  const response = await fetch(`${apiUrl}/api/images/delete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paths }),
  })

  await parseImageApiResponse<DeleteImagesResponse>(response)
}

export async function removeEventImages(paths: string[]) {
  if (timelineImageProvider === 'r2') {
    await removeEventImagesFromR2(paths)
    return
  }

  if (timelineImageProvider === 'r2-public') {
    throw new Error('O modo R2 público é apenas para leitura. Use Supabase ou Worker para remover imagens.')
  }

  await removeEventImagesFromSupabase(paths)
}

async function createSupabaseSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(TIMELINE_BUCKET)
    .createSignedUrl(path, 60 * 60)

  if (error) {
    return null
  }

  return data.signedUrl
}

async function createSupabaseSignedUrlMap(paths: string[]) {
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

async function createR2SignedUrlMap(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)))

  if (uniquePaths.length === 0) {
    return new Map<string, string | null>()
  }

  const apiUrl = ensureTimelineImageApiUrl()
  const accessToken = await getAccessToken()
  const headers = new Headers({
    'Content-Type': 'application/json',
  })

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${apiUrl}/api/images/sign-read`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ paths: uniquePaths }),
  })

  if (!response.ok) {
    return new Map(uniquePaths.map((path) => [path, null]))
  }

  const data = (await response.json().catch(() => ({}))) as SignedUrlMapResponse

  if (data.error || !data.urls) {
    return new Map(uniquePaths.map((path) => [path, null]))
  }

  return new Map(uniquePaths.map((path) => [path, data.urls?.[path] ?? null]))
}

function buildPublicImageUrl(baseUrl: string, path: string) {
  return `${baseUrl}/${path.split('/').map(encodeURIComponent).join('/')}`
}

function createR2PublicUrlMap(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)))

  if (uniquePaths.length === 0) {
    return new Map<string, string | null>()
  }

  const publicUrl = ensureTimelineImagePublicUrl()

  return new Map(uniquePaths.map((path) => [path, buildPublicImageUrl(publicUrl, path)]))
}

export async function createSignedUrl(path: string) {
  if (timelineImageProvider === 'r2') {
    return createR2SignedUrlMap([path]).then((urls) => urls.get(path) ?? null)
  }

  if (timelineImageProvider === 'r2-public') {
    return createR2PublicUrlMap([path]).get(path) ?? null
  }

  return createSupabaseSignedUrl(path)
}

export async function createSignedUrlMap(paths: string[]) {
  if (timelineImageProvider === 'r2') {
    return createR2SignedUrlMap(paths)
  }

  if (timelineImageProvider === 'r2-public') {
    return createR2PublicUrlMap(paths)
  }

  return createSupabaseSignedUrlMap(paths)
}
