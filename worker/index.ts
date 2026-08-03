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
const maxSupabaseRpcAttempts = 3
const retryableSupabaseStatuses = new Set([502, 503, 504, 520, 521, 522, 523, 524])

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

async function callSupabaseRpc<T>(
  env: Env,
  functionName: string,
  body: Record<string, unknown>,
  userJwt: string | null,
) {
  const headers = new Headers({
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${userJwt ?? env.SUPABASE_PUBLISHABLE_KEY}`,
    'Content-Type': 'application/json',
  })

  for (let attempt = 1; attempt <= maxSupabaseRpcAttempts; attempt += 1) {
    let response: Response

    try {
      response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    } catch (error) {
      if (attempt === maxSupabaseRpcAttempts) {
        throw error
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 100))
      continue
    }

    if (response.ok) {
      return response.json<T>()
    }

    const message = await response.text()

    if (!retryableSupabaseStatuses.has(response.status) || attempt === maxSupabaseRpcAttempts) {
      throw new Error(message || `Supabase RPC ${functionName} falhou.`)
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 100))
  }

  throw new Error(`Supabase RPC ${functionName} falhou.`)
}

async function canReadCouple(env: Env, coupleId: string, userJwt: string | null) {
  return callSupabaseRpc<boolean>(env, 'can_read_couple', { target_couple_id: coupleId }, userJwt)
}

async function canEditCouple(env: Env, coupleId: string, userJwt: string) {
  return callSupabaseRpc<boolean>(env, 'can_edit_couple', { target_couple_id: coupleId }, userJwt)
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

  if (request.method === 'POST' && url.pathname === '/api/images/sign-read') {
    return handleSignRead(request, env)
  }

  if (request.method === 'POST' && url.pathname === '/api/images/upload') {
    return handleUpload(request, env)
  }

  if (request.method === 'POST' && url.pathname === '/api/images/delete') {
    return handleDelete(request, env, executionContext)
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
