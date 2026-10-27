import { z } from 'zod'
import { canEditCouple, canReadCouple } from './firebase'

type ParsedImagePath = {
  path: string
  coupleId: string
  eventId: string
}

type HmacKeyUsage = 'sign' | 'verify'

const encoder = new TextEncoder()
const uuidPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const imagePathPattern = new RegExp(`^couples\\/(${uuidPattern})\\/events\\/(${uuidPattern})\\/.+$`)
const acceptedImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const defaultAllowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://gabrielmazz.github.io']
const maxImageSize = 5 * 1024 * 1024
const maxPathsPerRequest = 200
const defaultReadUrlTtlSeconds = 60 * 60
const suggestionsCacheTtlSeconds = 6 * 60 * 60
const geocodeCacheTtlSeconds = 24 * 60 * 60
const maxSuggestionResults = 24
const nominatimUserAgent = 'couple-timeline/1.0 (https://github.com/gabrielmazz/couple-timeline)'
let lastNominatimRequestAt = 0
const suggestionCategories = [
  'Restaurante',
  'Café',
  'Parque',
  'Museu',
  'Cinema',
  'Teatro',
  'Bar',
  'Praia',
  'Trilha',
  'Centro cultural',
  'Atividade',
  'Outro',
] as const
type SuggestionCategory = (typeof suggestionCategories)[number]

const suggestionCategoryTags: Record<SuggestionCategory, string[]> = {
  Restaurante: ['amenity=restaurant'],
  Café: ['amenity=cafe'],
  Parque: ['leisure=park'],
  Museu: ['tourism=museum'],
  Cinema: ['amenity=cinema'],
  Teatro: ['amenity=theatre'],
  Bar: ['amenity=bar'],
  Praia: ['natural=beach'],
  Trilha: ['route=hiking'],
  'Centro cultural': ['amenity=arts_centre', 'amenity=community_centre'],
  Atividade: ['leisure=fitness_centre', 'leisure=sports_centre', 'leisure=swimming_pool'],
  Outro: ['amenity=community_centre', 'tourism=attraction'],
}

const suggestionsQuerySchema = z.object({
  coupleId: z.string().uuid('Casal inválido.'),
  city: z.string().trim().min(2).max(160).optional(),
  latitude: z.coerce.number().finite().min(-90).max(90).optional(),
  longitude: z.coerce.number().finite().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().finite().min(1).max(15).default(5),
  categories: z.string().trim().optional(),
})

const geocodeQuerySchema = z.object({
  coupleId: z.string().uuid('Casal inválido.'),
  query: z.string().trim().min(2).max(160),
  limit: z.coerce.number().int().min(1).max(5).default(5),
})

export type SuggestionLocation = {
  label: string
  city: string | null
  latitude: number
  longitude: number
}

export type OSMElement = {
  type?: string
  id?: number
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  tags?: Record<string, string | undefined>
}

type NominatimResult = {
  place_id?: number
  osm_type?: string
  osm_id?: number
  display_name?: string
  lat?: string
  lon?: string
  address?: {
    city?: string
    town?: string
    municipality?: string
    village?: string
    state?: string
    country?: string
  }
}

function roundCoordinate(value: number) {
  return value.toFixed(3)
}

function normalizeSuggestionCategories(input: string | undefined): SuggestionCategory[] | null {
  const requested = (input ?? '')
    .split(',')
    .map((category) => category.trim())
    .filter(Boolean)

  const invalidCategory = requested.find((category) => !suggestionCategories.includes(category as SuggestionCategory))

  if (invalidCategory) return null

  const categories = Array.from(new Set(requested)) as SuggestionCategory[]

  return categories.length > 0 ? categories : [...suggestionCategories]
}

function haversineDistanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const earthRadiusKm = 6371
  const latitudeDelta = ((latitudeB - latitudeA) * Math.PI) / 180
  const longitudeDelta = ((longitudeB - longitudeA) * Math.PI) / 180
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos((latitudeA * Math.PI) / 180) *
      Math.cos((latitudeB * Math.PI) / 180) *
      Math.sin(longitudeDelta / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function googleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
}

function createSuggestionsCacheKey(request: Request, location: SuggestionLocation, radiusKm: number, categories: SuggestionCategory[]) {
  const url = new URL(request.url)
  const categoryKey = [...categories].sort().join(',')

  return new Request(
    `${url.origin}/api/plans/suggestions?lat=${roundCoordinate(location.latitude)}&lng=${roundCoordinate(location.longitude)}&radius=${radiusKm}&categories=${encodeURIComponent(categoryKey)}`,
  )
}

async function fetchExternalJson<T>(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 9000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(input, { ...init, signal: controller.signal })

    if (!response.ok) {
      throw new Error(`Fonte externa respondeu com ${response.status}.`)
    }

    return await response.json<T>()
  } finally {
    clearTimeout(timeout)
  }
}

async function waitForNominatimSlot() {
  const waitMs = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt))

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }

  lastNominatimRequestAt = Date.now()
}

async function resolveSuggestionLocation(city: string): Promise<SuggestionLocation | null> {
  await waitForNominatimSlot()
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', city)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '1')
  const results = await fetchExternalJson<NominatimResult[]>(
    url,
    { headers: { Accept: 'application/json', 'User-Agent': nominatimUserAgent } },
    10000,
  )
  const result = results[0]
  const latitude = Number(result?.lat)
  const longitude = Number(result?.lon)

  if (!result || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  return {
    label: result.display_name?.split(',').slice(0, 2).join(',').trim() || city,
    city: result.address?.city || result.address?.town || result.address?.municipality || result.address?.village || city,
    latitude,
    longitude,
  }
}

function createGeocodeCacheKey(request: Request, query: string, limit: number) {
  const requestUrl = new URL(request.url)
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')

  return new Request(
    `${requestUrl.origin}/api/plans/geocode?q=${encodeURIComponent(normalizedQuery)}&limit=${limit}`,
  )
}

export function normalizeCitySuggestions(results: NominatimResult[]) {
  return results
    .map((result) => {
      const latitude = Number(result.lat)
      const longitude = Number(result.lon)
      const city = result.address?.city || result.address?.town || result.address?.municipality || result.address?.village
      const label = [city, result.address?.state, result.address?.country]
        .filter(Boolean)
        .join(', ') || result.display_name?.trim() || null
      const id = result.osm_type && result.osm_id !== undefined
        ? `${result.osm_type}/${result.osm_id}`
        : result.place_id !== undefined
          ? `place/${result.place_id}`
          : null

      if (!id || !label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null
      }

      return { id, label, city: city || label, latitude, longitude }
    })
    .filter((result): result is NonNullable<typeof result> => Boolean(result))
}

async function handlePlanGeocode(request: Request, env: Env) {
  const userJwt = getBearerToken(request)

  if (!userJwt) {
    return errorResponse(request, env, 'Você precisa estar autenticado para buscar cidades.', 401)
  }

  const url = new URL(request.url)
  const parsed = geocodeQuerySchema.safeParse({
    coupleId: url.searchParams.get('coupleId') ?? undefined,
    query: url.searchParams.get('q') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  })

  if (!parsed.success) {
    return errorResponse(request, env, 'Informe pelo menos 2 caracteres para buscar uma cidade.', 400)
  }

  if (!(await canEditCouple(env, parsed.data.coupleId, userJwt))) {
    return errorResponse(request, env, 'Você não tem permissão para buscar cidades deste casal.', 403)
  }

  const cacheKey = createGeocodeCacheKey(request, parsed.data.query, parsed.data.limit)
  const cachedResponse = await caches.default.match(cacheKey)

  if (cachedResponse) {
    return jsonResponse(request, env, await cachedResponse.clone().json(), {
      headers: { 'Cache-Control': `public, max-age=${geocodeCacheTtlSeconds}` },
    })
  }

  const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search')
  nominatimUrl.searchParams.set('q', parsed.data.query)
  nominatimUrl.searchParams.set('format', 'jsonv2')
  nominatimUrl.searchParams.set('limit', String(parsed.data.limit))
  nominatimUrl.searchParams.set('addressdetails', '1')
  nominatimUrl.searchParams.set('accept-language', 'pt-BR')

  try {
    await waitForNominatimSlot()
    const results = await fetchExternalJson<NominatimResult[]>(
      nominatimUrl,
      { headers: { Accept: 'application/json', 'User-Agent': nominatimUserAgent } },
      10000,
    )
    const response = jsonResponse(request, env, { suggestions: normalizeCitySuggestions(results) }, {
      headers: { 'Cache-Control': `public, max-age=${geocodeCacheTtlSeconds}` },
    })

    await caches.default.put(cacheKey, response.clone()).catch(() => undefined)
    return response
  } catch {
    return errorResponse(request, env, 'Não foi possível buscar cidades agora.', 502)
  }
}

function buildOverpassQuery(location: SuggestionLocation, radiusKm: number, categories: SuggestionCategory[]) {
  const radiusMeters = Math.round(radiusKm * 1000)
  const filters = Array.from(new Set(categories.flatMap((category) => suggestionCategoryTags[category])))
    .map((tag) => {
      const [key, value] = tag.split('=')
      return `nwr(around:${radiusMeters},${location.latitude},${location.longitude})[${key}=${value}];`
    })
    .join('\n')

  return `[out:json][timeout:8];(${filters});out center tags;`
}

function suggestionCategoryFromTags(tags: Record<string, string | undefined> = {}): SuggestionCategory {
  if (tags.amenity === 'restaurant') return 'Restaurante'
  if (tags.amenity === 'cafe') return 'Café'
  if (tags.leisure === 'park') return 'Parque'
  if (tags.tourism === 'museum') return 'Museu'
  if (tags.amenity === 'cinema') return 'Cinema'
  if (tags.amenity === 'theatre') return 'Teatro'
  if (tags.amenity === 'bar') return 'Bar'
  if (tags.natural === 'beach') return 'Praia'
  if (tags.route === 'hiking') return 'Trilha'
  if (tags.amenity === 'arts_centre' || tags.amenity === 'community_centre') return 'Centro cultural'
  if (['fitness_centre', 'sports_centre', 'swimming_pool'].includes(tags.leisure ?? '')) return 'Atividade'
  return 'Outro'
}

function formatOsmAddress(tags: Record<string, string | undefined>) {
  return [tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb'], tags['addr:city']]
    .filter(Boolean)
    .join(', ')
}

export function normalizeOSMPlaces(elements: OSMElement[], location: SuggestionLocation, categories: SuggestionCategory[]) {
  const seen = new Set<string>()

  return elements
    .map((element) => {
      const latitude = Number(element.lat ?? element.center?.lat)
      const longitude = Number(element.lon ?? element.center?.lon)
      const name = element.tags?.name?.trim()
      const id = element.type && element.id !== undefined ? `${element.type}/${element.id}` : null

      if (!name || !id || !Number.isFinite(latitude) || !Number.isFinite(longitude) || seen.has(id)) {
        return null
      }

      seen.add(id)
      const category = suggestionCategoryFromTags(element.tags)

      if (!categories.includes(category) && !categories.includes('Outro')) {
        return null
      }

      return {
        id,
        name,
        category,
        latitude,
        longitude,
        address: formatOsmAddress(element.tags ?? {}) || null,
        distanceKm: Number(haversineDistanceKm(location.latitude, location.longitude, latitude, longitude).toFixed(1)),
        googleMapsUrl: googleMapsUrl(latitude, longitude),
        sourceUrl: `https://www.openstreetmap.org/${id}`,
      }
    })
    .filter((place): place is NonNullable<typeof place> => Boolean(place))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, maxSuggestionResults)
}

async function fetchOpenStreetMapPlaces(location: SuggestionLocation, radiusKm: number, categories: SuggestionCategory[]) {
  const response = await fetchExternalJson<{ elements?: OSMElement[] }>('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ data: buildOverpassQuery(location, radiusKm, categories) }),
  }, 12000)

  return normalizeOSMPlaces(response.elements ?? [], location, categories)
}

async function fetchSuggestionWeather(location: SuggestionLocation) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(location.latitude))
  url.searchParams.set('longitude', String(location.longitude))
  url.searchParams.set('current', 'temperature_2m,precipitation,weather_code')
  url.searchParams.set('daily', 'precipitation_probability_max')
  url.searchParams.set('forecast_days', '1')
  url.searchParams.set('timezone', 'auto')
  const response = await fetchExternalJson<{ current?: { temperature_2m?: number; precipitation?: number; weather_code?: number }; daily?: { precipitation_probability_max?: number[] } }>(url)

  return {
    temperature: typeof response.current?.temperature_2m === 'number' ? response.current.temperature_2m : null,
    precipitation: typeof response.current?.precipitation === 'number' ? response.current.precipitation : null,
    precipitationProbability: typeof response.daily?.precipitation_probability_max?.[0] === 'number' ? response.daily.precipitation_probability_max[0] : null,
    weatherCode: typeof response.current?.weather_code === 'number' ? response.current.weather_code : null,
  }
}

async function handlePlanSuggestions(request: Request, env: Env) {
  const userJwt = getBearerToken(request)

  if (!userJwt) {
    return errorResponse(request, env, 'Você precisa estar autenticado para buscar sugestões.', 401)
  }

  const url = new URL(request.url)
  const parsed = suggestionsQuerySchema.safeParse({
    coupleId: url.searchParams.get('coupleId') ?? undefined,
    city: url.searchParams.get('city') ?? undefined,
    latitude: url.searchParams.get('latitude') ?? undefined,
    longitude: url.searchParams.get('longitude') ?? undefined,
    radiusKm: url.searchParams.get('radiusKm') ?? undefined,
    categories: url.searchParams.get('categories') ?? undefined,
  })

  if (!parsed.success) {
    return errorResponse(request, env, 'Parâmetros inválidos para buscar sugestões.', 400)
  }

  const { coupleId, city, latitude, longitude, radiusKm } = parsed.data

  if ((latitude === undefined) !== (longitude === undefined) || (!city && latitude === undefined)) {
    return errorResponse(request, env, 'Informe uma cidade ou latitude e longitude.', 400)
  }

  if (!(await canEditCouple(env, coupleId, userJwt))) {
    return errorResponse(request, env, 'Você não tem permissão para buscar sugestões deste casal.', 403)
  }

  let location: SuggestionLocation | null

  try {
    location = latitude !== undefined && longitude !== undefined
      ? { label: city || 'Localização atual', city: city || null, latitude, longitude }
      : await resolveSuggestionLocation(city!)
  } catch {
    return errorResponse(request, env, 'Não foi possível localizar essa cidade agora. Tente novamente ou informe outra cidade.', 502)
  }

  if (!location) {
    return errorResponse(request, env, 'Não encontramos essa cidade. Tente informar cidade e estado.', 404)
  }

  const categories = normalizeSuggestionCategories(parsed.data.categories)
  if (!categories) {
    return errorResponse(request, env, 'Uma ou mais categorias de sugestão são inválidas.', 400)
  }
  const cacheKey = createSuggestionsCacheKey(request, location, radiusKm, categories)
  const cachedResponse = await caches.default.match(cacheKey)

  if (cachedResponse) {
    return jsonResponse(request, env, await cachedResponse.clone().json(), {
      headers: { 'Cache-Control': `public, max-age=${suggestionsCacheTtlSeconds}` },
    })
  }

  const [placesResult, weatherResult] = await Promise.allSettled([
    fetchOpenStreetMapPlaces(location, radiusKm, categories),
    fetchSuggestionWeather(location),
  ])
  const warnings: string[] = []
  const places = placesResult.status === 'fulfilled' ? placesResult.value : []
  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null

  if (placesResult.status === 'rejected') warnings.push('Não foi possível carregar os lugares próximos agora.')
  if (weatherResult.status === 'rejected') warnings.push('Não foi possível carregar o clima agora.')

  const response = jsonResponse(request, env, {
    location,
    weather,
    places,
    warnings,
  }, {
    headers: {
      'Cache-Control': `public, max-age=${suggestionsCacheTtlSeconds}`,
    },
  })

  await caches.default.put(cacheKey, response.clone()).catch(() => undefined)
  return response
}

function parseImagePath(input: unknown): ParsedImagePath | null {
  if (typeof input !== 'string') {
    return null
  }

  const path = input.trim()

  if (
    path.length === 0 ||
    path.length > 1024 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes('\0') ||
    path.includes('//') ||
    path.split('/').includes('..')
  ) {
    return null
  }

  const match = path.match(imagePathPattern)

  if (!match) {
    return null
  }

  return {
    path,
    coupleId: match[1],
    eventId: match[2],
  }
}

function normalizePathList(input: unknown) {
  if (!Array.isArray(input)) {
    throw new Error('Informe uma lista de paths.')
  }

  if (input.length > maxPathsPerRequest) {
    throw new Error(`Informe no máximo ${maxPathsPerRequest} imagens por requisição.`)
  }

  const parsed = input.map((path) => parseImagePath(path))

  if (parsed.some((path) => path === null)) {
    throw new Error('Um ou mais paths de imagem são inválidos.')
  }

  return Array.from(new Map(parsed.map((path) => [path!.path, path!])).values())
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)

  return match?.[1] ?? null
}

function getAllowedOrigins(env: Env) {
  const configuredOrigins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return Array.from(new Set([...defaultAllowedOrigins, ...configuredOrigins]))
}

function resolveAllowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get('Origin')

  if (!origin) {
    return null
  }

  const allowedOrigins = getAllowedOrigins(env)

  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return origin
  }

  return null
}

function corsHeaders(request: Request, env: Env) {
  const allowedOrigin = resolveAllowedOrigin(request, env)
  const headers = new Headers()

  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin)
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    headers.set('Access-Control-Max-Age', '86400')
    headers.set('Vary', 'Origin')
  }

  return headers
}

function jsonResponse(request: Request, env: Env, body: unknown, init?: ResponseInit) {
  const headers = corsHeaders(request, env)
  headers.set('Content-Type', 'application/json; charset=utf-8')

  for (const [key, value] of new Headers(init?.headers).entries()) {
    headers.set(key, value)
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

function errorResponse(request: Request, env: Env, message: string, status = 400) {
  return jsonResponse(request, env, { error: message }, { status })
}

function base64UrlEncode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'size' in value &&
    'type' in value &&
    'stream' in value
  )
}

async function getSigningKey(secret: string, usages: HmacKeyUsage[]) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  )
}

function signingPayload(path: string, expiresAt: number) {
  return `GET\n${path}\n${expiresAt}`
}

async function signImagePath(path: string, expiresAt: number, env: Env) {
  const key = await getSigningKey(env.IMAGE_SIGNING_SECRET, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingPayload(path, expiresAt)))

  return base64UrlEncode(signature)
}

async function verifyImageSignature(path: string, expiresAt: number, signature: string, env: Env) {
  try {
    const key = await getSigningKey(env.IMAGE_SIGNING_SECRET, ['verify'])

    return crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      encoder.encode(signingPayload(path, expiresAt)),
    )
  } catch {
    return false
  }
}

function encodeObjectPath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function createImageCacheKey(origin: string, path: string) {
  return new Request(`${origin}/images/${encodeObjectPath(path)}`)
}

function getReadUrlTtl(env: Env) {
  const configuredTtl = Number(env.READ_URL_TTL_SECONDS)

  if (Number.isFinite(configuredTtl) && configuredTtl > 0 && configuredTtl <= 24 * 60 * 60) {
    return Math.floor(configuredTtl)
  }

  return defaultReadUrlTtlSeconds
}

async function createSignedImageUrl(request: Request, env: Env, path: string) {
  const url = new URL(request.url)
  const now = Math.floor(Date.now() / 1000)
  const ttl = getReadUrlTtl(env)
  const expiresAt = Math.ceil((now + 1) / ttl) * ttl
  const signature = await signImagePath(path, expiresAt, env)

  return `${url.origin}/images/${encodeObjectPath(path)}?expires=${expiresAt}&sig=${signature}`
}

async function buildCouplePermissionMap(
  env: Env,
  paths: ParsedImagePath[],
  userJwt: string | null,
  permission: 'read' | 'edit',
) {
  const uniqueCoupleIds = Array.from(new Set(paths.map((path) => path.coupleId)))
  const entries = await Promise.all(
    uniqueCoupleIds.map(async (coupleId) => {
      const allowed =
        permission === 'read'
          ? await canReadCouple(env, coupleId, userJwt)
          : userJwt
            ? await canEditCouple(env, coupleId, userJwt)
            : false

      return [coupleId, allowed] as const
    }),
  )

  return new Map(entries)
}

async function handleSignRead(request: Request, env: Env) {
  let body: { paths?: unknown }

  try {
    body = await request.json()
  } catch {
    return errorResponse(request, env, 'Envie um JSON válido.', 400)
  }

  try {
    const paths = normalizePathList(body.paths)
    const userJwt = getBearerToken(request)
    const permissions = await buildCouplePermissionMap(env, paths, userJwt, 'read')
    const urls: Record<string, string | null> = {}

    await Promise.all(
      paths.map(async ({ path, coupleId }) => {
        urls[path] = permissions.get(coupleId) ? await createSignedImageUrl(request, env, path) : null
      }),
    )

    return jsonResponse(request, env, { urls })
  } catch (error) {
    return errorResponse(request, env, error instanceof Error ? error.message : 'Não foi possível assinar as imagens.')
  }
}

async function handleUpload(request: Request, env: Env) {
  const userJwt = getBearerToken(request)

  if (!userJwt) {
    return errorResponse(request, env, 'Você precisa estar autenticado para enviar imagens.', 401)
  }

  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return errorResponse(request, env, 'Envie um multipart/form-data válido.', 400)
  }

  const coupleId = String(formData.get('coupleId') ?? '')
  const eventId = String(formData.get('eventId') ?? '')
  const parsedPath = parseImagePath(formData.get('path'))
  const file = formData.get('file')

  if (!parsedPath || parsedPath.coupleId !== coupleId || parsedPath.eventId !== eventId) {
    return errorResponse(request, env, 'Path de imagem inválido para este evento.', 400)
  }

  if (!isUploadedFile(file)) {
    return errorResponse(request, env, 'Arquivo de imagem não enviado.', 400)
  }

  if (!acceptedImageTypes.has(file.type)) {
    return errorResponse(request, env, 'Use apenas imagens JPG, PNG ou WebP.', 400)
  }

  if (file.size > maxImageSize) {
    return errorResponse(request, env, 'Cada imagem deve ter no máximo 5MB.', 400)
  }

  if (!(await canEditCouple(env, coupleId, userJwt))) {
    return errorResponse(request, env, 'Você não tem permissão para enviar imagens nesta timeline.', 403)
  }

  const existingObject = await env.TIMELINE_IMAGES.head(parsedPath.path)

  if (existingObject) {
    return errorResponse(request, env, 'Já existe uma imagem neste path.', 409)
  }

  await env.TIMELINE_IMAGES.put(parsedPath.path, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'private, max-age=3600',
    },
    customMetadata: {
      originalName: file.name,
      uploadedFrom: 'couple-timeline-worker',
    },
  })

  return jsonResponse(request, env, { path: parsedPath.path })
}

async function handleDelete(request: Request, env: Env, executionContext: ExecutionContext) {
  const userJwt = getBearerToken(request)

  if (!userJwt) {
    return errorResponse(request, env, 'Você precisa estar autenticado para remover imagens.', 401)
  }

  let body: { paths?: unknown }

  try {
    body = await request.json()
  } catch {
    return errorResponse(request, env, 'Envie um JSON válido.', 400)
  }

  try {
    const paths = normalizePathList(body.paths)
    const permissions = await buildCouplePermissionMap(env, paths, userJwt, 'edit')
    const forbiddenPath = paths.find((path) => !permissions.get(path.coupleId))

    if (forbiddenPath) {
      return errorResponse(request, env, 'Você não tem permissão para remover uma ou mais imagens.', 403)
    }

    await Promise.all(paths.map(({ path }) => env.TIMELINE_IMAGES.delete(path)))
    const origin = new URL(request.url).origin
    executionContext.waitUntil(
      Promise.all(paths.map(({ path }) => caches.default.delete(createImageCacheKey(origin, path)))).then(() => undefined),
    )

    return jsonResponse(request, env, { deleted: paths.map(({ path }) => path) })
  } catch (error) {
    return errorResponse(request, env, error instanceof Error ? error.message : 'Não foi possível remover as imagens.')
  }
}

async function handleCopy(request: Request, env: Env) {
  const token = getBearerToken(request)
  if (!token) return errorResponse(request, env, 'Você precisa estar autenticado para copiar imagens.', 401)
  let body: { paths?: unknown; targetCoupleId?: unknown }
  try { body = await request.json() } catch { return errorResponse(request, env, 'Envie um JSON válido.', 400) }
  const paths = normalizePathList(body.paths)
  const target = typeof body.targetCoupleId === 'string' ? body.targetCoupleId : ''
  if (!paths.length || !new RegExp(`^${uuidPattern}$`).test(target) || paths.some((item) => item.eventId !== paths[0].eventId)) {
    return errorResponse(request, env, 'Destino ou imagens inválidos.', 400)
  }
  const permissions = await buildCouplePermissionMap(env, paths, token, 'edit')
  if (!(await canEditCouple(env, target, token)) || paths.some((item) => !permissions.get(item.coupleId))) {
    return errorResponse(request, env, 'Você não tem permissão para copiar essas imagens.', 403)
  }
  const copied: Record<string, string> = {}
  for (const item of paths) {
    const object = await env.TIMELINE_IMAGES.get(item.path)
    if (!object) return errorResponse(request, env, 'Uma das imagens não foi encontrada.', 404)
    const name = item.path.slice(item.path.lastIndexOf('/') + 1)
    const destination = `couples/${target}/events/${item.eventId}/${crypto.randomUUID()}-${name}`
    await env.TIMELINE_IMAGES.put(destination, object.body, { httpMetadata: object.httpMetadata, customMetadata: object.customMetadata })
    copied[item.path] = destination
  }
  return jsonResponse(request, env, { paths: copied })
}

function createBrowserImageHeaders(request: Request, env: Env, objectHeaders: Headers) {
  const headers = new Headers(objectHeaders)

  for (const [key, value] of corsHeaders(request, env).entries()) {
    headers.set(key, value)
  }

  headers.set('Cache-Control', `private, max-age=${getReadUrlTtl(env)}, immutable`)

  return headers
}

async function handleImageRead(request: Request, env: Env, url: URL, executionContext: ExecutionContext) {
  const path = decodeURIComponent(url.pathname.slice('/images/'.length))
  const parsedPath = parseImagePath(path)
  const expiresAt = Number(url.searchParams.get('expires'))
  const signature = url.searchParams.get('sig')

  if (!parsedPath || !Number.isFinite(expiresAt) || !signature) {
    return errorResponse(request, env, 'URL de imagem inválida.', 400)
  }

  if (expiresAt < Math.floor(Date.now() / 1000)) {
    return errorResponse(request, env, 'URL de imagem expirada.', 403)
  }

  if (!(await verifyImageSignature(parsedPath.path, expiresAt, signature, env))) {
    return errorResponse(request, env, 'Assinatura de imagem inválida.', 403)
  }

  const cacheKey = createImageCacheKey(url.origin, parsedPath.path)
  const cachedResponse = await caches.default.match(cacheKey)

  if (cachedResponse) {
    return new Response(cachedResponse.body, {
      headers: createBrowserImageHeaders(request, env, cachedResponse.headers),
    })
  }

  const object = await env.TIMELINE_IMAGES.get(parsedPath.path)

  if (!object) {
    return errorResponse(request, env, 'Imagem não encontrada.', 404)
  }

  const objectHeaders = new Headers()
  object.writeHttpMetadata(objectHeaders)
  objectHeaders.set('ETag', object.httpEtag)
  const browserResponse = new Response(object.body, {
    headers: createBrowserImageHeaders(request, env, objectHeaders),
  })
  const cacheHeaders = new Headers(objectHeaders)
  cacheHeaders.set('Cache-Control', `public, max-age=${getReadUrlTtl(env)}`)
  executionContext.waitUntil(
    caches.default.put(cacheKey, new Response(browserResponse.clone().body, { headers: cacheHeaders })).catch(() => undefined),
  )

  return browserResponse
}

async function routeRequest(request: Request, env: Env, executionContext: ExecutionContext) {
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) })
  }

  if (request.method === 'GET' && url.pathname === '/api/plans/geocode') {
    return handlePlanGeocode(request, env)
  }

  if (request.method === 'GET' && url.pathname === '/api/plans/suggestions') {
    return handlePlanSuggestions(request, env)
  }

  if (request.method === 'POST' && url.pathname === '/api/images/sign-read') {
    return handleSignRead(request, env)
  }

  if (request.method === 'POST' && url.pathname === '/api/images/upload') {
    return handleUpload(request, env)
  }

  if (request.method === 'POST' && url.pathname === '/api/images/delete') {
    return handleDelete(request, env, executionContext)
  }

  if (request.method === 'POST' && url.pathname === '/api/images/copy') {
    return handleCopy(request, env)
  }

  if (request.method === 'GET' && url.pathname.startsWith('/images/')) {
    return handleImageRead(request, env, url, executionContext)
  }

  return errorResponse(request, env, 'Rota não encontrada.', 404)
}

export default {
  async fetch(request, env, executionContext) {
    try {
      return await routeRequest(request, env, executionContext)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro interno no serviço de imagens.'

      return errorResponse(request, env, message, 500)
    }
  },
} satisfies ExportedHandler<Env>
