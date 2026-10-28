import { dateFromKey } from './dates'
import { durationToMinutes } from './schedule'
import { normalizeSnapshot } from './validate'
import type { AppSnapshot, EventItem } from '../types'

// Exportación a iCalendar (.ics) y copias de seguridad en JSON.

const pad = (value: number) => String(value).padStart(2, '0')

const localStamp = (date: Date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`

const utcStamp = (date: Date) => `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`

// iCalendar escapa las comas, los puntos y coma, las barras y los saltos de línea.
const escapeText = (value: string) => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n')

// Las líneas de iCalendar no deben pasar de 75 octetos; se parten con un espacio al inicio.
const foldLine = (line: string) => {
  if (line.length <= 74) return line
  const parts: string[] = []
  let rest = line
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74))
    rest = rest.slice(74)
  }
  parts.push(rest)
  return parts.join('\r\n ')
}

const eventBlock = (event: EventItem, now: Date) => {
  const start = dateFromKey(event.date)
  const [hours, minutes] = event.time.split(':').map(Number)
  start.setHours(hours, minutes, 0, 0)
  const end = new Date(start.getTime() + Math.max(durationToMinutes(event.duration), 5) * 60_000)
  const lines = [
    'BEGIN:VEVENT',
    `UID:aura-${event.id}-${event.date}@aura`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${localStamp(start)}`,
    `DTEND:${localStamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ]
  if (event.place && event.place !== 'Agenda personal') lines.push(`LOCATION:${escapeText(event.place)}`)
  const description = [event.duration, event.category, event.reminder, event.seriesId ? 'serie: ' + event.seriesId : ''].filter(Boolean).join(' · ')
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`)
  lines.push('END:VEVENT')
  return lines.map(foldLine).join('\r\n')
}

// Genera un calendario con hora local flotante: es lo que espera cualquier app de calendario
// cuando la agenda se lleva en la hora del equipo, sin depender de la zona configurada.
export const eventsToIcs = (events: EventItem[], options: { calendarName?: string; now?: Date } = {}) => {
  const now = options.now ?? new Date()
  const name = options.calendarName || 'AURA'
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AURA//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
  ]
  const blocks = [...events].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((event) => eventBlock(event, now))
  return `${[...header, ...blocks, 'END:VCALENDAR'].join('\r\n')}\r\n`
}

export const createBackup = (snapshot: AppSnapshot) => ({
  app: 'AURA',
  version: 2,
  exportedAt: new Date().toISOString(),
  snapshot,
})

// Acepta tanto la copia completa ({ app, snapshot }) como un documento suelto.
export const parseBackup = (raw: unknown): AppSnapshot | null => {
  if (!raw || typeof raw !== 'object') return null
  const candidate = 'snapshot' in raw ? (raw as { snapshot?: unknown }).snapshot : raw
  return normalizeSnapshot(candidate)
}

// Descarga un archivo de texto en el navegador (sin servidor).
export const downloadText = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export const backupFileName = (now = new Date()) => `aura-copia-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
export const icsFileName = (now = new Date()) => `aura-agenda-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.ics`
