import { dateFromKey, dateKeyFromDate, isValidDateKey, parseLocalDateTime } from './dates'
import type { AssistantSeries, EventItem, ScheduleChange, WeeklyScheduleRule } from '../types'

export const durationToMinutes = (duration: string) => { const hours = duration.match(/(\d+(?:[.,]\d+)?)\s*h/); const minutes = duration.match(/(\d+(?:[.,]\d+)?)\s*min/); return hours ? Number(hours[1].replace(',', '.')) * 60 : minutes ? Number(minutes[1].replace(',', '.')) : 30 }
export const durationParts = (duration: string) => {
  const match = duration.match(/(\d+(?:[.,]\d+)?)\s*(h|min)/i)
  return { value: match?.[1]?.replace(',', '.') || '30', unit: match?.[2]?.toLowerCase() === 'h' ? 'h' : 'min' }
}
export const reminderParts = (reminder: string) => {
  const match = reminder.match(/(\d+(?:[.,]\d+)?)\s*(minutos?|min|horas?|h)\s+antes/i)
  return { value: match?.[1]?.replace(',', '.') || '10', unit: /^(?:h|hora)/i.test(match?.[2] || '') ? 'horas' : 'minutos' }
}
export const reminderToMinutes = (reminder: string) => {
  const parts = reminderParts(reminder)
  const value = Number(parts.value)
  return Number.isFinite(value) ? value * (parts.unit === 'horas' ? 60 : 1) : 0
}
export const findAvailableSlot = (events: EventItem[], duration: string, windowStart: string, windowEnd: string) => {
  const start = parseLocalDateTime(windowStart)
  const end = parseLocalDateTime(windowEnd)
  if (!start || !end || start >= end) return null
  const durationMs = durationToMinutes(duration) * 60_000
  for (let timestamp = start.getTime(); timestamp + durationMs <= end.getTime(); timestamp += 15 * 60_000) {
    const candidate = new Date(timestamp)
    const date = dateKeyFromDate(candidate)
    const time = `${String(candidate.getHours()).padStart(2, '0')}:${String(candidate.getMinutes()).padStart(2, '0')}`
    const conflicts = events.some((event) => {
      if (event.date !== date) return false
      const [hour, minute] = event.time.split(':').map(Number)
      const eventStart = dateFromKey(event.date)
      eventStart.setHours(hour, minute, 0, 0)
      const eventEnd = eventStart.getTime() + durationToMinutes(event.duration) * 60_000
      return timestamp < eventEnd && eventStart.getTime() < timestamp + durationMs
    })
    if (!conflicts) return { date, time }
  }
  return null
}
export const isValidWeeklySchedule = (schedule: WeeklyScheduleRule[]) => schedule.length > 0 && !schedule.some((rule) => !rule.days.length || rule.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.time))
export const buildWeeklySeries = (seriesId: string, series: AssistantSeries, startDate: string, schedule: WeeklyScheduleRule[]) => {
  const title = series.title?.trim()
  if (!title || !isValidDateKey(startDate) || !isValidWeeklySchedule(schedule)) return []
  const duration = series.duration?.trim() || '30 min'
  const place = series.place?.trim() || 'Agenda personal'
  const firstDate = dateFromKey(startDate)
  const occurrences: EventItem[] = []
  for (let dayOffset = 0; dayOffset < 366; dayOffset += 1) {
    const date = new Date(firstDate)
    date.setDate(firstDate.getDate() + dayOffset)
    const rule = schedule.find((item) => item.days.includes(date.getDay()))
    if (!rule) continue
    occurrences.push({ id: 0, date: dateKeyFromDate(date), time: rule.time, title, place, category: 'focus', duration, accent: 'blue', recurrence: 'Cada semana', seriesId, priority: 'media', tag: 'Trabajo' })
  }
  return occurrences
}
export const validateSchedule = (dayEvents: EventItem[], changes: ScheduleChange[]) => {
  const pendingEvents = dayEvents.filter((event) => !event.completed)
  const changeIds = changes.map((change) => change.id)
  if (changes.length !== pendingEvents.length || new Set(changeIds).size !== changeIds.length || pendingEvents.some((event) => !changeIds.includes(event.id))) return 'La propuesta no incluye exactamente todas las tareas pendientes.'
  if (changes.some((change) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(change.time))) return 'La propuesta contiene una hora no válida.'
  for (const change of changes) {
    const event = pendingEvents.find((item) => item.id === change.id)
    if (!event) return 'La propuesta incluye una tarea que ya no está en el día seleccionado.'
    const date = change.date || event.date
    if (date !== event.date) return 'La organización diaria no puede mover una tarea a otro día.'
    const [hour, minute] = change.time.split(':').map(Number)
    const proposedStart = dateFromKey(date)
    proposedStart.setHours(hour, minute, 0, 0)
    if (event.flexibilityStart && event.flexibilityEnd) {
      const windowStart = parseLocalDateTime(event.flexibilityStart)
      const windowEnd = parseLocalDateTime(event.flexibilityEnd)
      const proposedEnd = new Date(proposedStart.getTime() + durationToMinutes(event.duration) * 60_000)
      if (!windowStart || !windowEnd || proposedStart < windowStart || proposedEnd > windowEnd) return `La propuesta queda fuera de la ventana flexible de “${event.title}”.`
    } else if (event.flexibilityMinutes) {
      const [originalHour, originalMinute] = event.time.split(':').map(Number)
      const originalStart = dateFromKey(event.date)
      originalStart.setHours(originalHour, originalMinute, 0, 0)
      const difference = Math.abs(proposedStart.getTime() - originalStart.getTime()) / 60_000
      if (date !== event.date || difference > event.flexibilityMinutes) return `La propuesta supera el margen de ${event.flexibilityMinutes} minutos de “${event.title}”.`
    } else {
      if (date !== event.date || change.time !== event.time) return `“${event.title}” es fija y no se puede mover.`
    }
  }
  const proposedEvents = dayEvents.map((event) => {
    const change = changes.find((item) => item.id === event.id)
    return change ? { ...event, time: change.time } : event
  }).sort((first, second) => first.time.localeCompare(second.time))
  for (let index = 1; index < proposedEvents.length; index += 1) {
    const previous = proposedEvents[index - 1]
    const current = proposedEvents[index]
    const [hour, minute] = previous.time.split(':').map(Number)
    if (hour * 60 + minute + durationToMinutes(previous.duration) > current.time.split(':').map(Number).reduce((total, part) => total * 60 + part, 0)) return 'La propuesta tiene eventos que se solapan.'
  }
  return ''
}
