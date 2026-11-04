import { describe, expect, it, vi } from 'vitest'
import worker, { googleMapsUrl, normalizeCitySuggestions, normalizeOSMPlaces } from './index'
import { canEditCouple, canReadCouple, verifyFirebaseIdToken } from './firebase'
import * as firebaseAccess from './firebase'

const coupleId = '11111111-1111-4111-8111-111111111111'

describe('copying timeline images', () => {
  it('checks both timelines before copying and keeps the original object', async () => {
    const access = vi.spyOn(firebaseAccess, 'canEditCouple')
    const source = `couples/${coupleId}/events/22222222-2222-4222-8222-222222222222/image.jpg`
    const target = '33333333-3333-4333-8333-333333333333'
    const bucket = {
      get: vi.fn().mockResolvedValue({ body: new ReadableStream(), httpMetadata: { contentType: 'image/jpeg' }, customMetadata: {} }),
      put: vi.fn().mockResolvedValue({}), delete: vi.fn(),
    }
    const request = () => new Request('https://worker.test/api/images/copy', {
      method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [source], targetCoupleId: target }),
    }) as Parameters<typeof worker.fetch>[0]
    try {
      access.mockResolvedValue(false)
      const denied = await worker.fetch(request(), { TIMELINE_IMAGES: bucket } as unknown as Env, {} as ExecutionContext)
      expect(denied.status).toBe(403)
      expect(bucket.get).not.toHaveBeenCalled()
      access.mockResolvedValue(true)
      const response = await worker.fetch(request(), { TIMELINE_IMAGES: bucket } as unknown as Env, {} as ExecutionContext)
      expect(response.status).toBe(200)
      const result = await response.json() as { paths: Record<string, string> }
      expect(result.paths[source]).toMatch(new RegExp(`^couples/${target}/events/22222222-2222-4222-8222-222222222222/`))
      expect(bucket.put).toHaveBeenCalledOnce()
      expect(bucket.delete).not.toHaveBeenCalled()
    } finally {
      access.mockRestore()
    }
  })
})

describe('plan suggestions worker', () => {
  it('rejects missing authentication and invalid query parameters', async () => {
    const missingAuthentication = await worker.fetch(
      new Request('https://worker.test/api/plans/suggestions'),
      {} as Env,
      {} as ExecutionContext,
    )
    const invalidQuery = await worker.fetch(
      new Request(`https://worker.test/api/plans/suggestions?coupleId=${coupleId}&radiusKm=99`, {
        headers: { Authorization: 'Bearer test-token' },
      }),
      {} as Env,
      {} as ExecutionContext,
    )

    expect(missingAuthentication.status).toBe(401)
    expect(invalidQuery.status).toBe(400)

    const invalidGeocode = await worker.fetch(
      new Request(`https://worker.test/api/plans/geocode?coupleId=${coupleId}&q=C`, {
        headers: { Authorization: 'Bearer test-token' },
      }),
      {} as Env,
      {} as ExecutionContext,
    )

    expect(invalidGeocode.status).toBe(400)
  })

  it('returns forbidden for an invalid Firebase token', async () => {
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('false', { status: 200 })))

    try {
      const response = await worker.fetch(
        new Request(`https://worker.test/api/plans/suggestions?coupleId=${coupleId}&city=Curitiba`, {
          headers: { Authorization: 'Bearer test-token' },
        }),
        {
          FIREBASE_PROJECT_ID: 'couple-timeline-3eae7',
        } as Env,
        {} as ExecutionContext,
      )

      expect(response.status).toBe(403)
    } finally {
      vi.stubGlobal('fetch', originalFetch)
    }
  })

  it('tries the backup server and does not cache failed place searches', async () => {
    const access = vi.spyOn(firebaseAccess, 'canEditCouple').mockResolvedValue(true)
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) }
    let available = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('open-meteo')) return Response.json({ current: { temperature_2m: 20, weather_code: 0 } })
      if (url.includes('overpass-api.de') && available) {
        return Response.json({ elements: [{ type: 'node', id: 1, lat: -25.43, lon: -49.27, tags: { name: 'Café', amenity: 'cafe' } }] })
      }
      return new Response(null, { status: 503 })
    })
    vi.stubGlobal('caches', { default: cache })
    vi.stubGlobal('fetch', fetchMock)
    const request = () => new Request(`https://worker.test/api/plans/suggestions?coupleId=${coupleId}&latitude=-25.43&longitude=-49.27&categories=Caf%C3%A9`, { headers: { Authorization: 'Bearer token' } }) as Parameters<typeof worker.fetch>[0]
    try {
      const failed = await worker.fetch(request(), {} as Env, {} as ExecutionContext)
      expect(failed.status).toBe(503)
      expect(cache.put).not.toHaveBeenCalled()
      available = true
      const recovered = await worker.fetch(request(), {} as Env, {} as ExecutionContext)
      expect(recovered.status).toBe(200)
      expect(await recovered.json()).toMatchObject({ places: [{ id: 'node/1', name: 'Café' }] })
      expect(cache.put).toHaveBeenCalledOnce()
    } finally {
      access.mockRestore()
      vi.unstubAllGlobals()
    }
  }, 10000)

  it('removes places without names or coordinates and creates Google Maps links', () => {
    const places = normalizeOSMPlaces(
      [
        { type: 'node', id: 1, lat: -25.43, lon: -49.27, tags: { name: 'Café do casal', amenity: 'cafe' } },
        { type: 'node', id: 1, lat: -25.43, lon: -49.27, tags: { name: 'Duplicado', amenity: 'cafe' } },
        { type: 'node', id: 2, tags: { amenity: 'restaurant' } },
      ],
      { label: 'Curitiba', city: 'Curitiba', latitude: -25.43, longitude: -49.27 },
      ['Café', 'Restaurante'],
    )

    expect(places).toHaveLength(1)
    expect(places[0]?.name).toBe('Café do casal')
    expect(places[0]?.googleMapsUrl).toBe(googleMapsUrl(-25.43, -49.27))
  })

  it('normalizes city suggestions and removes incomplete results', () => {
    const suggestions = normalizeCitySuggestions([
      {
        place_id: 1,
        osm_type: 'relation',
        osm_id: 2,
        display_name: 'Cascavel, Paraná, Brasil',
        lat: '-24.9555',
        lon: '-53.4552',
        address: { city: 'Cascavel', state: 'Paraná', country: 'Brasil' },
      },
      { place_id: 3, display_name: 'Sem coordenadas', address: { city: 'Cascavel' } },
    ])

    expect(suggestions).toEqual([
      {
        id: 'relation/2',
        label: 'Cascavel, Paraná, Brasil',
        city: 'Cascavel',
        latitude: -24.9555,
        longitude: -53.4552,
      },
    ])
  })
})

describe('Firebase worker authorization', () => {
  it('verifies Firebase signatures and reads membership through Firestore rules', async () => {
    const key = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
      true, ['sign', 'verify'],
    ) as CryptoKeyPair
    const jwk = await crypto.subtle.exportKey('jwk', key.publicKey)
    Object.assign(jwk, { kid: 'test-key' })
    const project = 'couple-timeline-3eae7'
    const uid = 'firebase-test-user'
    const now = Math.floor(Date.now() / 1000)
    const base64url = (bytes: Uint8Array) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const part = (value: object) => base64url(new TextEncoder().encode(JSON.stringify(value)))
    const payload = `${part({ alg: 'RS256', kid: 'test-key' })}.${part({ aud: project, iss: `https://securetoken.google.com/${project}`, sub: uid, iat: now - 1, auth_time: now - 2, exp: now + 300 })}`
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.privateKey, new TextEncoder().encode(payload))
    const token = `${payload}.${base64url(new Uint8Array(signature))}`
    let memberAllowed = true
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/jwk/')) return Response.json({ keys: [jwk] }, { headers: { 'Cache-Control': 'max-age=300' } })
      if (url.includes('/couples/')) return Response.json({ fields: { visibility: { stringValue: 'private' } } })
      if (url.includes('/access/')) {
        expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${token}`)
        if (!memberAllowed) return new Response(null, { status: 403 })
        return Response.json({ fields: { role: { stringValue: 'owner' } } })
      }
      return new Response(null, { status: 403 })
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const env = { FIREBASE_PROJECT_ID: project } as Env
      expect(await verifyFirebaseIdToken(token, project)).toBe(uid)
      expect(await verifyFirebaseIdToken(`${payload}.${base64url(new TextEncoder().encode('forged'))}`, project)).toBeNull()
      expect(await verifyFirebaseIdToken(token, 'wrong-project')).toBeNull()
      expect(await canEditCouple(env, coupleId, token)).toBe(true)
      memberAllowed = false
      expect(await canEditCouple(env, coupleId, token)).toBe(false)
      expect(await canEditCouple(env, coupleId, 'invalid')).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('requires access to both child and parent for public images', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith(`/couples/${coupleId}`)) {
        return Response.json({ fields: { parent_id: { stringValue: '22222222-2222-4222-8222-222222222222' } } })
      }
      return new Response(null, { status: 403 })
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      expect(await canReadCouple({ FIREBASE_PROJECT_ID: 'couple-timeline-3eae7' } as Env, coupleId, null)).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('does not grant anonymous access when Firestore denies the private timeline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })))
    try {
      const env = { FIREBASE_PROJECT_ID: 'couple-timeline-3eae7' } as Env
      expect(await canReadCouple(env, coupleId, null)).toBe(false)
      expect(await canReadCouple(env, coupleId, 'invalid')).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
