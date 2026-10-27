import type {
  Couple,
  CoupleMonthlyPlan,
  MonthlyPlanCategory,
  MonthlyPlanSource,
  MonthlyPlanStatus,
} from './database'

export const monthlyPlanCategories: { value: MonthlyPlanCategory; label: string }[] = [
  { value: 'Restaurante', label: 'Restaurante' },
  { value: 'Café', label: 'Café' },
  { value: 'Parque', label: 'Parque' },
  { value: 'Museu', label: 'Museu' },
  { value: 'Cinema', label: 'Cinema' },
  { value: 'Teatro', label: 'Teatro' },
  { value: 'Bar', label: 'Bar' },
  { value: 'Praia', label: 'Praia' },
  { value: 'Trilha', label: 'Trilha' },
  { value: 'Centro cultural', label: 'Centro cultural' },
  { value: 'Atividade', label: 'Atividade' },
  { value: 'Outro', label: 'Outro' },
]

export const monthlyPlanStatuses: { value: MonthlyPlanStatus; label: string }[] = [
  { value: 'idea', label: 'Ideias' },
  { value: 'planned', label: 'Planejados' },
  { value: 'completed', label: 'Realizados' },
]

export type MonthlyPlanFormValues = {
  title: string
  description: string
  category: MonthlyPlanCategory
  status: MonthlyPlanStatus
  scheduledDate: string
  locationName: string
}

export type SuggestionCategory = MonthlyPlanCategory

export type PlaceSuggestion = {
  id: string
  name: string
  category: MonthlyPlanCategory
  latitude: number
  longitude: number
  address: string | null
  distanceKm: number
  googleMapsUrl: string
  sourceUrl: string
}

export type CitySuggestion = {
  id: string
  label: string
  city: string
  latitude: number
  longitude: number
}

export type WeatherSummary = {
  temperature: number | null
  precipitationProbability: number | null
  weatherCode: number | null
}

export type SuggestionsResponse = {
  location: {
    label: string
    city: string | null
    latitude: number
    longitude: number
  }
  weather: WeatherSummary | null
  places: PlaceSuggestion[]
  warnings: string[]
}

export type MapPlanItem = {
  id: string
  name: string
  category: MonthlyPlanCategory
  latitude: number
  longitude: number
  address: string | null
  googleMapsUrl: string | null
  sourceUrl: string | null
  sourceLabel: string
  isSaved: boolean
}

export type MonthlyPlansPageData = {
  couple: Couple
  plans: CoupleMonthlyPlan[]
  canEdit: boolean
}

export type MonthlyPlanWriteValues = MonthlyPlanFormValues & {
  coupleId: string
  monthStart: string
  source?: MonthlyPlanSource
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  sourcePlaceId?: string | null
  googleMapsUrl?: string | null
  sourceUrl?: string | null
}
