import { supabase } from '../supabase/client'
import { getProfilePageData } from '../profile/queries'
import type { CoupleGift } from '../../types/database'
import type { ProfilePageData } from '../../types/profile'

export type GiftPageData = ProfilePageData & {
  gifts: CoupleGift[]
}

export async function getGiftPageData(): Promise<GiftPageData> {
  const profileData = await getProfilePageData()

  if (!profileData.tree) {
    return {
      ...profileData,
      gifts: [],
    }
  }

  const { data, error } = await supabase
    .from('couple_gifts')
    .select('*')
    .eq('couple_id', profileData.tree.root.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return {
    ...profileData,
    gifts: data ?? [],
  }
}
