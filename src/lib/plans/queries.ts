import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '../firebase/client'
import { getCouple } from '../timeline/queries'
import { sortMonthlyPlans } from './ranking'
import type { CoupleMonthlyPlan } from '../../types/database'
import type { MonthlyPlansPageData } from '../../types/plans'

export function getMonthStartIso(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function getNextMonthStart(monthStart: string) {
  const [year, month] = monthStart.split('-').map(Number)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
}

export function getPreviousMonthStart(monthStart: string) {
  const [year, month] = monthStart.split('-').map(Number)
  const previousMonth = month === 1 ? 12 : month - 1
  const previousYear = month === 1 ? year - 1 : year

  return `${previousYear}-${String(previousMonth).padStart(2, '0')}-01`
}

export function formatMonthLabel(monthStart: string) {
  const [year, month] = monthStart.split('-').map(Number)

  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

export async function fetchMonthlyPlansPage(coupleId: string, monthStart: string): Promise<MonthlyPlansPageData> {
  const { couple, canEdit } = await getCouple(coupleId)

  if (!canEdit) {
    throw new Error('Você não tem permissão para visualizar os planos deste casal.')
  }

  const data = await getDocs(query(collection(firestore, 'couple_monthly_plans'), where('couple_id', '==', coupleId)))

  return {
    couple,
    plans: sortMonthlyPlans(data.docs.map((item) => item.data() as CoupleMonthlyPlan).filter((plan) => plan.month_start === monthStart)),
    canEdit,
  }
}
