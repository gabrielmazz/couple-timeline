import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, runTransaction, query, where, writeBatch } from 'firebase/firestore'
const env = await initializeTestEnvironment({ projectId: 'demo-couple-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
const own = env.authenticatedContext('owner', { email: 'owner@example.test', email_verified: true }).firestore()
const partner = env.authenticatedContext('partner', { email: 'partner@example.test', email_verified: true }).firestore()
const other = env.authenticatedContext('other', { email: 'other@example.test', email_verified: true }).firestore()
const anon = env.unauthenticatedContext().firestore()
try {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const data = {
      'couples/private': { id: 'private', parent_id: null, visibility: 'private', created_by: 'owner', name: 'Privado', created_at: '2026' },
      'couples/child': { id: 'child', parent_id: 'private', visibility: 'private', created_by: 'owner', name: 'Filha', created_at: '2026' },
      'couples/public': { id: 'public', parent_id: null, visibility: 'public', created_by: 'other', name: 'Público', created_at: '2026' },
      'couples/public-child': { id: 'public-child', parent_id: 'public', visibility: 'private', created_by: 'other', name: 'Filha', created_at: '2026' },
      'access/private/members/owner': { couple_id: 'private', user_id: 'owner', role: 'owner', membership_id: 'm1' },
      'access/private/members/partner': { couple_id: 'private', user_id: 'partner', role: 'partner', membership_id: 'm2' },
      'access/private/slots/partner': { user_id: 'partner', membership_id: 'm2' },
      'user_roots/owner': { root_id: 'private', membership_id: 'm1' },
      'user_roots/partner': { root_id: 'private', membership_id: 'm2' },
      'couple_members/m1': { id: 'm1', couple_id: 'private', user_id: 'owner', role: 'owner', created_at: '2026' },
      'couple_members/m2': { id: 'm2', couple_id: 'private', user_id: 'partner', role: 'partner', created_at: '2026' },
      'profiles/owner': { id: 'owner', name: 'Owner', email: 'owner@example.test', birth_date: null, bio: null, created_at: '2026' },
      'profiles/partner': { id: 'partner', name: 'Partner', email: 'partner@example.test', birth_date: null, bio: null, created_at: '2026' },
      'timeline_events/e1': { id: 'e1', couple_id: 'child', created_by: 'owner', title: 'Evento', created_at: '2026', updated_at: '2026' },
      'timeline_events/e2': { id: 'e2', couple_id: 'public-child', created_by: 'other', title: 'Evento', created_at: '2026', updated_at: '2026' },
      'timeline_photos/p1': { id: 'p1', event_id: 'e1', storage_path: 'couples/child/events/e1/a.jpg', created_at: '2026' },
      'timeline_event_comments/c1': { id: 'c1', couple_id: 'child', event_id: 'e1', author_id: 'owner', content: 'ok', parent_comment_id: null, created_at: '2026', updated_at: '2026' },
      'timeline_event_comment_reactions/r1': { id: 'r1', comment_id: 'c1', user_id: 'owner', emoji: '❤️', created_at: '2026' },
      'couple_monthly_plans/p1': { id: 'p1', couple_id: 'private', created_by: 'owner', title: 'Plano', created_at: '2026', updated_at: '2026' },
      'couple_monthly_plans/p2': { id: 'p2', couple_id: 'private', created_by: 'partner', title: 'Plano', created_at: '2026', updated_at: '2026' },
      'couple_monthly_plans/p4': { id: 'p4', couple_id: 'private', created_by: 'owner', title: 'Plano', created_at: '2026', updated_at: '2026' },
      'couple_monthly_plans/p5': { id: 'p5', couple_id: 'private', created_by: 'partner', title: 'Plano', created_at: '2026', updated_at: '2026' },
      'couple_monthly_plans/p3': { id: 'p3', couple_id: 'private', created_by: 'owner', title: 'Plano', created_at: '2026', updated_at: '2026' },
      'couple_gifts/g1': { id: 'g1', couple_id: 'private', created_by: 'owner', recipient_id: 'partner', title: 'Presente', status: 'wanted', created_at: '2026', updated_at: '2026' },
    }
    await Promise.all(Object.entries(data).map(([key, value]) => setDoc(doc(db,key), value)))
  })
  await assertSucceeds(getDocs(query(collection(own, 'couple_monthly_plans'), where('couple_id', '==', 'private'))))
  await assertFails(deleteDoc(doc(other, 'couple_monthly_plans/p3')))
  await assertSucceeds(deleteDoc(doc(partner, 'couple_monthly_plans/p1')))
  await assertSucceeds(deleteDoc(doc(own, 'couple_monthly_plans/p2')))
  for (const [db, planId] of [[own, 'p5'], [partner, 'p4']]) {
    await assertSucceeds(runTransaction(db, async (tx) => {
      const ref = doc(db, 'couple_monthly_plans', planId)
      await tx.get(ref)
      tx.delete(ref)
    }))
  }
  await assertSucceeds(getDoc(doc(own, 'profiles/partner')))
  await assertFails(getDoc(doc(other, 'profiles/partner')))
  await assertFails(getDoc(doc(anon, 'couples/private')))
  await assertSucceeds(getDoc(doc(anon, 'couples/public-child')))
  await assertSucceeds(getDocs(query(collection(own, 'couples'), where('parent_id', '==', 'private'))))
  await assertSucceeds(getDocs(query(collection(own, 'couple_members'), where('couple_id', '==', 'private'))))
  await assertSucceeds(getDocs(query(collection(own, 'timeline_events'), where('couple_id', '==', 'child'))))
  await assertSucceeds(getDocs(query(collection(anon, 'timeline_events'), where('couple_id', '==', 'public-child'))))
  await assertSucceeds(getDocs(query(collection(own, 'timeline_photos'), where('event_id', '==', 'e1'))))
  await assertSucceeds(getDocs(query(collection(own, 'timeline_event_comments'), where('event_id', '==', 'e1'))))
  await assertSucceeds(getDocs(query(collection(own, 'timeline_event_comment_reactions'), where('comment_id', '==', 'c1'))))
  await assertFails(getDocs(query(collection(other, 'timeline_events'), where('couple_id', '==', 'child'))))
  await assertFails(setDoc(doc(other, 'access/private/members/other'), { couple_id: 'private', user_id: 'other', role: 'owner', membership_id: 'x' }))
  await assertFails(updateDoc(doc(partner, 'couple_gifts/g1'), { title: 'Alterado' }))
  await assertSucceeds(updateDoc(doc(partner, 'couple_gifts/g1'), { status: 'purchased', updated_at: '2027' }))
  await assertFails(updateDoc(doc(partner, 'couple_gifts/g1'), { status: 'wanted', updated_at: '2027' }))
  const newUser = env.authenticatedContext('new', { email: 'new@example.test', email_verified: true }).firestore()
  const batch = writeBatch(newUser)
  batch.set(doc(newUser, 'couples/new-root'), { id: 'new-root', name: 'Novo', visibility: 'private', created_by: 'new', parent_id: null, relationship_started_at: null, slug: null, created_at: '2026' })
  batch.set(doc(newUser, 'user_roots/new'), { root_id: 'new-root', membership_id: 'new-member' })
  batch.set(doc(newUser, 'couple_members/new-member'), { id: 'new-member', couple_id: 'new-root', user_id: 'new', role: 'owner', created_at: '2026' })
  batch.set(doc(newUser, 'access/new-root/members/new'), { couple_id: 'new-root', user_id: 'new', role: 'owner', membership_id: 'new-member' })
  await assertSucceeds(batch.commit())
  const photoBatch = writeBatch(own)
  photoBatch.set(doc(own, 'timeline_events/e-new'), { id: 'e-new', couple_id: 'child', created_by: 'owner', title: 'Nova foto', created_at: '2026', updated_at: '2026' })
  photoBatch.set(doc(own, 'timeline_photos/p-new'), { id: 'p-new', event_id: 'e-new', storage_path: 'couples/child/events/e-new/foto.jpg', position: 0, caption: null, created_at: '2026' })
  await assertSucceeds(photoBatch.commit())
  const invalidMove = writeBatch(own)
  invalidMove.update(doc(own, 'timeline_events/e-new'), { couple_id: 'private' })
  invalidMove.update(doc(own, 'timeline_photos/p-new'), { storage_path: 'couples/other/events/e-new/foto.jpg' })
  await assertFails(invalidMove.commit())
  const move = writeBatch(own)
  move.update(doc(own, 'timeline_events/e-new'), { couple_id: 'private' })
  move.update(doc(own, 'timeline_photos/p-new'), { storage_path: 'couples/private/events/e-new/foto.jpg' })
  await assertSucceeds(move.commit())
  await assertFails(setDoc(doc(other, 'timeline_event_comment_reactions/forged'), { id: 'forged', comment_id: 'c1', user_id: 'other', emoji: '❤️', created_at: '2026' }))
  await assertSucceeds(getDoc(doc(partner, 'timeline_event_comment_reactions/new-reaction')))
  await assertSucceeds(setDoc(doc(partner, 'timeline_event_comment_reactions/r2'), { id: 'r2', comment_id: 'c1', user_id: 'partner', emoji: '❤️', created_at: '2026' }))
  const cascade = writeBatch(partner)
  cascade.delete(doc(partner, 'timeline_event_comment_reactions/r1'))
  cascade.delete(doc(partner, 'timeline_event_comment_reactions/r2'))
  cascade.delete(doc(partner, 'timeline_event_comments/c1'))
  cascade.delete(doc(partner, 'timeline_photos/p1'))
  cascade.delete(doc(partner, 'timeline_events/e1'))
  await assertSucceeds(cascade.commit())
  await assertSucceeds(setDoc(doc(newUser, 'invites/i1'), { id: 'i1', couple_id: 'new-root', email: 'invitee@example.test', created_by: 'new', status: 'pending', created_at: '2026' }))
  const invitee = env.authenticatedContext('invitee', { email: 'invitee@example.test', email_verified: true }).firestore()
  await assertSucceeds(getDocs(query(collection(invitee, 'invites'), where('email', '==', 'invitee@example.test'))))
  const accept = writeBatch(invitee)
  accept.update(doc(invitee, 'invites/i1'), { status: 'accepted', accepted_by: 'invitee', accepted_at: '2026' })
  accept.set(doc(invitee, 'couple_members/m3'), { id: 'm3', couple_id: 'new-root', user_id: 'invitee', role: 'partner', created_at: '2026' })
  accept.set(doc(invitee, 'access/new-root/members/invitee'), { couple_id: 'new-root', user_id: 'invitee', role: 'partner', membership_id: 'm3', invite_id: 'i1' })
  accept.set(doc(invitee, 'access/new-root/slots/partner'), { user_id: 'invitee', membership_id: 'm3', invite_id: 'i1' })
  accept.set(doc(invitee, 'user_roots/invitee'), { root_id: 'new-root', membership_id: 'm3', invite_id: 'i1' })
  await assertSucceeds(accept.commit())
  await assertSucceeds(setDoc(doc(newUser, 'invites/i2'), { id: 'i2', couple_id: 'new-root', email: 'other@example.test', created_by: 'new', status: 'pending', created_at: '2026' }))
  const second = writeBatch(other)
  second.update(doc(other, 'invites/i2'), { status: 'accepted', accepted_by: 'other', accepted_at: '2026' })
  second.set(doc(other, 'couple_members/m4'), { id: 'm4', couple_id: 'new-root', user_id: 'other', role: 'partner', created_at: '2026' })
  second.set(doc(other, 'access/new-root/members/other'), { couple_id: 'new-root', user_id: 'other', role: 'partner', membership_id: 'm4', invite_id: 'i2' })
  second.set(doc(other, 'access/new-root/slots/partner'), { user_id: 'other', membership_id: 'm4', invite_id: 'i2' })
  second.set(doc(other, 'user_roots/other'), { root_id: 'new-root', membership_id: 'm4', invite_id: 'i2' })
  await assertFails(second.commit())
  console.log('Firestore permission checks passed')
} finally { await env.cleanup() }
