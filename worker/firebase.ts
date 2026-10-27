const secureTokenKeysUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
const encoder = new TextEncoder()
const coupleIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type FirebasePublicKey = JsonWebKey & { kid?: string }
let cachedKeys: FirebasePublicKey[] = []
let keysExpireAt = 0

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

async function publicKeys(forceRefresh = false): Promise<FirebasePublicKey[]> {
  if (!forceRefresh && Date.now() < keysExpireAt && cachedKeys.length) return cachedKeys
  const response = await fetch(secureTokenKeysUrl)
  if (!response.ok) throw new Error('Não foi possível verificar a autenticação no Firebase.')
  const data = await response.json<{ keys?: FirebasePublicKey[] }>()
  if (!Array.isArray(data.keys)) throw new Error('Chaves públicas do Firebase inválidas.')
  cachedKeys = data.keys
  const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/i)?.[1] ?? 300)
  keysExpireAt = Date.now() + Math.min(maxAge, 86400) * 1000
  return cachedKeys
}

/** Verifies the Firebase ID token locally; the same token is also checked by Firestore rules. */
export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<string | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || token.length > 8192) return null
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))) as { alg?: string; kid?: string }
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as Record<string, unknown>
    const now = Math.floor(Date.now() / 1000)
    if (
      header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid ||
      claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 || claims.sub.includes('/') ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iat !== 'number' || claims.iat > now ||
      typeof claims.auth_time !== 'number' || claims.auth_time > now
    ) return null

    let jwk = (await publicKeys()).find((key) => key.kid === header.kid)
    if (!jwk) jwk = (await publicKeys(true)).find((key) => key.kid === header.kid)
    if (!jwk || jwk.kty !== 'RSA') return null
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`))
    return valid ? claims.sub : null
  } catch {
    return null
  }
}

type FirestoreDocument = { fields?: Record<string, { stringValue?: string }> }

async function readDocument(projectId: string, path: string, token: string | null): Promise<FirestoreDocument | null> {
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodedPath}`, { headers })
  if ([401, 403, 404].includes(response.status)) return null
  if (!response.ok) throw new Error('Não foi possível consultar as permissões no Firebase.')
  return response.json<FirestoreDocument>()
}

export async function canReadCouple(env: Env, coupleId: string, token: string | null): Promise<boolean> {
  if (!coupleIdPattern.test(coupleId)) return false
  if (token && !(await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID))) return false
  const couple = await readDocument(env.FIREBASE_PROJECT_ID, `couples/${coupleId}`, token)
  if (!couple) return false
  const parentId = couple.fields?.parent_id?.stringValue
  return !parentId || (coupleIdPattern.test(parentId) && !!(await readDocument(env.FIREBASE_PROJECT_ID, `couples/${parentId}`, token)))
}

export async function canEditCouple(env: Env, coupleId: string, token: string): Promise<boolean> {
  if (!coupleIdPattern.test(coupleId)) return false
  const uid = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID)
  if (!uid) return false
  const couple = await readDocument(env.FIREBASE_PROJECT_ID, `couples/${coupleId}`, token)
  if (!couple) return false
  const rootId = couple.fields?.parent_id?.stringValue ?? coupleId
  if (!coupleIdPattern.test(rootId)) return false
  const membership = await readDocument(env.FIREBASE_PROJECT_ID, `access/${rootId}/members/${uid}`, token)
  return ['owner', 'partner'].includes(membership?.fields?.role?.stringValue ?? '')
}
