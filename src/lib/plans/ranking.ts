import type { CoupleMonthlyPlan } from '../../types/database'
import type { PlaceSuggestion } from '../../types/plans'

const statusOrder: Record<CoupleMonthlyPlan['status'], number> = {
  idea: 0,
  planned: 1,
  completed: 2,
}

const outdoorCategories = new Set(['Parque', 'Praia', 'Trilha', 'Atividade'])

export function sortMonthlyPlans(plans: CoupleMonthlyPlan[]) {
  return plans.slice().sort((first, second) => {
    const statusDifference = statusOrder[first.status] - statusOrder[second.status]
    if (statusDifference !== 0) return statusDifference

    const firstDate = first.scheduled_date ?? '9999-12-31'
    const secondDate = second.scheduled_date ?? '9999-12-31'
    if (firstDate !== secondDate) return firstDate.localeCompare(secondDate)

    return first.created_at.localeCompare(second.created_at)
  })
}

export function rankPlaceSuggestions(
  places: PlaceSuggestion[],
  weather: { weatherCode: number | null; precipitationProbability: number | null } | null,
) {
  const isRainLikely = (weather?.precipitationProbability ?? 0) >= 45 || (weather?.weatherCode ?? 0) >= 51

  return places.slice().sort((first, second) => {
    const firstWeatherScore = isRainLikely && outdoorCategories.has(first.category) ? 1 : 0
    const secondWeatherScore = isRainLikely && outdoorCategories.has(second.category) ? 1 : 0
    if (firstWeatherScore !== secondWeatherScore) return firstWeatherScore - secondWeatherScore

    return (first.distanceKm ?? Number.POSITIVE_INFINITY) - (second.distanceKm ?? Number.POSITIVE_INFINITY)
  })
}
