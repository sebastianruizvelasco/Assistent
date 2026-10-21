import { useEffect } from 'react'
import { dateFromKey } from '../lib/dates'
import { reminderToMinutes } from '../lib/schedule'
import type { EventItem } from '../types'

// Programa notificaciones del navegador para los eventos con recordatorio.
export function useReminders(events: EventItem[]) {
  useEffect(() => {
    const timers = events.flatMap((event) => {
      if (!event.reminder || event.reminder === 'Sin recordatorio') return []
      const [hours, minutes] = event.time.split(':').map(Number)
      const scheduled = dateFromKey(event.date)
      scheduled.setHours(hours, minutes, 0, 0)
      scheduled.setMinutes(scheduled.getMinutes() - reminderToMinutes(event.reminder))
      const delay = scheduled.getTime() - Date.now()
      if (delay <= 0 || delay > 2147483647) return []
      return [window.setTimeout(() => { if ('Notification' in window && Notification.permission === 'granted') new Notification(`AURA: ${event.title}`, { body: `Comienza a las ${event.time}.` }) }, delay)]
    })
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [events])
}
