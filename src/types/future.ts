import type { FutureMomentCategory, FutureMomentStatus } from './database'

export const futureMomentCategories: { value: FutureMomentCategory; label: string }[] = [
  { value: 'Viagem', label: 'Viagem' },
  { value: 'Lugar', label: 'Lugar para conhecer' },
  { value: 'Restaurante', label: 'Restaurante' },
  { value: 'Filme ou série', label: 'Filme ou série' },
  { value: 'Meta', label: 'Meta do casal' },
  { value: 'Sonho', label: 'Sonho' },
  { value: 'Outro', label: 'Outro' },
]

export const futureMomentStatuses: { value: FutureMomentStatus; label: string }[] = [
  { value: 'planned', label: 'Planejado' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Realizado' },
]

export type FutureMomentFormValues = {
  title: string
  description: string
  category: FutureMomentCategory
  status: FutureMomentStatus
  targetDate: string
  locationName: string
}

export function getFutureMomentCategoryLabel(category: FutureMomentCategory) {
  return futureMomentCategories.find((item) => item.value === category)?.label ?? category
}

export function getFutureMomentStatusLabel(status: FutureMomentStatus) {
  return futureMomentStatuses.find((item) => item.value === status)?.label ?? status
}

