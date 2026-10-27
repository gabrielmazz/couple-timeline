import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/client'
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

  const snapshot = await getDocs(query(collection(firestore, 'couple_gifts'), where('couple_id', '==', profileData.tree.root.id)))
  const data = snapshot.docs.map((item) => item.data() as CoupleGift).sort((a, b) => b.created_at.localeCompare(a.created_at))

  return {
    ...profileData,
    gifts: data ?? [],
  }
}
