import { z } from 'zod'
import { doc, runTransaction, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/client'
import { requireUser } from '../timeline/queries'
import type { CoupleGift, GiftCategory, GiftStatus } from '../../types/database'

export const giftCategories = [
  'Tecnologia',
  'Roupas',
  'Beleza',
  'Casa',
  'Decoração',
  'Viagem',
  'Livros',
  'Games',
  'Comida',
  'Experiência',
  'Outro',
] as const satisfies readonly GiftCategory[]

const giftSchema = z.object({
  coupleId: z.string().uuid(),
  recipientId: z.string().uuid(),
  title: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(120, 'Use até 120 caracteres.'),
  description: z.string().trim().max(1000, 'Use até 1000 caracteres.').nullable(),
  imageUrl: z
    .string()
    .trim()
    .url('Informe uma URL de imagem válida.')
    .refine((value) => /^https?:\/\//i.test(value), 'Use uma URL que comece com http:// ou https://.')
    .nullable(),
  linkUrl: z
    .string()
    .trim()
    .url('Informe um link válido.')
    .refine((value) => /^https?:\/\//i.test(value), 'Use uma URL que comece com http:// ou https://.')
    .nullable(),
  priceMin: z.number().min(0, 'O preço não pode ser negativo.').nullable(),
  priceMax: z.number().min(0, 'O preço não pode ser negativo.').nullable(),
  category: z.enum(giftCategories),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['wanted', 'purchased', 'received']),
  isSurprise: z.boolean(),
  relatedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.').nullable(),
}).superRefine((value, context) => {
  if (value.priceMin !== null && value.priceMax !== null && value.priceMax < value.priceMin) {
    context.addIssue({
      code: 'custom',
      path: ['priceMax'],
      message: 'O valor máximo deve ser maior ou igual ao mínimo.',
    })
  }
})

const giftIdSchema = z.string().uuid()

export type GiftInput = z.infer<typeof giftSchema>

export type UpdateGiftInput = GiftInput & {
  giftId: string
}

export type UpdateGiftStatusInput = {
  giftId: string
  status: GiftStatus
}

function toDatabaseInput(input: GiftInput) {
  const parsed = giftSchema.parse(input)

  return {
    couple_id: parsed.coupleId,
    recipient_id: parsed.recipientId,
    title: parsed.title,
    description: parsed.description || null,
    image_url: parsed.imageUrl || null,
    link_url: parsed.linkUrl || null,
    price_min: parsed.priceMin,
    price_max: parsed.priceMax,
    category: parsed.category,
    priority: parsed.priority,
    status: parsed.status,
    is_surprise: parsed.isSurprise,
    related_date: parsed.relatedDate,
  }
}

export async function createGift(input: GiftInput) {
  const user = await requireUser()
  const values = toDatabaseInput(input)
  const now = new Date().toISOString()
  const data: CoupleGift = { id: crypto.randomUUID(), ...values, created_by: user.id, created_at: now, updated_at: now }
  await setDoc(doc(firestore, 'couple_gifts', data.id), data)
  return data
}

export async function updateGift(input: UpdateGiftInput) {
  const user = await requireUser()
  const giftId = giftIdSchema.parse(input.giftId)
  const { couple_id: coupleId, recipient_id: recipientId, ...values } = toDatabaseInput(input)
  void coupleId
  void recipientId
  return runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'couple_gifts', giftId)
    const current = (await tx.get(ref)).data() as CoupleGift | undefined
    if (!current || current.created_by !== user.id) throw new Error('Presente não encontrado ou sem permissão.')
    const data = { ...current, ...values, updated_at: new Date().toISOString() }
    tx.set(ref, data)
    return data
  })
}

export async function deleteGift(giftId: string) {
  const user = await requireUser()
  const parsedGiftId = giftIdSchema.parse(giftId)
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'couple_gifts', parsedGiftId)
    const current = (await tx.get(ref)).data() as CoupleGift | undefined
    if (!current || current.created_by !== user.id) throw new Error('Presente não encontrado ou sem permissão.')
    tx.delete(ref)
  })
}

export async function updateGiftStatus({ giftId, status }: UpdateGiftStatusInput) {
  const user = await requireUser()
  const parsedGiftId = giftIdSchema.parse(giftId)
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'couple_gifts', parsedGiftId)
    const current = (await tx.get(ref)).data() as CoupleGift | undefined
    if (!current || (current.created_by !== user.id && status === 'wanted')) throw new Error('Você não pode alterar o status deste presente.')
    tx.update(ref, { status, updated_at: new Date().toISOString() })
  })
}
