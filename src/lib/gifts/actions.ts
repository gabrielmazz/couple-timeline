import { z } from 'zod'
import { supabase } from '../supabase/client'
import { requireUser } from '../timeline/queries'
import type { GiftCategory, GiftStatus } from '../../types/database'

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
  const { data, error } = await supabase
    .from('couple_gifts')
    .insert({ ...values, created_by: user.id })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function updateGift(input: UpdateGiftInput) {
  const user = await requireUser()
  const giftId = giftIdSchema.parse(input.giftId)
  const { couple_id: coupleId, recipient_id: recipientId, ...values } = toDatabaseInput(input)
  void coupleId
  void recipientId
  const { data, error } = await supabase
    .from('couple_gifts')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', giftId)
    .eq('created_by', user.id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function deleteGift(giftId: string) {
  const user = await requireUser()
  const parsedGiftId = giftIdSchema.parse(giftId)
  const { error } = await supabase
    .from('couple_gifts')
    .delete()
    .eq('id', parsedGiftId)
    .eq('created_by', user.id)

  if (error) {
    throw error
  }
}

export async function updateGiftStatus({ giftId, status }: UpdateGiftStatusInput) {
  await requireUser()
  const parsedGiftId = giftIdSchema.parse(giftId)
  const { error } = await supabase.rpc('update_couple_gift_status', {
    target_gift_id: parsedGiftId,
    next_status: status,
  })

  if (error) {
    throw error
  }
}
