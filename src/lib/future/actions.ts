import { z } from 'zod'
import { doc, runTransaction, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/client'
import { requireUser } from '../timeline/queries'
import { makeTimelineEvent, todayDate } from './firestore-event'
import type { FutureMoment, FutureMomentCategory, FutureMomentStatus } from '../../types/database'

const futureMomentCategories = [
  'Viagem',
  'Lugar',
  'Restaurante',
  'Filme ou série',
  'Meta',
  'Sonho',
  'Outro',
] as const satisfies readonly FutureMomentCategory[]

const futureMomentStatuses = ['planned', 'in_progress', 'completed'] as const satisfies readonly FutureMomentStatus[]

const futureMomentSchema = z.object({
  coupleId: z.string().uuid(),
  title: z.string().trim().min(2, 'Informe um título.').max(120, 'Use até 120 caracteres.'),
  description: z.string().trim().max(5000, 'Use até 5000 caracteres.').optional(),
  category: z.enum(futureMomentCategories),
  status: z.enum(futureMomentStatuses),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.')
    .optional()
    .or(z.literal('')),
  locationName: z.string().trim().max(120, 'Use até 120 caracteres.').optional(),
})

export type FutureMomentInput = z.infer<typeof futureMomentSchema>

async function ensureFutureMomentAccess() {
  return requireUser()
}

function getFutureMomentRow(input: FutureMomentInput) {
  const parsed = futureMomentSchema.parse(input)

  return {
    title: parsed.title,
    description: parsed.description || null,
    category: parsed.category,
    status: parsed.status,
    target_date: parsed.targetDate || null,
    location_name: parsed.locationName || null,
  }
}

export async function createFutureMoment(input: FutureMomentInput) {
  const parsed = futureMomentSchema.parse(input)
  const user = await ensureFutureMomentAccess()

  const now = new Date().toISOString()
  const data: FutureMoment = { id: crypto.randomUUID(), couple_id: parsed.coupleId, created_by: user.id, ...getFutureMomentRow(parsed), completed_at: null, completed_event_id: null, created_at: now, updated_at: now }
  await setDoc(doc(firestore, 'future_moments', data.id), data)
  return data
}

export async function updateFutureMoment(momentId: string, input: FutureMomentInput) {
  const parsed = futureMomentSchema.parse(input)
  await ensureFutureMomentAccess()

  return runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'future_moments', momentId)
    const current = (await tx.get(ref)).data() as FutureMoment | undefined
    if (!current || current.couple_id !== parsed.coupleId) throw new Error('Momento futuro não encontrado.')
    const data = { ...current, ...getFutureMomentRow(parsed), completed_at: parsed.status === 'completed' ? current.completed_at ?? new Date().toISOString() : null, completed_event_id: parsed.status === 'completed' ? current.completed_event_id : null, updated_at: new Date().toISOString() }
    tx.set(ref, data)
    return data
  })
}

export async function deleteFutureMoment(momentId: string, coupleId: string) {
  await ensureFutureMomentAccess()

  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'future_moments', momentId)
    const current = (await tx.get(ref)).data() as FutureMoment | undefined
    if (!current || current.couple_id !== coupleId) throw new Error('Momento futuro não encontrado.')
    tx.delete(ref)
  })
}

export async function completeFutureMoment(momentId: string) {
  const user = await requireUser()
  return runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'future_moments', momentId)
    const current = (await tx.get(ref)).data() as FutureMoment | undefined
    if (!current) throw new Error('Momento futuro não encontrado.')
    if (current.completed_event_id) return current.completed_event_id
    const id = crypto.randomUUID()
    const event = makeTimelineEvent({ id, coupleId: current.couple_id, userId: user.id, date: current.target_date ?? todayDate(), title: current.title, description: current.description, location: current.location_name, category: current.category === 'Viagem' ? 'Viagem' : 'Outro' })
    tx.set(doc(firestore, 'timeline_events', id), event)
    tx.update(ref, { status: 'completed', completed_at: new Date().toISOString(), completed_event_id: id, updated_at: new Date().toISOString() })
    return id
  })
}
