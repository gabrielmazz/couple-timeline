import { describe, expect, it } from 'vitest'
import { buildMonthlyPlanFromSuggestion, monthlyPlanSchema } from './actions'
import { formatMonthLabel, getMonthStartIso, getNextMonthStart, getPreviousMonthStart } from './queries'
import { rankPlaceSuggestions, sortMonthlyPlans } from './ranking'
import type { CoupleMonthlyPlan } from '../../types/database'

const coupleId = '11111111-1111-4111-8111-111111111111'

describe('monthly plan calendar helpers', () => {
  it('calcula mês anterior, atual e próximo sem depender de UTC', () => {
    expect(getMonthStartIso(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-01')
    expect(getPreviousMonthStart('2026-01-01')).toBe('2025-12-01')
    expect(getNextMonthStart('2026-12-01')).toBe('2027-01-01')
    expect(formatMonthLabel('2026-09-01')).toContain('2026')
  })
})

describe('monthly plan validation', () => {
  it('aceita plano básico e rejeita data fora do mês', () => {
    const valid = monthlyPlanSchema.safeParse({
      coupleId,
      monthStart: '2026-09-01',
      title: 'Ir ao zoológico',
      description: '',
      category: 'Atividade',
      status: 'idea',
      scheduledDate: '2026-09-11',
      locationName: 'Zoológico',
    })
    const invalid = monthlyPlanSchema.safeParse({
      coupleId,
      monthStart: '2026-09-01',
      title: 'Ir ao zoológico',
      description: '',
      category: 'Atividade',
      status: 'idea',
      scheduledDate: '2026-10-11',
      locationName: '',
    })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it('mantém coordenadas públicas e idempotência do lugar salvo', () => {
    const plan = buildMonthlyPlanFromSuggestion(coupleId, '2026-09-01', {
      id: 'node/42',
      name: 'Parque do casal',
      category: 'Parque',
      address: 'Rua das Flores',
      latitude: -23.55,
      longitude: -46.63,
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=-23.55%2C-46.63',
      sourceUrl: 'https://www.openstreetmap.org/node/42',
    })

    expect(plan).toMatchObject({ source: 'openstreetmap', sourcePlaceId: 'node/42', status: 'idea' })
    expect(monthlyPlanSchema.safeParse(plan).success).toBe(true)
  })
})

function makePlan(overrides: Partial<CoupleMonthlyPlan>): CoupleMonthlyPlan {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    couple_id: coupleId,
    month_start: '2026-09-01',
    title: overrides.title ?? 'Plano',
    description: null,
    category: 'Atividade',
    status: overrides.status ?? 'idea',
    scheduled_date: overrides.scheduled_date ?? null,
    location_name: null,
    address: null,
    latitude: null,
    longitude: null,
    source: 'manual',
    source_place_id: null,
    google_maps_url: null,
    source_url: null,
    calendar_entry_id: null,
    completed_event_id: null,
    completed_at: null,
    created_by: null,
    created_at: overrides.created_at ?? '2026-08-31T12:00:00.000Z',
    updated_at: '2026-08-31T12:00:00.000Z',
  }
}

describe('monthly plan ranking', () => {
  it('ordena ideia, planejado e realizado, priorizando data definida', () => {
    const sorted = sortMonthlyPlans([
      makePlan({ status: 'completed' }),
      makePlan({ status: 'idea', scheduled_date: '2026-09-20' }),
      makePlan({ status: 'idea', scheduled_date: '2026-09-03' }),
      makePlan({ status: 'planned' }),
    ])

    expect(sorted.map((plan) => plan.status)).toEqual(['idea', 'idea', 'planned', 'completed'])
    expect(sorted[0]?.scheduled_date).toBe('2026-09-03')
  })

  it('prefere lugares internos quando a previsão indica chuva', () => {
    const places = [
      { id: 'park', name: 'Parque', category: 'Parque' as const, latitude: 0, longitude: 0, address: null, distanceKm: 1, googleMapsUrl: 'https://maps.google.com', sourceUrl: 'https://openstreetmap.org/1' },
      { id: 'museum', name: 'Museu', category: 'Museu' as const, latitude: 0, longitude: 0, address: null, distanceKm: 4, googleMapsUrl: 'https://maps.google.com', sourceUrl: 'https://openstreetmap.org/2' },
    ]

    expect(rankPlaceSuggestions(places, { weatherCode: 61, precipitationProbability: 80 })[0]?.id).toBe('museum')
  })
})
