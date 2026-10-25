// Acceso a los datos de AURA en Supabase con la clave de servicio del bot.
// La app guarda un único documento JSONB por usuario en public.aura_user_data.

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Copia bot/.env.example a bot/.env y rellénalo.')
}

export const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

export const readSnapshot = async (userId) => {
  const { data, error } = await supabase.from('aura_user_data').select('data').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Supabase no devolvió los datos: ${error.message}`)
  return data?.data && typeof data.data === 'object' ? data.data : { events: [] }
}

// El bot solo toca `events`; proyectos, memorias, conversaciones y preferencias se conservan.
const saveSnapshot = async (userId, snapshot) => {
  const { error } = await supabase
    .from('aura_user_data')
    .upsert({ user_id: userId, data: snapshot }, { onConflict: 'user_id' })
  if (error) throw new Error(`Supabase no pudo guardar: ${error.message}`)
}

export const listEvents = async (userId) => {
  const snapshot = await readSnapshot(userId)
  return Array.isArray(snapshot.events) ? snapshot.events : []
}

export const addEvent = async (userId, event) => {
  const snapshot = await readSnapshot(userId)
  const events = Array.isArray(snapshot.events) ? snapshot.events : []
  const nextId = Math.max(0, ...events.map((item) => Number(item.id) || 0)) + 1
  const created = { ...event, id: nextId }
  await saveSnapshot(userId, { ...snapshot, events: [...events, created] })
  return created
}

export const removeEvents = async (userId, ids) => {
  const snapshot = await readSnapshot(userId)
  const events = Array.isArray(snapshot.events) ? snapshot.events : []
  const removed = events.filter((item) => ids.includes(item.id))
  await saveSnapshot(userId, { ...snapshot, events: events.filter((item) => !ids.includes(item.id)) })
  return removed
}

// Reemplaza solo la lista de eventos; el resto del documento se conserva.
export const saveEvents = async (userId, events) => {
  const snapshot = await readSnapshot(userId)
  await saveSnapshot(userId, { ...snapshot, events })
}

export const readMemories = async (userId) => {
  const snapshot = await readSnapshot(userId)
  return Array.isArray(snapshot.memories) ? snapshot.memories : []
}
