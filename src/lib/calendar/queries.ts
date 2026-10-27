import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/client'
import { getUserTimelineTree } from '../timeline/queries'
import type { CoupleCalendarEntry, CoupleMember, Profile, TimelineEvent } from '../../types/database'
import type { CalendarMember, CalendarPageData, CalendarTimelineEvent } from '../../types/calendar'

export async function fetchCalendarPage(): Promise<CalendarPageData> {
  const tree = await getUserTimelineTree()
  if (!tree) throw new Error('Crie uma timeline para começar a usar o calendário.')
  const ids = [tree.root.id, ...tree.children.map((timeline) => timeline.id)]
  const [entrySnapshot, memberSnapshot, ...eventSnapshots] = await Promise.all([
    getDocs(query(collection(firestore, 'couple_calendar_entries'), where('couple_id', '==', tree.root.id))),
    getDocs(query(collection(firestore, 'couple_members'), where('couple_id', '==', tree.root.id))),
    ...ids.map((id) => getDocs(query(collection(firestore, 'timeline_events'), where('couple_id', '==', id)))),
  ])
  const memberRows = memberSnapshot.docs.map((item) => item.data() as CoupleMember)
  const profiles = await Promise.all(memberRows.map((member) => getDoc(doc(firestore, 'profiles', member.user_id))))
  const profileMap = new Map(profiles.filter((item) => item.exists()).map((item) => [item.id, item.data() as Profile]))
  const names = new Map([[tree.root.id, tree.root.name], ...tree.children.map((item) => [item.id, item.name] as const)])
  const timelineEvents: CalendarTimelineEvent[] = eventSnapshots.flatMap((snapshot) => snapshot.docs.map((item) => {
    const event = item.data() as TimelineEvent
    return { id: event.id, couple_id: event.couple_id, event_date: event.event_date, event_time: event.event_time, title: event.title, category: event.category, location_name: event.location_name, timelineName: names.get(event.couple_id) ?? tree.root.name }
  })).sort((a, b) => a.event_date.localeCompare(b.event_date) || a.id.localeCompare(b.id))
  const entries = entrySnapshot.docs.map((item) => item.data() as CoupleCalendarEntry)
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time ?? '99').localeCompare(b.event_time ?? '99') || a.id.localeCompare(b.id))
  const members: CalendarMember[] = memberRows.map((member) => ({ id: member.user_id, name: profileMap.get(member.user_id)?.name ?? null, birth_date: profileMap.get(member.user_id)?.birth_date ?? null, role: member.role }))
  return { couple: tree.root, entries, timelineEvents, members, canEdit: tree.memberRole === 'owner' || tree.memberRole === 'partner' }
}
