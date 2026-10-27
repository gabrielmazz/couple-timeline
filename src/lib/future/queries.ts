import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/client'
import { getCouple } from '../timeline/queries'
import type { FutureMoment } from '../../types/database'

export async function fetchFutureMoments(coupleId: string): Promise<FutureMoment[]> {
  const { canEdit } = await getCouple(coupleId)

  if (!canEdit) {
    throw new Error('Você não tem permissão para visualizar os planos deste casal.')
  }

  const data = await getDocs(query(collection(firestore, 'future_moments'), where('couple_id', '==', coupleId)))
  return data.docs.map((item) => item.data() as FutureMoment).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

