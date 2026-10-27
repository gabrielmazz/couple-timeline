import { z } from 'zod'
import { doc, runTransaction, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/client'
import { getUserTimelineTree, requireUser } from '../timeline/queries'
import type { CalendarEntryCategory, CoupleCalendarEntry } from '../../types/database'
import type { CalendarEntryFormModel } from '../../types/calendar'

export const calendarEntryCategories: { value: CalendarEntryCategory; label: string }[] = [
  { value: 'trip', label: 'Viagem' },
  { value: 'reservation', label: 'Reserva' },
  { value: 'appointment', label: 'Compromisso' },
  { value: 'special_date', label: 'Data especial' },
  { value: 'other', label: 'Outro' },
]

const calendarEntrySchema = z.object({
  title: z.string().trim().min(2, 'Informe um título.').max(120, 'Use até 120 caracteres.'),
  description: z.string().trim().max(2000, 'Use até 2000 caracteres.'),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.'),
  eventTime: z.string().regex(/^$|^\d{2}:\d{2}$/, 'Informe um horário válido.'),
  locationName: z.string().trim().max(120, 'Use até 120 caracteres.'),
  category: z.enum(['trip', 'reservation', 'appointment', 'special_date', 'other']),
  recurrence: z.enum(['none', 'yearly']),
  reminderDaysBefore: z.coerce.number().int().min(0).max(30),
})

export type CreateCalendarEntryInput = CalendarEntryFormModel & {
  coupleId: string
}

export type UpdateCalendarEntryInput = CreateCalendarEntryInput & {
  entryId: string
}

async function requireEditableRootTimeline(coupleId: string) {
  const tree = await getUserTimelineTree()

  if (!tree || tree.root.id !== coupleId || (tree.memberRole !== 'owner' && tree.memberRole !== 'partner')) {
    throw new Error('Você não tem permissão para alterar o calendário deste casal.')
  }

  return tree.root.id
}

function toDatabaseValues(values: CalendarEntryFormModel) {
  const parsed = calendarEntrySchema.parse(values)

  return {
    title: parsed.title,
    description: parsed.description || null,
    event_date: parsed.eventDate,
    event_time: parsed.eventTime || null,
    location_name: parsed.locationName || null,
    category: parsed.category,
    recurrence: parsed.recurrence,
    reminder_days_before: parsed.reminderDaysBefore,
  }
}

export async function createCalendarEntry(input: CreateCalendarEntryInput) {
  const user = await requireUser()
  const coupleId = await requireEditableRootTimeline(input.coupleId)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const data: CoupleCalendarEntry = { id, couple_id: coupleId, created_by: user.id, ...toDatabaseValues(input), created_at: now, updated_at: now }
  await setDoc(doc(firestore, 'couple_calendar_entries', id), data)
  return data
}

export async function updateCalendarEntry(input: UpdateCalendarEntryInput) {
  await requireUser()
  const coupleId = await requireEditableRootTimeline(input.coupleId)

  return runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'couple_calendar_entries', input.entryId)
    const snapshot = await tx.get(ref)
    const current = snapshot.data() as CoupleCalendarEntry | undefined
    if (!current || current.couple_id !== coupleId) throw new Error('Compromisso não encontrado.')
    const data = { ...current, ...toDatabaseValues(input), updated_at: new Date().toISOString() }
    tx.set(ref, data)
    return data
  })
}

export async function deleteCalendarEntry(coupleId: string, entryId: string) {
  await requireUser()
  const rootId = await requireEditableRootTimeline(coupleId)
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'couple_calendar_entries', entryId)
    const snapshot = await tx.get(ref)
    if (!snapshot.exists() || snapshot.data().couple_id !== rootId) throw new Error('Compromisso não encontrado.')
    tx.delete(ref)
  })
}
