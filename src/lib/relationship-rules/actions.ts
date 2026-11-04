import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore'
import { z } from 'zod'
import { firestore } from '../firebase/client'
import { requireUser } from '../timeline/queries'

export type RelationshipRule = {
  id: string
  couple_id: string
  title: string
  description: string
  created_by: string
  created_at: Timestamp | null
  updated_at: Timestamp | null
}

export const ruleSchema = z.object({
  title: z.string().trim().min(2, 'Informe um título com pelo menos 2 caracteres.').max(120),
  description: z.string().trim().max(5000),
})

export async function saveRelationshipRule(coupleId: string, values: { title: string; description: string }, rule?: RelationshipRule) {
  const parsed = ruleSchema.parse(values)
  if (rule) {
    await updateDoc(doc(firestore, 'couple_relationship_rules', rule.id), { ...parsed, updated_at: serverTimestamp() })
    return
  }
  const user = await requireUser()
  const ref = doc(collection(firestore, 'couple_relationship_rules'))
  await setDoc(ref, { id: ref.id, couple_id: coupleId, ...parsed, created_by: user.id, created_at: serverTimestamp(), updated_at: serverTimestamp() })
}

export async function deleteRelationshipRule(rule: RelationshipRule) {
  await deleteDoc(doc(firestore, 'couple_relationship_rules', rule.id))
}
