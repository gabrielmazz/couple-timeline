import { z } from 'zod'
import { supabase } from '../supabase/client'
import { requireUser } from '../timeline/queries'
import type { FutureMomentCategory, FutureMomentStatus } from '../../types/database'

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

  const { data, error } = await supabase
    .from('future_moments')
    .insert({
      couple_id: parsed.coupleId,
      created_by: user.id,
      ...getFutureMomentRow(parsed),
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function updateFutureMoment(momentId: string, input: FutureMomentInput) {
  const parsed = futureMomentSchema.parse(input)
  await ensureFutureMomentAccess()

  const { data: current, error: currentError } = await supabase
    .from('future_moments')
    .select('completed_at, completed_event_id')
    .eq('id', momentId)
    .eq('couple_id', parsed.coupleId)
    .single()

  if (currentError) {
    throw currentError
  }

  const { data, error } = await supabase
    .from('future_moments')
    .update({
      ...getFutureMomentRow(parsed),
      completed_at:
        parsed.status === 'completed' ? current.completed_at ?? new Date().toISOString() : null,
      completed_event_id: parsed.status === 'completed' ? current.completed_event_id : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', momentId)
    .eq('couple_id', parsed.coupleId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function deleteFutureMoment(momentId: string, coupleId: string) {
  await ensureFutureMomentAccess()

  const { error } = await supabase
    .from('future_moments')
    .delete()
    .eq('id', momentId)
    .eq('couple_id', coupleId)

  if (error) {
    throw error
  }
}

export async function completeFutureMoment(momentId: string) {
  await requireUser()

  const { data, error } = await supabase.rpc('complete_future_moment', {
    target_moment_id: momentId,
  })

  if (error) {
    throw error
  }

  return data
}
