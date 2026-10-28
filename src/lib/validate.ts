import type { AiSettings, AppSnapshot, CalendarView, ConversationMessage, ConversationSession, EventItem, Memory, Project } from '../types'
import { providerOrder, providerModels } from '../constants'

// Validación y limpieza del documento que llega de Supabase o de una copia de seguridad.
// Sin dependencias: un JSON corrupto no debe romper la app al cargar.

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const asString = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
const asNumber = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
const asBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined)
const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
const isTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)

const CATEGORIES: EventItem['category'][] = ['focus', 'move', 'rest', 'personal']
const PRIORITIES: NonNullable<EventItem['priority']>[] = ['alta', 'media', 'baja']
const VIEWS: CalendarView[] = ['day', 'week', 'month', 'year']

const normalizeEvent = (raw: unknown): EventItem | null => {
  if (!isObject(raw)) return null
  const title = asString(raw.title).trim()
  const date = asString(raw.date)
  const time = asString(raw.time)
  if (!title || !isDateKey(date) || !isTime(time)) return null
  const category = CATEGORIES.includes(raw.category as EventItem['category']) ? raw.category as EventItem['category'] : 'personal'
  const event: EventItem = {
    id: Math.trunc(asNumber(raw.id, 0)),
    date,
    time,
    title,
    place: asString(raw.place, 'Agenda personal'),
    category,
    duration: asString(raw.duration, '30 min'),
    accent: asString(raw.accent, 'coral'),
  }
  const priority = PRIORITIES.includes(raw.priority as NonNullable<EventItem['priority']>) ? raw.priority as NonNullable<EventItem['priority']> : undefined
  if (priority) event.priority = priority
  if (typeof raw.completed === 'boolean') event.completed = raw.completed
  const reminder = asString(raw.reminder)
  if (reminder) event.reminder = reminder
  const seriesId = asString(raw.seriesId)
  if (seriesId) event.seriesId = seriesId
  const recurrence = asString(raw.recurrence)
  if (recurrence) event.recurrence = recurrence
  const tag = asString(raw.tag)
  if (tag) event.tag = tag
  if (typeof raw.flexibilityMinutes === 'number' && Number.isFinite(raw.flexibilityMinutes)) event.flexibilityMinutes = raw.flexibilityMinutes
  if (typeof raw.flexibilityStart === 'string') event.flexibilityStart = raw.flexibilityStart
  if (typeof raw.flexibilityEnd === 'string') event.flexibilityEnd = raw.flexibilityEnd
  if (isObject(raw.google)) {
    const google = raw.google
    const id = asString(google.id)
    if (id) event.google = { id, account: asString(google.account), hash: asString(google.hash), updated: asString(google.updated) }
  }
  return event
}

const normalizeProject = (raw: unknown): Project | null => {
  if (!isObject(raw)) return null
  const name = asString(raw.name).trim()
  if (!name) return null
  return {
    id: Math.trunc(asNumber(raw.id, 0)),
    name,
    description: asString(raw.description),
    progress: Math.min(100, Math.max(0, asNumber(raw.progress, 0))),
    color: asString(raw.color, 'blue'),
    due: asString(raw.due),
  }
}

const normalizeMemory = (raw: unknown): Memory | null => {
  if (!isObject(raw)) return null
  const title = asString(raw.title).trim()
  if (!title) return null
  return { id: Math.trunc(asNumber(raw.id, 0)), title, content: asString(raw.content), category: asString(raw.category, 'General') }
}

const normalizeMessages = (raw: unknown): ConversationMessage[] => (Array.isArray(raw) ? raw : [])
  .map((message) => (isObject(message) && typeof message.text === 'string'
    ? { from: message.from === 'user' ? 'user' as const : 'assistant' as const, text: message.text }
    : null))
  .filter((message): message is ConversationMessage => message !== null)

const normalizeSession = (raw: unknown): ConversationSession | null => {
  if (!isObject(raw)) return null
  const id = asString(raw.id).trim()
  if (!id) return null
  return { id, title: asString(raw.title, 'Conversación'), messages: normalizeMessages(raw.messages) }
}

const normalizeSettings = (raw: unknown): AiSettings | undefined => {
  if (!isObject(raw)) return undefined
  const settings = {} as AiSettings
  for (const provider of providerOrder) {
    const entry = isObject(raw[provider]) ? raw[provider] as Record<string, unknown> : {}
    settings[provider] = {
      apiKey: asString(entry.apiKey),
      model: asString(entry.model, providerModels[provider][0].id),
    }
  }
  return settings
}

// Devuelve un documento seguro. `null` si la entrada no es un objeto.
export const normalizeSnapshot = (raw: unknown): AppSnapshot | null => {
  if (!isObject(raw)) return null
  const events = (Array.isArray(raw.events) ? raw.events : []).map(normalizeEvent).filter((event): event is EventItem => event !== null)
  // Los ids se reasignan si vienen repetidos o a cero, para que React no duplique claves.
  const seen = new Set<number>()
  let nextId = 1
  for (const event of events) {
    if (!event.id || seen.has(event.id)) event.id = nextId
    seen.add(event.id)
    nextId = Math.max(nextId, event.id + 1)
  }
  const sessions = (Array.isArray(raw.conversationSessions) ? raw.conversationSessions : []).map(normalizeSession).filter((session): session is ConversationSession => session !== null)
  const calendarView = VIEWS.includes(raw.calendarView as CalendarView) ? raw.calendarView as CalendarView : undefined
  return {
    events,
    projects: (Array.isArray(raw.projects) ? raw.projects : []).map(normalizeProject).filter((project): project is Project => project !== null),
    memories: (Array.isArray(raw.memories) ? raw.memories : []).map(normalizeMemory).filter((memory): memory is Memory => memory !== null),
    aiSettings: normalizeSettings(raw.aiSettings),
    conversationSessions: sessions,
    activeConversationId: asString(raw.activeConversationId) || undefined,
    darkMode: asBoolean(raw.darkMode),
    selectedDateKey: isDateKey(asString(raw.selectedDateKey)) ? asString(raw.selectedDateKey) : undefined,
    calendarView,
  }
}
