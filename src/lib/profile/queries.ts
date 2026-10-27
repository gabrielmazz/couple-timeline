import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/client'
import { ensureProfile, getUserTimelineTree, requireUser } from '../timeline/queries'
import type { Profile } from '../../types/database'
import type { ProfilePageData } from '../../types/profile'

export async function getProfilePageData(): Promise<ProfilePageData> {
  await ensureProfile()
  const user = await requireUser()
  const profileDoc = await getDoc(doc(firestore, 'profiles', user.id))
  if (!profileDoc.exists()) throw new Error('Perfil não encontrado.')
  const profile = profileDoc.data() as Profile
  const tree = await getUserTimelineTree()
  if (!tree) return { profile, partner: null, tree: null }
  const members = await getDocs(query(collection(firestore, 'couple_members'), where('couple_id', '==', tree.root.id)))
  const partnerId = members.docs.map((item) => item.data().user_id as string).find((id) => id !== user.id)
  if (!partnerId) return { profile, partner: null, tree }
  const partnerDoc = await getDoc(doc(firestore, 'profiles', partnerId))
  return { profile, partner: partnerDoc.exists() ? partnerDoc.data() as Profile : null, tree }
}
