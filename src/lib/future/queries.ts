import { supabase } from '../supabase/client'
import { getCouple } from '../timeline/queries'
import type { FutureMoment } from '../../types/database'

export async function fetchFutureMoments(coupleId: string): Promise<FutureMoment[]> {
  const { canEdit } = await getCouple(coupleId)

  if (!canEdit) {
    throw new Error('Você não tem permissão para visualizar os planos deste casal.')
  }

  const { data, error } = await supabase
    .from('future_moments')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as FutureMoment[]
}

