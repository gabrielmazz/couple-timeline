import { supabase } from '../supabase/client'
import { ensureProfile, getUserTimelineTree, requireUser } from '../timeline/queries'
import type { ProfilePageData } from '../../types/profile'

export async function getProfilePageData(): Promise<ProfilePageData> {
  await ensureProfile()
  const user = await requireUser()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    throw profileError
  }

  const tree = await getUserTimelineTree()

  if (!tree) {
    return {
      profile,
      partner: null,
      tree: null,
    }
  }

  const { data: partnerMembership, error: membershipError } = await supabase
    .from('couple_members')
    .select('user_id')
    .eq('couple_id', tree.root.id)
    .neq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    throw membershipError
  }

  if (!partnerMembership) {
    return {
      profile,
      partner: null,
      tree,
    }
  }

  const { data: partner, error: partnerError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', partnerMembership.user_id)
    .single()

  if (partnerError) {
    throw partnerError
  }

  return {
    profile,
    partner,
    tree,
  }
}
