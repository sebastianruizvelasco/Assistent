// Cálculo puro de recordatorios: qué eventos toca avisar ahora mismo.
// Sin dependencias para poder probarlo sin base de datos ni red.

import { dateFromKey, reminderToMinutes } from './planner.js'

// Margen por defecto: si el bot estuvo apagado, no se avisa de algo que ya pasó hace horas.
export const MAX_LATENESS_MINUTES = 15
// Se admite hasta un minuto de adelanto por el desfase del ciclo de un minuto.
const EARLY_TOLERANCE_MS = 60_000

export const reminderKey = (event) => `${event.id}:${event.date}T${event.time}`

// Devuelve los eventos cuyo recordatorio vence en la ventana [ahora - maxLateness, ahora + 1 min].
// `alreadySent` es un Set con las claves ya notificadas (para no repetir).
export const findDueReminders = (events, { now = new Date(), maxLatenessMinutes = MAX_LATENESS_MINUTES, alreadySent = new Set() } = {}) => {
  if (!Array.isArray(events)) return []
  return events.flatMap((event) => {
    if (!event || event.completed) return []
    const reminder = String(event.reminder ?? '')
    if (!reminder || reminder === 'Sin recordatorio') return []
    const minutes = reminderToMinutes(reminder)
    if (!minutes) return []
    const [hours, mins] = String(event.time ?? '').split(':').map(Number)
    if (!Number.isInteger(hours) || !Number.isInteger(mins)) return []
    const start = dateFromKey(event.date)
    start.setHours(hours, mins, 0, 0)
    const fireAt = new Date(start.getTime() - minutes * 60_000)
    const delta = now.getTime() - fireAt.getTime()
    if (delta < -EARLY_TOLERANCE_MS) return []
    if (delta > maxLatenessMinutes * 60_000) return []
    const key = reminderKey(event)
    if (alreadySent.has(key)) return []
    return [{ event, key, fireAt, startsAt: start, minutesBefore: minutes }]
  })
}

const plural = (value, one, many) => `${value} ${value === 1 ? one : many}`

// Texto de la notificación, con lo justo para saber qué es sin abrir la app.
export const reminderMessage = (due) => {
  const { event, minutesBefore } = due
  const when = minutesBefore >= 60 && minutesBefore % 60 === 0
    ? plural(minutesBefore / 60, 'hora', 'horas')
    : plural(minutesBefore, 'minuto', 'minutos')
  const place = event.place && event.place !== 'Agenda personal' ? ` · ${event.place}` : ''
  return {
    title: `${event.title} · ${event.time}`,
    body: `En ${when}${place || '.'}`,
    tag: due.key,
    url: '/',
  }
}
