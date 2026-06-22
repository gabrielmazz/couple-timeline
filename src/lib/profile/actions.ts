import { z } from 'zod'
import { supabase } from '../supabase/client'
import { requireUser } from '../timeline/queries'
import type { ProfileFormModel, RelationshipFormModel } from '../../types/profile'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.')

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(100, 'Use até 100 caracteres.'),
  birthDate: isoDateSchema.optional().or(z.literal('')),
  bio: z.string().trim().max(500, 'Use até 500 caracteres.'),
})

const relationshipSchema = z.object({
  coupleId: z.string().uuid(),
  startedAt: isoDateSchema.optional().or(z.literal('')),
})

function ensureDateIsNotInFuture(value: string, message: string) {
  if (value && value > new Date().toISOString().slice(0, 10)) {
    throw new Error(message)
  }
}

export async function updateUserProfile(input: ProfileFormModel) {
  const user = await requireUser()
  const parsed = profileSchema.parse(input)
  ensureDateIsNotInFuture(parsed.birthDate ?? '', 'A data de nascimento não pode estar no futuro.')

  const { error: authError } = await supabase.auth.updateUser({
    data: { name: parsed.name },
  })

  if (authError) {
    throw authError
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      name: parsed.name,
      birth_date: parsed.birthDate || null,
      bio: parsed.bio || null,
    })
    .eq('id', user.id)

  if (error) {
    throw error
  }
}

export async function updateRelationshipDetails(input: RelationshipFormModel & { coupleId: string }) {
  await requireUser()
  const parsed = relationshipSchema.parse(input)
  ensureDateIsNotInFuture(parsed.startedAt ?? '', 'A data do relacionamento não pode estar no futuro.')

  const { error } = await supabase.rpc('update_relationship_started_at', {
    target_couple_id: parsed.coupleId,
    relationship_start_date: parsed.startedAt || null,
  })

  if (error) {
    throw error
  }
}
