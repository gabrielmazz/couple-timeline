import { supabase } from '../supabase/client'
import { getUserTimelineTree } from '../timeline/queries'
import type { CoupleCalendarEntry, CoupleRole, Profile, TimelineEvent } from '../../types/database'
import type { CalendarMember, CalendarPageData, CalendarTimelineEvent } from '../../types/calendar'

type CalendarMemberRow = {
  user_id: string
  role: CoupleRole
}

type ProfileRow = Pick<Profile, 'id' | 'name' | 'birth_date'>

type TimelineEventRow = Pick<
  TimelineEvent,
  'id' | 'couple_id' | 'event_date' | 'event_time' | 'title' | 'category' | 'location_name'
>

export async function fetchCalendarPage(): Promise<CalendarPageData> {
  const tree = await getUserTimelineTree()

  if (!tree) {
    throw new Error('Crie uma timeline para começar a usar o calendário.')
  }

  const timelineIds = [tree.root.id, ...tree.children.map((timeline) => timeline.id)]
  const [entriesResult, membersResult, timelineEventsResult] = await Promise.all([
    supabase
      .from('couple_calendar_entries')
      .select('*')
      .eq('couple_id', tree.root.id)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
    supabase.from('couple_members').select('user_id, role').eq('couple_id', tree.root.id),
    supabase
      .from('timeline_events')
      .select('id, couple_id, event_date, event_time, title, category, location_name')
      .in('couple_id', timelineIds)
      .order('event_date', { ascending: true })
      .order('id', { ascending: true }),
  ])

  if (entriesResult.error) {
    throw entriesResult.error
  }

  if (membersResult.error) {
    throw membersResult.error
  }

  if (timelineEventsResult.error) {
    throw timelineEventsResult.error
  }

  const memberRows = (membersResult.data ?? []) as CalendarMemberRow[]
  const profileIds = memberRows.map((member) => member.user_id)
  const profilesResult = profileIds.length
    ? await supabase.from('profiles').select('id, name, birth_date').in('id', profileIds)
    : { data: [] as ProfileRow[], error: null }

  if (profilesResult.error) {
    throw profilesResult.error
  }

  const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
  const timelineNames = new Map([
    [tree.root.id, tree.root.name],
    ...tree.children.map((timeline) => [timeline.id, timeline.name] as const),
  ])

  const timelineEvents: CalendarTimelineEvent[] = ((timelineEventsResult.data ?? []) as TimelineEventRow[]).map(
    (event) => ({
      ...event,
      timelineName: timelineNames.get(event.couple_id) ?? tree.root.name,
    }),
  )

  const members: CalendarMember[] = memberRows.map((member) => ({
    id: member.user_id,
    name: profilesById.get(member.user_id)?.name ?? null,
    birth_date: profilesById.get(member.user_id)?.birth_date ?? null,
    role: member.role,
  }))

  return {
    couple: tree.root,
    entries: (entriesResult.data ?? []) as CoupleCalendarEntry[],
    timelineEvents,
    members,
    canEdit: tree.memberRole === ('owner' as CoupleRole) || tree.memberRole === ('partner' as CoupleRole),
  }
}
