import { z } from 'zod'
import { supabase } from '../supabase/client'
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
    reminder_days_before: parsed.reminderDaysBefore,
  }
}

export async function createCalendarEntry(input: CreateCalendarEntryInput) {
  const user = await requireUser()
  const coupleId = await requireEditableRootTimeline(input.coupleId)

  const { data, error } = await supabase
    .from('couple_calendar_entries')
    .insert({
      couple_id: coupleId,
      created_by: user.id,
      ...toDatabaseValues(input),
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as CoupleCalendarEntry
}

export async function updateCalendarEntry(input: UpdateCalendarEntryInput) {
  await requireUser()
  const coupleId = await requireEditableRootTimeline(input.coupleId)

  const { data, error } = await supabase
    .from('couple_calendar_entries')
    .update(toDatabaseValues(input))
    .eq('id', input.entryId)
    .eq('couple_id', coupleId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as CoupleCalendarEntry
}

export async function deleteCalendarEntry(coupleId: string, entryId: string) {
  await requireUser()
  const rootId = await requireEditableRootTimeline(coupleId)
  const { error } = await supabase
    .from('couple_calendar_entries')
    .delete()
    .eq('id', entryId)
    .eq('couple_id', rootId)

  if (error) {
    throw error
  }
}
