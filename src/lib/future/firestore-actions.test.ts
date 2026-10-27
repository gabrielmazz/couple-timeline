import { beforeEach, describe, expect, it, vi } from 'vitest'

const database = vi.hoisted(() => new Map<string, Record<string, unknown>>())
vi.mock('../firebase/client', () => ({ firestore: {} }))
vi.mock('../timeline/queries', () => ({ requireUser: async () => ({ id: 'user-1' }), getUserTimelineTree: async () => null }))
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  setDoc: async (ref: string, value: Record<string, unknown>) => database.set(ref, value),
  runTransaction: async (_db: unknown, operation: (tx: unknown) => Promise<unknown>) => operation({
    get: async (ref: string) => ({ data: () => database.get(ref) }),
    set: (ref: string, data: Record<string, unknown>) => database.set(ref, data),
    update: (ref: string, data: Record<string, unknown>) => database.set(ref, { ...database.get(ref), ...data }),
    delete: (ref: string) => database.delete(ref),
  }),
}))

import { completeFutureMoment } from './actions'
import { addMonthlyPlanToCalendar, completeMonthlyPlan } from '../plans/actions'

describe('criação de registros derivados', () => {
  beforeEach(() => database.clear())

  it('conclui um momento sem duplicar o evento quando repetido', async () => {
    database.set('future_moments/moment-1', {
      couple_id: 'couple-1', title: 'Viagem', category: 'Viagem', target_date: '2026-07-02',
      location_name: 'Praia', description: 'Passeio', completed_event_id: null,
    })
    const id = await completeFutureMoment('moment-1')
    expect(await completeFutureMoment('moment-1')).toBe(id)
    expect(database.get(`timeline_events/${id}`)).toMatchObject({ couple_id: 'couple-1', title: 'Viagem', event_date: '2026-07-02', category: 'Viagem', created_by: 'user-1' })
    expect([...database.keys()].filter((key) => key.startsWith('timeline_events/'))).toHaveLength(1)
  })

  it('cria compromisso de plano uma única vez e exige data', async () => {
    database.set('couple_monthly_plans/plan-1', { couple_id: 'couple-1', title: 'Jantar', description: null, scheduled_date: null, calendar_entry_id: null })
    await expect(addMonthlyPlanToCalendar('plan-1')).rejects.toThrow('Escolha uma data')
    database.set('couple_monthly_plans/plan-1', { ...database.get('couple_monthly_plans/plan-1'), scheduled_date: '2026-07-02' })
    const id = await addMonthlyPlanToCalendar('plan-1')
    expect(await addMonthlyPlanToCalendar('plan-1')).toBe(id)
    expect(database.get(`couple_calendar_entries/${id}`)).toMatchObject({ couple_id: 'couple-1', event_date: '2026-07-02', title: 'Jantar' })
    expect([...database.keys()].filter((key) => key.startsWith('couple_calendar_entries/'))).toHaveLength(1)
  })

  it('conclui plano sem memória e sem criar evento', async () => {
    database.set('couple_monthly_plans/plan-1', { couple_id: 'couple-1', status: 'planned', completed_event_id: null, completed_at: null })
    expect(await completeMonthlyPlan('plan-1', false)).toBeNull()
    expect(database.get('couple_monthly_plans/plan-1')).toMatchObject({ status: 'completed', completed_event_id: null })
    expect([...database.keys()].filter((key) => key.startsWith('timeline_events/'))).toHaveLength(0)
  })
})
