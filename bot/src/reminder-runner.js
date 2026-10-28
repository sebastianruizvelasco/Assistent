// Ciclo de recordatorios: mira la agenda de cada cuenta, calcula qué toca y envía el push.

import { supabase } from './aura.js'
import { pushConfigured, sendPush } from './push.js'
import { findDueReminders, reminderMessage } from './reminders.js'

const chunk = (items, size) => items.reduce((groups, item, index) => {
  const group = Math.floor(index / size)
  groups[group] = [...(groups[group] || []), item]
  return groups
}, [])

export const runReminderPass = async ({ now = new Date() } = {}) => {
  if (!pushConfigured) return { sent: 0, skipped: 'sin claves VAPID' }

  const { data: rows, error } = await supabase.from('aura_user_data').select('user_id, data')
  if (error) throw new Error(`Supabase no devolvió las agendas: ${error.message}`)

  let sent = 0
  for (const row of rows || []) {
    const due = findDueReminders(row.data?.events || [], { now })
    if (!due.length) continue

    // Descarta los que ya se avisaron (el bot puede reiniciarse en cualquier momento).
    const keys = due.map((item) => item.key)
    const sentKeys = new Set()
    for (const part of chunk(keys, 100)) {
      const { data: already, error: sentError } = await supabase.from('push_sent').select('occurrence').eq('user_id', row.user_id).in('occurrence', part)
      if (sentError) throw new Error(sentError.message)
      for (const record of already || []) sentKeys.add(record.occurrence)
    }
    const pending = due.filter((item) => !sentKeys.has(item.key))
    if (!pending.length) continue

    const { data: subscriptions, error: subsError } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', row.user_id)
    if (subsError) throw new Error(subsError.message)
    if (!subscriptions?.length) continue

    for (const item of pending) {
      const payload = reminderMessage(item)
      let delivered = 0
      for (const subscription of subscriptions) {
        const result = await sendPush(subscription, payload)
        if (result.status === 'ok') delivered += 1
        if (result.status === 'gone') {
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        }
      }
      if (delivered) {
        const { error: markError } = await supabase
          .from('push_sent')
          .upsert({ user_id: row.user_id, event_id: item.event.id, occurrence: item.key, sent_at: new Date().toISOString() }, { onConflict: 'user_id,event_id,occurrence' })
        if (markError) console.error('No pude marcar el recordatorio como enviado:', markError.message)
        sent += 1
      }
    }
  }

  return { sent }
}
