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

/* ---------- Vínculo entre Discord y AURA ---------- */

// Devuelve el usuario de AURA vinculado a esa cuenta de Discord, o null.
export const resolveUserId = async (discordUserId) => {
  const { data, error } = await supabase.from('discord_links').select('user_id').eq('discord_user_id', discordUserId).maybeSingle()
  if (error) throw new Error(`Supabase: ${error.message}. ¿Ejecutaste supabase/discord.sql?`)
  return data?.user_id ?? null
}

// Canjea un código generado en la app y crea el vínculo. Un código sirve una sola vez.
export const linkDiscordAccount = async ({ discordUserId, code }) => {
  const { data, error } = await supabase.from('discord_link_codes').select('user_id, expires_at').eq('code', code).maybeSingle()
  if (error) throw new Error(`Supabase: ${error.message}. ¿Ejecutaste supabase/discord.sql?`)
  if (!data) return { ok: false, reason: 'code' }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabase.from('discord_link_codes').delete().eq('code', code)
    return { ok: false, reason: 'expired' }
  }
  const { error: linkError } = await supabase
    .from('discord_links')
    .upsert({ discord_user_id: discordUserId, user_id: data.user_id }, { onConflict: 'discord_user_id' })
  if (linkError) throw new Error(`Supabase no pudo guardar el vínculo: ${linkError.message}`)
  await supabase.from('discord_link_codes').delete().eq('code', code)
  return { ok: true, userId: data.user_id }
}

export const unlinkDiscordAccount = async (discordUserId) => {
  const { error } = await supabase.from('discord_links').delete().eq('discord_user_id', discordUserId)
  if (error) throw new Error(`Supabase: ${error.message}`)
}

// Correo de la cuenta vinculada, solo para confirmar en Discord a quién pertenece.
export const accountEmail = async (userId) => {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) return ''
  return data?.user?.email || ''
}

// Proveedor, modelo y clave que esa persona tiene configurados en la web.
export const aiSettingsFor = async (userId) => {
  const snapshot = await readSnapshot(userId)
  const settings = snapshot.aiSettings && typeof snapshot.aiSettings === 'object' ? snapshot.aiSettings : {}
  return settings
}
