// Uses a disposable account and generated document IDs; never touches imported records.
import { randomUUID, randomBytes } from 'node:crypto'
import { initializeApp as initializeClient, deleteApp as deleteClient } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth as getClientAuth } from 'firebase/auth'
import { doc, getDocFromServer, getFirestore as getClientFirestore, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { applicationDefault, initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app'
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'

const projectId = 'couple-timeline-3eae7'
const config = { projectId, apiKey: 'AIzaSyDz7Lo4Q7TQMRWpKAdO7cBmyiujfYqiBJI', authDomain: `${projectId}.firebaseapp.com`, appId: '1:277719898258:web:511b9e031a599fac92ee4b' }
const admin = initializeAdmin({ projectId, credential: applicationDefault() })
const client = initializeClient(config, 'smoke-client')
const anonymous = initializeClient(config, 'smoke-anonymous')
const db = getClientFirestore(client)
const adminDb = getAdminFirestore(admin)
const rootId = randomUUID(), membershipId = randomUUID(), eventId = randomUUID(), childId = randomUUID()
const imagePath = `couples/${rootId}/events/${eventId}/${randomUUID()}.png`
const imageService = 'https://couple-timeline-firebase-test.gabriel-mazzuco.workers.dev'
let uid
let stage = 'criar conta'
let uploaded = false
let token
let copyPath
let cleanupError = null
try {
  const credential = await createUserWithEmailAndPassword(getClientAuth(client), `migration-test-${randomUUID()}@example.invalid`, randomBytes(24).toString('base64url'))
  uid = credential.user.uid
  const now = new Date().toISOString()
  stage = 'criar perfil'
  await setDoc(doc(db, 'profiles', uid), { id: uid, email: credential.user.email, name: 'Teste temporário', birth_date: null, bio: null, created_at: now })
  const batch = writeBatch(db)
  batch.set(doc(db, 'couples', rootId), { id: rootId, name: 'Teste temporário', slug: null, visibility: 'private', created_by: uid, parent_id: null, relationship_started_at: null, created_at: now })
  batch.set(doc(db, 'couple_members', membershipId), { id: membershipId, couple_id: rootId, user_id: uid, role: 'owner', created_at: now })
  batch.set(doc(db, 'user_roots', uid), { root_id: rootId, membership_id: membershipId })
  batch.set(doc(db, 'access', rootId, 'members', uid), { couple_id: rootId, user_id: uid, role: 'owner', membership_id: membershipId })
  stage = 'criar relacionamento'
  await batch.commit()
  await setDoc(doc(db, 'couples', childId), { id: childId, name: 'Filha temporária', slug: null, visibility: 'private', created_by: uid, parent_id: rootId, relationship_started_at: null, created_at: now })
  stage = 'criar evento'
  await setDoc(doc(db, 'timeline_events', eventId), { id: eventId, couple_id: rootId, title: 'Teste temporário', created_by: uid, created_at: now, updated_at: now })
  if (!(await getDocFromServer(doc(db, 'timeline_events', eventId))).exists()) throw new Error('O membro não conseguiu ler o evento de teste.')
  stage = 'enviar e ler imagem temporária'
  token = await credential.user.getIdToken()
  const form = new FormData()
  form.set('coupleId', rootId); form.set('eventId', eventId); form.set('path', imagePath)
  form.set('file', new File([new Uint8Array([137, 80, 78, 71])], 'test.png', { type: 'image/png' }))
  const upload = await fetch(`${imageService}/api/images/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  if (!upload.ok) throw new Error(`Upload de teste recusado: ${upload.status}.`)
  uploaded = true
  const signed = await fetch(`${imageService}/api/images/sign-read`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: [imagePath] }) })
  const signedData = await signed.json()
  if (!signed.ok || !signedData.urls?.[imagePath]) throw new Error('A imagem de teste não recebeu uma URL.')
  const image = await fetch(signedData.urls[imagePath])
  if (!image.ok || (await image.arrayBuffer()).byteLength !== 4) throw new Error('A imagem de teste não pôde ser lida.')
  stage = 'copiar imagem para outra timeline'
  const copy = await fetch(`${imageService}/api/images/copy`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: [imagePath], targetCoupleId: childId }) })
  const copyData = await copy.json()
  copyPath = copyData.paths?.[imagePath]
  if (!copy.ok || !copyPath?.startsWith(`couples/${childId}/events/${eventId}/`)) throw new Error(`Cópia de teste recusada: ${copy.status}.`)
  let denied = false
  try { await getDocFromServer(doc(getClientFirestore(anonymous), 'timeline_events', eventId)) } catch (error) { denied = error.code === 'permission-denied' }
  if (!denied) throw new Error('Uma pessoa não autenticada conseguiu ler o evento privado.')
  stage = 'verificar acesso público'
  await updateDoc(doc(db, 'couples', rootId), { visibility: 'public' })
  if (!(await getDocFromServer(doc(getClientFirestore(anonymous), 'timeline_events', eventId))).exists()) throw new Error('A timeline pública não está visível.')
  const publicSign = await fetch(`${imageService}/api/images/sign-read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: [imagePath] }) })
  const publicData = await publicSign.json()
  if (!publicSign.ok || !publicData.urls?.[imagePath]) throw new Error(`Imagem pública não pôde ser autorizada: ${publicSign.status}.`)
  console.log('Conta temporária, timeline, imagem no R2 e acesso público/privado: OK.')
} catch (error) {
  console.error(`Falha na etapa: ${stage}.`)
  throw error
} finally {
  if (uploaded && token) {
    const deleted = await fetch(`${imageService}/api/images/delete`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: [imagePath, ...(copyPath ? [copyPath] : [])] }) })
    if (!deleted.ok) cleanupError = new Error(`Falha ao remover imagem temporária: ${deleted.status}; path: ${imagePath}`)
  }
  if (uid) {
    const cleanup = adminDb.batch()
    for (const path of [`profiles/${uid}`, `couples/${rootId}`, `couples/${childId}`, `couple_members/${membershipId}`, `user_roots/${uid}`, `access/${rootId}/members/${uid}`, `timeline_events/${eventId}`]) cleanup.delete(adminDb.doc(path))
    await cleanup.commit()
    await getAdminAuth(admin).deleteUser(uid)
    console.log('Dados e conta temporários removidos.')
  }
  await Promise.all([deleteClient(client), deleteClient(anonymous), deleteAdmin(admin)])
  if (cleanupError) throw cleanupError
}
