import { z } from 'zod'
import { firebaseAuth } from '../firebase/client'
import type { MonthlyPlanCategory } from '../../types/database'
import type { CitySuggestion, PlaceSuggestion, SuggestionsResponse } from '../../types/plans'

const monthlyPlanCategoryValues = [
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

const suggestionPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(monthlyPlanCategoryValues),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().nullable(),
  distanceKm: z.number(),
  googleMapsUrl: z.string().url(),
  sourceUrl: z.string().url(),
})

const suggestionsResponseSchema = z.object({
  location: z.object({
    label: z.string(),
    city: z.string().nullable(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  weather: z
    .object({
      temperature: z.number().nullable(),
      precipitation: z.number().nullable(),
      precipitationProbability: z.number().nullable(),
      weatherCode: z.number().nullable(),
    })
    .nullable(),
  places: z.array(suggestionPlaceSchema),
  warnings: z.array(z.string()),
})

const citySuggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  city: z.string(),
  latitude: z.number(),
  longitude: z.number(),
})

const citySuggestionsResponseSchema = z.object({
  suggestions: z.array(citySuggestionSchema),
})

function getSuggestionsApiUrl() {
  const configuredUrl = import.meta.env.VITE_SUGGESTIONS_API_URL as string | undefined
  const imageApiUrl = import.meta.env.VITE_TIMELINE_IMAGE_API_URL as string | undefined

  return (configuredUrl || imageApiUrl || '').replace(/\/$/, '')
}

async function getSuggestionsAccessToken() {
  const accessToken = await firebaseAuth.currentUser?.getIdToken()

  if (!accessToken) {
    throw new Error('Sua sessão expirou. Entre novamente para buscar sugestões.')
  }

  if (!getSuggestionsApiUrl()) {
    throw new Error('O serviço de sugestões ainda não foi configurado.')
  }

  return accessToken
}

export async function fetchPlaceSuggestions(input: {
  coupleId: string
  city?: string
  latitude?: number
  longitude?: number
  radiusKm: number
  categories: MonthlyPlanCategory[]
  signal?: AbortSignal
}): Promise<SuggestionsResponse> {
  const accessToken = await getSuggestionsAccessToken()

  if ((input.latitude === undefined) !== (input.longitude === undefined)) {
    throw new Error('A localização precisa ter latitude e longitude.')
  }

  const url = new URL(`${getSuggestionsApiUrl()}/api/plans/suggestions`)
  url.searchParams.set('coupleId', input.coupleId)
  url.searchParams.set('radiusKm', String(input.radiusKm))
  url.searchParams.set('categories', input.categories.join(','))

  if (input.city?.trim()) {
    url.searchParams.set('city', input.city.trim())
  }

  if (input.latitude !== undefined && input.longitude !== undefined) {
    url.searchParams.set('latitude', String(input.latitude))
    url.searchParams.set('longitude', String(input.longitude))
  }

  const response = await fetch(url, {
    signal: input.signal,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Não foi possível buscar sugestões agora.',
    )
  }

  return suggestionsResponseSchema.parse(body) as SuggestionsResponse
}

export async function fetchCitySuggestions(input: {
  coupleId: string
  query: string
  signal?: AbortSignal
}): Promise<CitySuggestion[]> {
  const accessToken = await getSuggestionsAccessToken()
  const url = new URL(`${getSuggestionsApiUrl()}/api/plans/geocode`)
  url.searchParams.set('coupleId', input.coupleId)
  url.searchParams.set('q', input.query.trim())
  url.searchParams.set('limit', '5')

  const response = await fetch(url, {
    signal: input.signal,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Não foi possível buscar cidades agora.',
    )
  }

  return citySuggestionsResponseSchema.parse(body).suggestions
}

export type { PlaceSuggestion }
