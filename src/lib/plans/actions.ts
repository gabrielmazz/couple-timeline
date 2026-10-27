import { z } from 'zod'
import { doc, runTransaction, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/client'
import { makeTimelineEvent, todayDate } from '../future/firestore-event'
import { getUserTimelineTree, requireUser } from '../timeline/queries'
import type { CoupleCalendarEntry, CoupleMonthlyPlan, MonthlyPlanCategory, MonthlyPlanSource, MonthlyPlanStatus } from '../../types/database'
import type { MonthlyPlanFormValues, MonthlyPlanWriteValues } from '../../types/plans'

export const monthlyPlanCategories = [
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
] as const satisfies readonly MonthlyPlanCategory[]

export const monthlyPlanSchema = z.object({
  coupleId: z.string().uuid(),
  monthStart: z.string().regex(/^\d{4}-\d{2}-01$/, 'Informe um mês válido.'),
  title: z.string().trim().min(2, 'Informe um título.').max(120, 'Use até 120 caracteres.'),
  description: z.string().trim().max(5000, 'Use até 5000 caracteres.'),
  category: z.enum(monthlyPlanCategories),
  status: z.enum(['idea', 'planned', 'completed']),
  scheduledDate: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.'),
  locationName: z.string().trim().max(120, 'Use até 120 caracteres.'),
  source: z.enum(['manual', 'internal', 'openstreetmap']).optional(),
  address: z.string().trim().max(240, 'Use até 240 caracteres.').nullable().optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  sourcePlaceId: z.string().trim().max(120).nullable().optional(),
  googleMapsUrl: z.string().url().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
}).superRefine((values, context) => {
  if ((values.latitude === null) !== (values.longitude === null)) {
    context.addIssue({ code: 'custom', path: ['locationName'], message: 'As coordenadas do local estão incompletas.' })
  }

  if (values.scheduledDate && values.scheduledDate.slice(0, 7) !== values.monthStart.slice(0, 7)) {
    context.addIssue({ code: 'custom', path: ['scheduledDate'], message: 'A data deve pertencer ao mês selecionado.' })
  }
})

async function requireEditableRootTimeline(coupleId: string) {
  const tree = await getUserTimelineTree()

  if (!tree || tree.root.id !== coupleId || (tree.memberRole !== 'owner' && tree.memberRole !== 'partner')) {
    throw new Error('Você não tem permissão para alterar os planos deste casal.')
  }

  return tree.root.id
}

function toDatabaseValues(values: MonthlyPlanWriteValues) {
  const parsed = monthlyPlanSchema.parse(values)

  return {
    couple_id: parsed.coupleId,
    month_start: parsed.monthStart,
    title: parsed.title,
    description: parsed.description || null,
    category: parsed.category,
    status: parsed.status,
    scheduled_date: parsed.scheduledDate || null,
    location_name: parsed.locationName || null,
    address: parsed.address || null,
    latitude: parsed.latitude ?? null,
    longitude: parsed.longitude ?? null,
    source: parsed.source ?? 'manual',
    source_place_id: parsed.sourcePlaceId ?? null,
    google_maps_url: parsed.googleMapsUrl ?? null,
    source_url: parsed.sourceUrl ?? null,
  }
}

export async function createMonthlyPlan(values: MonthlyPlanWriteValues) {
  const user = await requireUser()
  const coupleId = await requireEditableRootTimeline(values.coupleId)
  const now = new Date().toISOString()
  const data: CoupleMonthlyPlan = {
    id: crypto.randomUUID(), ...toDatabaseValues({ ...values, coupleId }), created_by: user.id,
    calendar_entry_id: null, completed_event_id: null, completed_at: null, created_at: now, updated_at: now,
  }
  await setDoc(doc(firestore, 'couple_monthly_plans', data.id), data)
  return data
}

async function mutatePlan(planId: string, coupleId: string, change: (plan: CoupleMonthlyPlan) => CoupleMonthlyPlan | null) {
  await requireUser()
  const rootId = await requireEditableRootTimeline(coupleId)
  return runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'couple_monthly_plans', planId)
    const current = (await tx.get(ref)).data() as CoupleMonthlyPlan | undefined
    if (!current || current.couple_id !== rootId) throw new Error('Plano mensal não encontrado.')
    const next = change(current)
    if (next) tx.set(ref, next)
    else tx.delete(ref)
    return next
  })
}

export async function updateMonthlyPlan(planId: string, values: MonthlyPlanWriteValues) {
  const next = await mutatePlan(planId, values.coupleId, (current) => ({
    ...current, ...toDatabaseValues(values), updated_at: new Date().toISOString(),
  }))
  if (!next) throw new Error('Plano mensal não encontrado.')
  return next
}

export async function updateMonthlyPlanStatus(planId: string, coupleId: string, status: MonthlyPlanStatus) {
  const next = await mutatePlan(planId, coupleId, (current) => ({ ...current, status, updated_at: new Date().toISOString() }))
  if (!next) throw new Error('Plano mensal não encontrado.')
  return next
}

export async function deleteMonthlyPlan(planId: string, coupleId: string) {
  await mutatePlan(planId, coupleId, () => null)
}

export async function addMonthlyPlanToCalendar(planId: string) {
  const user = await requireUser()
  return runTransaction(firestore, async (tx) => {
    const planRef = doc(firestore, 'couple_monthly_plans', planId)
    const plan = (await tx.get(planRef)).data() as CoupleMonthlyPlan | undefined
    if (!plan) throw new Error('Plano mensal não encontrado.')
    if (plan.calendar_entry_id) return plan.calendar_entry_id
    if (!plan.scheduled_date) throw new Error('Escolha uma data antes de adicionar o plano ao calendário.')
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const entry: CoupleCalendarEntry = {
      id, couple_id: plan.couple_id, title: plan.title, description: plan.description,
      event_date: plan.scheduled_date, event_time: null, location_name: plan.location_name ?? plan.address,
      category: 'other', recurrence: 'none', reminder_days_before: 0, created_by: user.id, created_at: now, updated_at: now,
    }
    tx.set(doc(firestore, 'couple_calendar_entries', id), entry)
    tx.update(planRef, { calendar_entry_id: id, updated_at: now })
    return id
  })
}

export async function completeMonthlyPlan(planId: string, createTimelineMemory: boolean) {
  const user = await requireUser()
  return runTransaction(firestore, async (tx) => {
    const planRef = doc(firestore, 'couple_monthly_plans', planId)
    const plan = (await tx.get(planRef)).data() as CoupleMonthlyPlan | undefined
    if (!plan) throw new Error('Plano mensal não encontrado.')
    if (plan.status === 'completed' || plan.completed_event_id) return plan.completed_event_id
    const now = new Date().toISOString()
    const id = createTimelineMemory ? crypto.randomUUID() : null
    if (id) {
      const event = makeTimelineEvent({
        id, coupleId: plan.couple_id, userId: user.id, date: plan.scheduled_date ?? todayDate(),
        title: plan.title, description: plan.description, location: plan.location_name ?? plan.address, category: 'Outro',
      })
      tx.set(doc(firestore, 'timeline_events', id), event)
    }
    tx.update(planRef, { status: 'completed', completed_at: plan.completed_at ?? now, completed_event_id: id, updated_at: now })
    return id
  })
}
export function toMonthlyPlanFormValues(plan: CoupleMonthlyPlan): MonthlyPlanFormValues {
  return {
    title: plan.title,
    description: plan.description ?? '',
    category: plan.category,
    status: plan.status,
    scheduledDate: plan.scheduled_date ?? '',
    locationName: plan.location_name ?? '',
  }
}

export function buildMonthlyPlanFromSuggestion(
  coupleId: string,
  monthStart: string,
  suggestion: {
    name: string
    category: MonthlyPlanCategory
    address: string | null
    latitude: number
    longitude: number
    id: string
    googleMapsUrl: string
    sourceUrl: string
  },
) {
  return {
    coupleId,
    monthStart,
    title: suggestion.name,
    description: 'Lugar encontrado nas sugestões para vocês conhecerem juntos.',
    category: suggestion.category,
    status: 'idea' as const,
    scheduledDate: '',
    locationName: suggestion.name,
    source: 'openstreetmap' as MonthlyPlanSource,
    address: suggestion.address,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    sourcePlaceId: suggestion.id,
    googleMapsUrl: suggestion.googleMapsUrl,
    sourceUrl: suggestion.sourceUrl,
  }
}

