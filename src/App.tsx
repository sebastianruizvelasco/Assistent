import { useEffect, useState, type DragEvent, type FormEvent, type MouseEvent as ReactMouseEvent, type PointerEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import './App.css'

type EventItem = {
  id: number
  date: string
  time: string
  title: string
  place: string
  category: 'focus' | 'move' | 'rest' | 'personal'
  duration: string
  accent: string
  recurrence?: string
  reminder?: string
  seriesId?: string
  flexibilityMinutes?: number
  flexibilityStart?: string
  flexibilityEnd?: string
  priority?: 'alta' | 'media' | 'baja'
  tag?: string
  completed?: boolean
}

type ScheduleChange = { id: number; date?: string; time: string }
type ConversationMessage = { from: 'assistant' | 'user'; text: string }
type ConversationSession = { id: string; title: string; messages: ConversationMessage[] }
type WeeklyScheduleRule = { days: number[]; time: string }
type AssistantSeries = { title?: string; startDate?: string; duration?: string; place?: string; weeklySchedule?: WeeklyScheduleRule[] }
type AssistantResult = { action?: 'create_event' | 'create_series' | 'edit_series' | 'reply'; reply?: string; targetTitle?: string; weeklySchedule?: WeeklyScheduleRule[]; series?: AssistantSeries; event?: { title?: string; date?: string | null; time?: string | null; duration?: string; place?: string; category?: EventItem['category']; priority?: EventItem['priority']; flexibilityMinutes?: number; flexibilityWindow?: { start?: string; end?: string } | null } }
type Project = { id: number; name: string; description: string; progress: number; color: string; due: string }
type Memory = { id: number; title: string; content: string; category: string }
type ProviderKey = 'openrouter' | 'openai' | 'gemini' | 'anthropic'
type AiSettings = Record<ProviderKey, { apiKey: string; model: string }>
type AppSnapshot = {
  events?: EventItem[]
  projects?: Project[]
  memories?: Memory[]
  aiSettings?: Partial<AiSettings>
  conversationSessions?: ConversationSession[]
  activeConversationId?: string
  darkMode?: boolean
  selectedDateKey?: string
  calendarView?: 'day' | 'week' | 'month' | 'year'
}

const todayDateKey = () => dateKeyFromDate(new Date())
const buildInitialEvents = (): EventItem[] => {
  const today = new Date()
  const todayKey = dateKeyFromDate(today)
  return [
    { id: 1, date: todayKey, time: '09:00', title: 'Revisión de producto', place: 'Sala Nube · Meet', category: 'focus', duration: '45 min', accent: 'blue', priority: 'alta', tag: 'Trabajo' },
    { id: 2, date: todayKey, time: '10:15', title: 'Bloque de trabajo profundo', place: 'Sin interrupciones', category: 'focus', duration: '2 h', accent: 'yellow', priority: 'alta', tag: 'Trabajo' },
    { id: 3, date: todayKey, time: '12:30', title: 'Almuerzo con Elena', place: 'Casa Bonay · 12 min a pie', category: 'personal', duration: '1 h', accent: 'coral', priority: 'media', tag: 'Personal' },
    { id: 4, date: todayKey, time: '14:00', title: 'Llamada con el equipo', place: 'Google Meet', category: 'move', duration: '30 min', accent: 'green', priority: 'alta', tag: 'Trabajo' },
    { id: 5, date: todayKey, time: '16:00', title: 'Pausa y paseo', place: 'Parque de la Ciutadella', category: 'rest', duration: '45 min', accent: 'purple', priority: 'baja', tag: 'Bienestar' },
  ]
}

const suggestions = ['Mueve el almuerzo a las 13:30', 'Libérame una hora esta tarde', '¿Qué tengo después de comer?']
const providerModels = {
  openrouter: [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini Flash' },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude Haiku' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  ],
} as const
const providerLabels = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic',
} as const
const providerOrder = Object.keys(providerLabels) as Array<keyof typeof providerLabels>
const defaultAiKeys = {
  openrouter: { apiKey: '', model: providerModels.openrouter[0].id },
  openai: { apiKey: '', model: providerModels.openai[0].id },
  gemini: { apiKey: '', model: providerModels.gemini[0].id },
  anthropic: { apiKey: '', model: providerModels.anthropic[0].id },
} as const
const availableModels = providerModels.openrouter
const initialProjects: Project[] = [
  { id: 1, name: 'Lanzamiento de AURA', description: 'Producto y experiencia del asistente', progress: 68, color: 'blue', due: '18 sep.' },
  { id: 2, name: 'Casa nueva', description: 'Organizar mudanza y compras', progress: 32, color: 'green', due: '02 oct.' },
  { id: 3, name: 'Aprender italiano', description: 'Rutina de estudio semanal', progress: 45, color: 'yellow', due: 'Continuo' },
]
const initialMemories: Memory[] = [
  { id: 1, title: 'Cómo trabajo mejor', content: 'Prefiero bloques de concentración por la mañana y reuniones después de comer.', category: 'Preferencias' },
  { id: 2, title: 'Lugares habituales', content: 'Casa Bonay para almuerzos y Parque de la Ciutadella para pasear.', category: 'Contexto' },
  { id: 3, title: 'Ritual de cierre', content: 'Revisar pendientes y preparar el día siguiente antes de las 18:00.', category: 'Rutinas' },
]
const weekDayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

const dateKeyFromDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dateFromKey = (key: string) => { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day) }
const isValidDateKey = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKeyFromDate(dateFromKey(key)) === key
const formatDateLabel = (key: string) => dateFromKey(key).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
const formatEventDate = (key: string) => dateFromKey(key).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const parseLocalDateTime = (value: string) => /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && isValidDateKey(value.slice(0, 10)) ? new Date(`${value}:00`) : null
const shiftLocalDateTime = (value: string | undefined, dayOffset: number) => {
  if (!value) return undefined
  const date = parseLocalDateTime(value)
  if (!date) return value
  date.setDate(date.getDate() + dayOffset)
  return `${dateKeyFromDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
const hasExplicitDate = (text: string) => /\b(?:hoy|mañana|pasado mañana|esta tarde|esta noche|este fin de semana|próxima semana|la próxima semana|lunes|martes|miércoles|jueves|viernes|sábado|domingo|20\d{2}-\d{2}-\d{2}|\d{1,2} de enero|\d{1,2} de febrero|\d{1,2} de marzo|\d{1,2} de abril|\d{1,2} de mayo|\d{1,2} de junio|\d{1,2} de julio|\d{1,2} de agosto|\d{1,2} de septiembre|\d{1,2} de octubre|\d{1,2} de noviembre|\d{1,2} de diciembre)\b/i.test(text)
const defaultDateForTime = (time: string, now = new Date()) => {
  const [hour, minute] = time.split(':').map(Number)
  const scheduled = new Date(now)
  scheduled.setHours(hour, minute, 0, 0)
  if (scheduled.getTime() <= now.getTime()) scheduled.setDate(scheduled.getDate() + 1)
  return dateKeyFromDate(scheduled)
}
const nextAvailableTime = (now = new Date()) => {
  const nextSlot = new Date(now)
  nextSlot.setMinutes(Math.ceil((now.getMinutes() + 15) / 15) * 15, 0, 0)
  return `${String(nextSlot.getHours()).padStart(2, '0')}:${String(nextSlot.getMinutes()).padStart(2, '0')}`
}
const startOfWeek = (date: Date) => { const copy = new Date(date); const day = copy.getDay(); copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1)); return copy }
const durationToMinutes = (duration: string) => { const hours = duration.match(/(\d+(?:[.,]\d+)?)\s*h/); const minutes = duration.match(/(\d+(?:[.,]\d+)?)\s*min/); return hours ? Number(hours[1].replace(',', '.')) * 60 : minutes ? Number(minutes[1].replace(',', '.')) : 30 }
const durationParts = (duration: string) => {
  const match = duration.match(/(\d+(?:[.,]\d+)?)\s*(h|min)/i)
  return { value: match?.[1]?.replace(',', '.') || '30', unit: match?.[2]?.toLowerCase() === 'h' ? 'h' : 'min' }
}
const reminderParts = (reminder: string) => {
  const match = reminder.match(/(\d+(?:[.,]\d+)?)\s*(minutos?|min|horas?|h)\s+antes/i)
  return { value: match?.[1]?.replace(',', '.') || '10', unit: /^(?:h|hora)/i.test(match?.[2] || '') ? 'horas' : 'minutos' }
}
const reminderToMinutes = (reminder: string) => {
  const parts = reminderParts(reminder)
  const value = Number(parts.value)
  return Number.isFinite(value) ? value * (parts.unit === 'horas' ? 60 : 1) : 0
}
const findAvailableSlot = (events: EventItem[], duration: string, windowStart: string, windowEnd: string) => {
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
const isValidWeeklySchedule = (schedule: WeeklyScheduleRule[]) => schedule.length > 0 && !schedule.some((rule) => !rule.days.length || rule.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.time))
const buildWeeklySeries = (seriesId: string, series: AssistantSeries, startDate: string, schedule: WeeklyScheduleRule[]) => {
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
const validateSchedule = (dayEvents: EventItem[], changes: ScheduleChange[]) => {
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
const formatLocalTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const readStored = <T,>(key: string, fallback: T) => { try { const stored = localStorage.getItem(key); return stored ? JSON.parse(stored) as T : fallback } catch { return fallback } }
const mergeAiSettings = (cloudSettings?: Partial<AiSettings>, localStorageKey = 'aura-ai-settings') => {
  const localSettings = readStored(localStorageKey, defaultAiKeys as AiSettings)
  return Object.fromEntries(providerOrder.map((provider) => [provider, {
    apiKey: localSettings[provider]?.apiKey || '',
    model: cloudSettings?.[provider]?.model || localSettings[provider]?.model || providerModels[provider][0].id,
  }])) as AiSettings
}
const readLocalAppSnapshot = (): AppSnapshot => {
  const savedSessions = readStored<ConversationSession[]>('aura-conversations', [])
  const theme = localStorage.getItem('aura-theme')
  return {
    events: readStored('aura-events', buildInitialEvents()),
    projects: readStored('aura-projects', initialProjects),
    memories: readStored('aura-memories', initialMemories),
    aiSettings: mergeAiSettings(),
    conversationSessions: savedSessions.length ? savedSessions : [{ id: 'conversation-1', title: 'Conversación actual', messages: readStored('aura-conversation', [{ from: 'assistant', text: 'Buenos días, Alex. He dejado espacio para que el día respire. ¿Qué quieres ajustar?' }]) }],
    activeConversationId: localStorage.getItem('aura-active-conversation') || 'conversation-1',
    darkMode: theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches,
    selectedDateKey: todayDateKey(),
    calendarView: 'day',
  }
}
const createEmptyAppSnapshot = (): AppSnapshot => ({
  events: buildInitialEvents(),
  projects: initialProjects,
  memories: initialMemories,
  aiSettings: mergeAiSettings(),
  conversationSessions: [{ id: 'conversation-1', title: 'Conversación actual', messages: [{ from: 'assistant', text: 'Buenos días, Alex. He dejado espacio para que el día respire. ¿Qué quieres ajustar?' }] }],
  activeConversationId: 'conversation-1',
  selectedDateKey: todayDateKey(),
  calendarView: 'day',
})
const snapshotForCloud = (snapshot: AppSnapshot): AppSnapshot => ({
  ...snapshot,
  aiSettings: snapshot.aiSettings ? Object.fromEntries(providerOrder.map((provider) => [provider, { apiKey: '', model: snapshot.aiSettings?.[provider]?.model || providerModels[provider][0].id }])) as AiSettings : undefined,
})

function PlannerApp({ snapshot, userEmail, onSignOut, onSaveSnapshot, localApiKeyStorageKey }: { snapshot?: AppSnapshot; userEmail?: string; onSignOut?: () => void; onSaveSnapshot?: (data: AppSnapshot) => Promise<void>; localApiKeyStorageKey?: string }) {
  const aiSettingsStorageKey = localApiKeyStorageKey || 'aura-ai-settings'
  const [events, setEvents] = useState<EventItem[]>(() => snapshot?.events || readStored('aura-events', buildInitialEvents()))
  const [message, setMessage] = useState('')
  const [activeSection, setActiveSection] = useState('Mi día')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [selectedDateKey, setSelectedDateKey] = useState(() => snapshot?.selectedDateKey || todayDateKey())
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month' | 'year'>(() => snapshot?.calendarView || 'day')
  const [eventMenuId, setEventMenuId] = useState<number | null>(null)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [flexibilityMode, setFlexibilityMode] = useState<'fixed' | 'minutes' | 'window'>('fixed')
  const [reminderCustomEnabled, setReminderCustomEnabled] = useState(false)
  const [newEventDate, setNewEventDate] = useState(() => todayDateKey())
  const [newEventTime, setNewEventTime] = useState('18:00')
  const [newEventDuration, setNewEventDuration] = useState('30 min')
  const [dragSelection, setDragSelection] = useState<{ start: number; end: number } | null>(null)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)
  const [formEventId, setFormEventId] = useState<number | null>(null)
  const [voiceActive, setVoiceActive] = useState(false)
  const [darkMode, setDarkMode] = useState(() => snapshot?.darkMode ?? (() => { const savedTheme = localStorage.getItem('aura-theme'); return savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches })())
  const [localTime, setLocalTime] = useState(() => formatLocalTime(new Date()))
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [temperature, setTemperature] = useState<number | null>(null)
  const [city, setCity] = useState('Ubicación no disponible')
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [notice, setNotice] = useState('')
  const [conversationSessions, setConversationSessions] = useState<ConversationSession[]>(() => snapshot?.conversationSessions || (() => {
    const savedSessions = readStored<ConversationSession[]>('aura-conversations', [])
    if (savedSessions.length) return savedSessions
    return [{ id: 'conversation-1', title: 'Conversación actual', messages: readStored('aura-conversation', [
      { from: 'assistant', text: 'Buenos días, Alex. He dejado espacio para que el día respire. ¿Qué quieres ajustar?' },
    ]) }]
  })())
  const [activeConversationId, setActiveConversationId] = useState(() => snapshot?.activeConversationId || localStorage.getItem('aura-active-conversation') || 'conversation-1')
  const activeConversation = conversationSessions.find((item) => item.id === activeConversationId) || conversationSessions[0]
  const conversation = activeConversation?.messages || []
  const setConversation = (update: ConversationMessage[] | ((current: ConversationMessage[]) => ConversationMessage[])) => {
    setConversationSessions((current) => current.map((session) => {
      if (session.id !== activeConversationId) return session
      const messages = typeof update === 'function' ? update(session.messages) : update
      return { ...session, messages: messages.slice(-100) }
    }))
  }
  const [isThinking, setIsThinking] = useState(false)
  const [scheduleProposal, setScheduleProposal] = useState<{ date: string; changes: ScheduleChange[]; summary: string } | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<keyof typeof providerModels>('openrouter')
  const [selectedModel, setSelectedModel] = useState<string>(availableModels[0].id)
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => mergeAiSettings(snapshot?.aiSettings, aiSettingsStorageKey))
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<'todas' | 'alta' | 'media' | 'baja'>('todas')
  const [showCompleted, setShowCompleted] = useState(true)
  const [projects, setProjects] = useState<Project[]>(() => snapshot?.projects || readStored('aura-projects', initialProjects))
  const [memories, setMemories] = useState<Memory[]>(() => snapshot?.memories || readStored('aura-memories', initialMemories))
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [memoryFormOpen, setMemoryFormOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  useEffect(() => { localStorage.setItem('aura-events', JSON.stringify(events)) }, [events])
  useEffect(() => { localStorage.setItem(aiSettingsStorageKey, JSON.stringify(aiSettings)) }, [aiSettings, aiSettingsStorageKey])
  useEffect(() => { localStorage.setItem('aura-projects', JSON.stringify(projects)) }, [projects])
  useEffect(() => { localStorage.setItem('aura-memories', JSON.stringify(memories)) }, [memories])
  useEffect(() => {
    localStorage.setItem('aura-conversations', JSON.stringify(conversationSessions.map((session) => ({ ...session, messages: session.messages.slice(-100) }))))
    localStorage.setItem('aura-active-conversation', activeConversationId)
    const activeMessages = conversationSessions.find((session) => session.id === activeConversationId)?.messages || []
    localStorage.setItem('aura-conversation', JSON.stringify(activeMessages.slice(-100)))
  }, [conversationSessions, activeConversationId])
  useEffect(() => {
    if (!onSaveSnapshot) return
    const timer = window.setTimeout(() => {
      const safeAiSettings = Object.fromEntries(providerOrder.map((provider) => [provider, { apiKey: '', model: aiSettings[provider].model }])) as AiSettings
      void onSaveSnapshot({ events, projects, memories, aiSettings: safeAiSettings, conversationSessions, activeConversationId, darkMode, selectedDateKey, calendarView })
        .catch(() => { setNotice('No se pudieron sincronizar los datos. Comprueba la conexión.'); window.setTimeout(() => setNotice(''), 2600) })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [onSaveSnapshot, events, projects, memories, aiSettings, conversationSessions, activeConversationId, darkMode, selectedDateKey, calendarView])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateFromDevice = (event: MediaQueryListEvent) => { if (!localStorage.getItem('aura-theme')) setDarkMode(event.matches) }
    mediaQuery.addEventListener('change', updateFromDevice)
    return () => mediaQuery.removeEventListener('change', updateFromDevice)
  }, [])

  useEffect(() => {
    const updateClock = () => {
      setLocalTime(formatLocalTime(new Date()))
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    }
    const timer = window.setInterval(updateClock, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((position) => {
      setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude })
    }, () => setCity('Ubicación no disponible'))
  }, [])

  useEffect(() => {
    if (!coordinates) return
    const updateWeather = async () => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=temperature_2m&timezone=auto`)
        if (!response.ok) return
        const data = await response.json() as { current?: { temperature_2m?: number } }
        if (typeof data.current?.temperature_2m === 'number') setTemperature(Math.round(data.current.temperature_2m))
      } catch {
        return
      }
    }
    updateWeather()
    const timer = window.setInterval(updateWeather, 10 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [coordinates])

  useEffect(() => {
    if (!coordinates) return
    const loadCity = async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates.latitude}&lon=${coordinates.longitude}&zoom=10`)
        if (!response.ok) return
        const data = await response.json() as { address?: { city?: string; town?: string; village?: string; municipality?: string } }
        const address = data.address
        setCity(address?.city || address?.town || address?.village || address?.municipality || 'Ubicación actual')
      } catch {
        setCity('Ubicación actual')
      }
    }
    loadCity()
  }, [coordinates])

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const persistBeforeSignOut = async () => {
    if (!onSaveSnapshot) { onSignOut?.(); return }
    const safeAiSettings = Object.fromEntries(providerOrder.map((provider) => [provider, { apiKey: '', model: aiSettings[provider].model }])) as AiSettings
    try {
      await onSaveSnapshot({ events, projects, memories, aiSettings: safeAiSettings, conversationSessions, activeConversationId, darkMode, selectedDateKey, calendarView })
      onSignOut?.()
    } catch {
      showNotice('No pude guardar los últimos cambios; mantuve la sesión abierta para reintentar.')
    }
  }

  const confirmAction = (message: string, action: () => void) => {
    setPendingAction(() => action)
    showNotice(message)
  }

  const toggleVoice = () => {
    setVoiceActive((current) => !current)
    showNotice(voiceActive ? 'Dictado pausado.' : 'Modo dictado activado. Escribe tu instrucción para continuar.')
  }

  const toggleTheme = () => {
    setDarkMode((current) => {
      const next = !current
      localStorage.setItem('aura-theme', next ? 'dark' : 'light')
      return next
    })
  }

  const handleProviderChange = (nextProvider: keyof typeof providerModels) => {
    setSelectedProvider(nextProvider)
    const nextModel = aiSettings[nextProvider]?.model || providerModels[nextProvider][0].id
    setSelectedModel(nextModel)
  }

  const updateAiSetting = (provider: keyof typeof providerModels, key: 'apiKey' | 'model', value: string) => {
    setAiSettings((current) => ({
      ...current,
      [provider]: {
        ...(current[provider] || { apiKey: '', model: providerModels[provider][0].id }),
        [key]: value,
      },
    }))
    if (key === 'model' && provider === selectedProvider) setSelectedModel(value)
  }

  const requestNotifications = async () => {
    if (!('Notification' in window)) { showNotice('Este navegador no admite notificaciones.'); return }
    const permission = await Notification.requestPermission()
    showNotice(permission === 'granted' ? 'Recordatorios activados.' : 'Permiso de recordatorios no concedido.')
  }

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

  const removeEvent = (eventId: number) => {
    const event = events.find((item) => item.id === eventId)
    if (!event) return
    confirmAction(`Confirma la eliminación de “${event.title}”.`, () => {
      setEvents((current) => current.filter((item) => item.id !== eventId))
      setEventMenuId(null)
      showNotice(`${event.title} se ha eliminado de tu día.`)
    })
  }

  const removeEventSeries = (eventId: number) => {
    const event = events.find((item) => item.id === eventId)
    if (!event || !event.recurrence || event.recurrence === 'No se repite') return
    const seriesEvents = events.filter((item) => event.seriesId ? item.seriesId === event.seriesId : item.title === event.title && item.recurrence === event.recurrence)
    confirmAction(`Confirma la eliminación de las ${seriesEvents.length} ocurrencias de “${event.title}”.`, () => {
      setEvents((current) => current.filter((item) => event.seriesId ? item.seriesId !== event.seriesId : item.title !== event.title || item.recurrence !== event.recurrence))
      setEventMenuId(null)
      showNotice(`Se eliminó la serie de “${event.title}”.`)
    })
  }

  const duplicateEvent = (eventId: number) => {
    const event = events.find((item) => item.id === eventId)
    if (!event) return
    const duplicateId = Math.max(0, ...events.map((item) => item.id)) + 1
    setEvents((current) => [...current, { ...event, id: duplicateId, title: `${event.title} (copia)` }])
    setEventMenuId(null)
    showNotice('He creado una copia del evento.')
  }

  const toggleComplete = (eventId: number) => {
    setEvents((current) => current.map((event) => event.id === eventId ? { ...event, completed: !event.completed } : event))
  }

  const openAddEvent = (date?: string, time?: string, duration = '30 min') => {
    setFormEventId(null)
    setFlexibilityMode('fixed')
    setReminderCustomEnabled(false)
    const now = new Date()
    const suggestedTime = time || nextAvailableTime(now)
    setNewEventDate(date || defaultDateForTime(suggestedTime, now))
    setNewEventTime(suggestedTime)
    setNewEventDuration(duration)
    setAddEventOpen(true)
  }

  const openEditEvent = (eventId: number) => {
    const event = events.find((item) => item.id === eventId)
    if (!event) return
    setFormEventId(eventId)
    setFlexibilityMode(event.flexibilityStart && event.flexibilityEnd ? 'window' : event.flexibilityMinutes ? 'minutes' : 'fixed')
    setReminderCustomEnabled(Boolean(event.reminder && !['Sin recordatorio', '5 minutos antes', '10 minutos antes', '30 minutos antes', '1 hora antes'].includes(event.reminder)))
    setNewEventDate(event.date)
    setNewEventTime(event.time)
    setNewEventDuration(event.duration)
    setAddEventOpen(true)
    setEventMenuId(null)
  }

  const pointerMinute = (hour: number, event: PointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const quarter = Math.max(0, Math.min(3, Math.floor(((event.clientY - bounds.top) / bounds.height) * 4)))
    return hour * 60 + quarter * 15
  }

  const beginTimeSelection = (hour: number, event: PointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('article, button')) return
    const minute = pointerMinute(hour, event)
    setDragSelection({ start: minute, end: minute })
  }

  const updateTimeSelection = (hour: number, event: PointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>) => {
    if (dragSelection) {
      const minute = pointerMinute(hour, event)
      setDragSelection((current) => current ? { ...current, end: minute } : current)
    }
  }

  const finishTimeSelection = (hour: number, event: PointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>) => {
    if (!dragSelection) return
    const endPoint = pointerMinute(hour, event)
    const start = Math.min(dragSelection.start, endPoint)
    const end = Math.max(dragSelection.start, endPoint) + 15
    const durationMinutes = end - start
    const startHour = Math.floor(start / 60)
    const startMinute = start % 60
    const newEventId = Math.max(0, ...events.map((item) => item.id)) + 1
    setDragSelection(null)
    setEvents((current) => [...current, { id: newEventId, date: selectedDateKey, time: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, title: 'Nueva tarea', place: 'Agenda personal', category: 'personal', duration: durationMinutes >= 60 ? `${durationMinutes / 60} h` : `${durationMinutes} min`, accent: 'blue', priority: 'media', tag: 'Personal' }])
    setEditingEventId(newEventId)
  }

  const addEvent = (formData: FormData) => {
    const title = String(formData.get('title') || '').trim()
    const date = String(formData.get('date') || newEventDate)
    const time = String(formData.get('time') || '18:00')
    const place = String(formData.get('place') || 'Agenda personal').trim()
    const durationValue = Number(formData.get('durationValue') || 30)
    const durationUnit = String(formData.get('durationUnit') || 'min')
    const duration = `${durationValue} ${durationUnit}`
    const flexibilityMode = String(formData.get('flexibilityMode') || 'fixed')
    const flexibilityMinutesValue = Number(formData.get('flexibilityMinutes') || 0)
    let flexibilityStart: string | undefined
    let flexibilityEnd: string | undefined
    const recurrence = String(formData.get('recurrence') || 'No se repite')
    const reminderChoice = String(formData.get('reminder') || 'Sin recordatorio')
    const customReminderValue = Number(formData.get('customReminderValue') || 10)
    const customReminderUnit = String(formData.get('customReminderUnit') || 'minutos')
    const reminder = reminderChoice === 'Personalizado' ? `${customReminderValue} ${customReminderUnit} antes` : reminderChoice
    if (!title) return
    if (!Number.isFinite(durationValue) || durationValue <= 0) { showNotice('La duración debe ser mayor que cero.'); return }
    if (reminderChoice === 'Personalizado' && (!Number.isFinite(customReminderValue) || customReminderValue <= 0)) { showNotice('El recordatorio debe ser mayor que cero.'); return }
    let scheduledDate = date
    let scheduledTime = time
    if (flexibilityMode === 'minutes' && (!Number.isFinite(flexibilityMinutesValue) || flexibilityMinutesValue < 0)) { showNotice('La flexibilidad en minutos no es válida.'); return }
    if (flexibilityMode === 'window') {
      flexibilityStart = String(formData.get('flexibilityStart') || '')
      flexibilityEnd = String(formData.get('flexibilityEnd') || '')
      const start = parseLocalDateTime(flexibilityStart)
      const end = parseLocalDateTime(flexibilityEnd)
      if (!start || !end || start >= end) { showNotice('Indica un intervalo válido, con una fecha y hora final posterior a la inicial.'); return }
      const slot = findAvailableSlot(events.filter((event) => event.id !== formEventId), duration, flexibilityStart, flexibilityEnd)
      if (!slot) { showNotice('No hay un hueco libre que quepa en esa ventana.'); return }
      scheduledDate = slot.date
      scheduledTime = slot.time
    }
    if (formEventId !== null) {
      setEvents((current) => current.map((item) => item.id === formEventId ? { ...item, date: scheduledDate, time: scheduledTime, title, place, duration, flexibilityMinutes: flexibilityMode === 'minutes' ? flexibilityMinutesValue : undefined, flexibilityStart, flexibilityEnd, recurrence, reminder } : item))
      setFormEventId(null)
      setAddEventOpen(false)
      showNotice(`${title} actualizado.`)
      return
    }
    const newId = Math.max(0, ...events.map((item) => item.id)) + 1
    const seriesId = recurrence === 'No se repite' ? undefined : `aura-series-${newId}-${Date.now()}`
    const baseEvent = { date: scheduledDate, time: scheduledTime, title, place, category: 'personal' as const, duration, seriesId, flexibilityMinutes: flexibilityMode === 'minutes' ? flexibilityMinutesValue : undefined, flexibilityStart, flexibilityEnd, accent: 'blue', recurrence, reminder, priority: 'media' as const, tag: 'Personal' }
    const occurrenceCount = recurrence === 'Cada día' ? 366 : recurrence === 'Cada semana' ? 53 : recurrence === 'Cada mes' ? 13 : 1
    const scheduledDateParts = scheduledDate.split('-').map(Number)
    const scheduledUtc = Date.UTC(scheduledDateParts[0], scheduledDateParts[1] - 1, scheduledDateParts[2])
    const occurrences = Array.from({ length: occurrenceCount }, (_, index) => {
      const nextDate = dateFromKey(scheduledDate)
      if (recurrence === 'Cada día') nextDate.setDate(nextDate.getDate() + index)
      if (recurrence === 'Cada semana') nextDate.setDate(nextDate.getDate() + index * 7)
      if (recurrence === 'Cada mes') {
        const originalDay = nextDate.getDate()
        nextDate.setDate(1)
        nextDate.setMonth(nextDate.getMonth() + index)
        nextDate.setDate(Math.min(originalDay, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()))
      }
      const occurrenceDate = dateKeyFromDate(nextDate)
      const occurrenceUtc = Date.UTC(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate())
      const dayOffset = Math.round((occurrenceUtc - scheduledUtc) / 86_400_000)
      return { ...baseEvent, id: newId + index, date: occurrenceDate, flexibilityStart: shiftLocalDateTime(flexibilityStart, dayOffset), flexibilityEnd: shiftLocalDateTime(flexibilityEnd, dayOffset) }
    })
    setEvents((current) => [...current, ...occurrences])
    setSelectedDateKey(scheduledDate)
    setAddEventOpen(false)
    showNotice(`${title} añadido para el ${formatEventDate(scheduledDate)} a las ${scheduledTime}.`)
  }

  const addProject = (formData: FormData) => {
    const name = String(formData.get('name') || '').trim()
    const description = String(formData.get('description') || '').trim()
    if (!name) return
    setProjects((current) => [...current, { id: Math.max(0, ...current.map((item) => item.id)) + 1, name, description: description || 'Nuevo proyecto', progress: 0, color: 'blue', due: 'Sin fecha' }])
    setProjectFormOpen(false)
    showNotice(`${name} creado.`)
  }

  const addMemory = (formData: FormData) => {
    const title = String(formData.get('title') || '').trim()
    const content = String(formData.get('content') || '').trim()
    if (!title || !content) return
    setMemories((current) => [...current, { id: Math.max(0, ...current.map((item) => item.id)) + 1, title, content, category: 'Nueva nota' }])
    setMemoryFormOpen(false)
    showNotice('Memoria guardada.')
  }

  const organizeSelectedDay = async () => {
    if (isThinking) return
    const dayEvents = events.filter((event) => event.date === selectedDateKey)
    const pendingEvents = dayEvents.filter((event) => !event.completed)
    if (pendingEvents.length === 0) { showNotice('No hay tareas pendientes para organizar.'); return }
    setScheduleProposal(null)
    setConversation((current) => [...current, { from: 'user', text: `Organiza mi día del ${selectedDateKey}.` }])
    setIsThinking(true)
    try {
      const context = {
        date: selectedDateKey,
        timeZone,
        events: dayEvents.map(({ id, title, time, duration, priority, completed, category, flexibilityMinutes, flexibilityStart, flexibilityEnd }) => ({ id, title, time, duration, priority: priority || 'media', completed: Boolean(completed), category, flexibilityMinutes: flexibilityMinutes || 0, flexibilityStart: flexibilityStart || null, flexibilityEnd: flexibilityEnd || null })),
        preferences: memories.map(({ title, content }) => `${title}: ${content}`),
      }
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: aiSettings[selectedProvider].apiKey,
          model: selectedModel,
          messages: [{ role: 'user', content: `Organiza el horario del día usando estos datos: ${JSON.stringify(context)}. Reordena solo los eventos no completados; conserva cada duración, deja intactos los completados y no crees ni elimines eventos. Prioriza los de prioridad alta y considera las preferencias. REGLA OBLIGATORIA: los eventos con flexibilityStart/end deben quedar enteros dentro de esa ventana; los que tienen flexibilityMinutes pueden moverse como máximo esa cantidad de minutos respecto a su hora; los demás son fijos. Solo puedes reorganizar dentro del día seleccionado. Devuelve exclusivamente JSON válido con esta forma: {"schedule":[{"id":1,"time":"09:00"}],"summary":"explicación breve en español"}. Incluye exactamente una entrada por cada evento pendiente y evita solapamientos.` }],
        }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'No pude obtener una propuesta del modelo.')
      const start = data.reply.indexOf('{')
      const end = data.reply.lastIndexOf('}')
      if (start < 0 || end <= start) throw new Error('La IA no devolvió una propuesta legible. Inténtalo de nuevo.')
      const result = JSON.parse(data.reply.slice(start, end + 1)) as { schedule?: ScheduleChange[]; summary?: string }
      if (!Array.isArray(result.schedule)) throw new Error('La propuesta no contiene un horario válido.')
      const validationError = validateSchedule(dayEvents, result.schedule)
      if (validationError) throw new Error(validationError)
      const summary = result.summary?.trim() || 'He preparado un horario sin solapamientos.'
      setScheduleProposal({ date: selectedDateKey, changes: result.schedule, summary })
      setConversation((current) => [...current, { from: 'assistant', text: `${summary} Revisa la propuesta antes de aplicarla.` }])
    } catch (error) {
      setConversation((current) => [...current, { from: 'assistant', text: error instanceof Error ? error.message : 'No pude organizar el día.' }])
    } finally {
      setIsThinking(false)
    }
  }

  const applyScheduleProposal = () => {
    if (!scheduleProposal || scheduleProposal.date !== selectedDateKey) return
    const dayEvents = events.filter((event) => event.date === scheduleProposal.date)
    const validationError = validateSchedule(dayEvents, scheduleProposal.changes)
    if (validationError) { setScheduleProposal(null); showNotice('La agenda cambió. Genera una nueva propuesta.'); return }
    const changes = new Map(scheduleProposal.changes.map((change) => [change.id, change.time]))
    setEvents((current) => current.map((event) => event.date === scheduleProposal.date && changes.has(event.id) ? { ...event, time: changes.get(event.id)! } : event))
    setScheduleProposal(null)
    showNotice('He aplicado el horario que aprobaste.')
  }

  const visibleEvents = events.filter((event) => `${event.title} ${event.place} ${event.tag || ''}`.toLowerCase().includes(search.toLowerCase()) && (priorityFilter === 'todas' || event.priority === priorityFilter) && (showCompleted || !event.completed))
  const selectedDayEvents = events.filter((event) => event.date === selectedDateKey)
  const completedCount = selectedDayEvents.filter((event) => event.completed).length
  const totalMinutes = selectedDayEvents.reduce((total, event) => total + durationToMinutes(event.duration), 0)
  const conflictIds = new Set(selectedDayEvents.filter((event, index, list) => list.some((other, otherIndex) => { if (index === otherIndex) return false; const start = event.time.split(':').map(Number); const otherStart = other.time.split(':').map(Number); const eventStart = start[0] * 60 + start[1]; const otherEventStart = otherStart[0] * 60 + otherStart[1]; return otherEventStart < eventStart + durationToMinutes(event.duration) && eventStart < otherEventStart + durationToMinutes(other.duration) })).map((event) => event.id))
  const renderSectionHub = () => activeSection === 'Proyectos' ? <section className="section-hub"><div className="hub-header"><div><p className="eyebrow">ESPACIO DE TRABAJO</p><h1>Proyectos</h1><p>Convierte tus objetivos en pasos que AURA pueda organizar.</p></div><button className="primary-action" onClick={() => setProjectFormOpen(true)}>+ Nuevo proyecto</button></div><div className="project-grid">{projects.map((project) => <article className="project-card" key={project.id}><div className={`project-icon ${project.color}`}>✦</div><div className="project-card-header"><div><h2>{project.name}</h2><p>{project.description}</p></div><button className="more-button" aria-label={`Opciones de ${project.name}`}>•••</button></div><div className="project-progress"><div><span>Progreso</span><strong>{project.progress}%</strong></div><div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div></div><footer><span>{project.due}</span><span>{project.progress === 100 ? 'Completado' : 'En curso'}</span></footer></article>)}</div>{projectFormOpen && <form className="inline-form" onSubmit={(event) => { event.preventDefault(); addProject(new FormData(event.currentTarget)) }}><div><p className="eyebrow">NUEVO PROYECTO</p><h2>¿En qué estás trabajando?</h2></div><input name="name" autoFocus placeholder="Nombre del proyecto" /><input name="description" placeholder="Descripción breve" /><div><button type="button" className="secondary-action" onClick={() => setProjectFormOpen(false)}>Cancelar</button><button className="primary-action" type="submit">Crear proyecto</button></div></form>}</section> : <section className="section-hub"><div className="hub-header"><div><p className="eyebrow">LO QUE AURA RECUERDA</p><h1>Memoria</h1><p>Contexto personal para que tus decisiones no empiecen de cero.</p></div><button className="primary-action" onClick={() => setMemoryFormOpen(true)}>+ Guardar memoria</button></div><div className="memory-list">{memories.map((memory) => <article className="memory-card" key={memory.id}><div className="memory-symbol">⌁</div><div><span>{memory.category}</span><h2>{memory.title}</h2><p>{memory.content}</p></div><button className="more-button" aria-label={`Opciones de ${memory.title}`}>•••</button></article>)}</div>{memoryFormOpen && <form className="inline-form memory-form" onSubmit={(event) => { event.preventDefault(); addMemory(new FormData(event.currentTarget)) }}><div><p className="eyebrow">NUEVA MEMORIA</p><h2>¿Qué debería recordar AURA?</h2></div><input name="title" autoFocus placeholder="Título" /><textarea name="content" placeholder="Escribe el contexto que quieres conservar..." /><div><button type="button" className="secondary-action" onClick={() => setMemoryFormOpen(false)}>Cancelar</button><button className="primary-action" type="submit">Guardar memoria</button></div></form>}</section>
  const selectedDate = formatDateLabel(selectedDateKey)
  const selectedDateObject = dateFromKey(selectedDateKey)
  const currentClock = new Date()
  const currentHour = currentClock.getHours()
  const currentMinute = currentClock.getMinutes()
  const weekStart = startOfWeek(selectedDateObject)
  const weekDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setDate(weekStart.getDate() + index); return dateKeyFromDate(date) })
  const monthStart = new Date(selectedDateObject.getFullYear(), selectedDateObject.getMonth(), 1)
  const monthDays = new Date(selectedDateObject.getFullYear(), selectedDateObject.getMonth() + 1, 0).getDate()
  const monthOffset = (monthStart.getDay() + 6) % 7
  const monthCells = Array.from({ length: Math.ceil((monthOffset + monthDays) / 7) * 7 }, (_, index) => index - monthOffset + 1)

  const changeCalendarDate = (direction: number) => {
    const nextDate = new Date(selectedDateObject)
    if (calendarView === 'day') nextDate.setDate(nextDate.getDate() + direction)
    if (calendarView === 'week') nextDate.setDate(nextDate.getDate() + direction * 7)
    if (calendarView === 'month') nextDate.setMonth(nextDate.getMonth() + direction)
    if (calendarView === 'year') nextDate.setFullYear(nextDate.getFullYear() + direction)
    setSelectedDateKey(dateKeyFromDate(nextDate))
  }

  const renderEventCard = (event: EventItem, compact = false, slotIndex = 0, overlap?: { left: string; width: string }) => { const height = `${Math.max(42, durationToMinutes(event.duration) / 60 * 72 - 8)}px`; const minuteOffset = Number(event.time.split(':')[1]) || 0; const updateTitle = (title: string) => setEvents((current) => current.map((item) => item.id === event.id ? { ...item, title: title || ' ' } : item)); const style = compact ? undefined : { height, top: `${minuteOffset / 60 * 72 + 4 + slotIndex * 4}px`, ...(overlap || {}) }; return <article key={event.id} style={style} className={`event-card ${event.accent} ${event.completed ? 'completed-event' : ''} ${conflictIds.has(event.id) ? 'conflict-event' : ''} ${compact ? 'compact-event' : ''}`} draggable={editingEventId !== event.id} onDragStart={() => setDraggedId(event.id)} onDragOver={(dragEvent) => dragEvent.preventDefault()} onDrop={(dragEvent) => { dragEvent.stopPropagation(); moveEvent(event.id) }}><div className="event-body"><div className="event-heading"><div className="event-title-row"><button className={`complete-toggle ${event.completed ? 'checked' : ''}`} aria-label={event.completed ? `Marcar ${event.title} como pendiente` : `Marcar ${event.title} como completada`} onClick={() => toggleComplete(event.id)}>{event.completed ? '✓' : ''}</button>{editingEventId === event.id ? <input className="inline-title" autoFocus value={event.title} onChange={(inputEvent) => updateTitle(inputEvent.target.value)} onBlur={() => setEditingEventId(null)} onKeyDown={(keyEvent) => { if (keyEvent.key === 'Enter') setEditingEventId(null) }} /> : <h2>{event.title}</h2>}</div><div className="event-actions"><span className={`priority-dot ${event.priority || 'media'}`} title={`Prioridad ${event.priority || 'media'}`} /><button aria-label={`Opciones de ${event.title}`} className="more-button" onClick={() => setEventMenuId(eventMenuId === event.id ? null : event.id)}>•••</button>{eventMenuId === event.id && <div className="event-menu"><button onClick={() => openEditEvent(event.id)}>Editar</button><button onClick={() => duplicateEvent(event.id)}>Duplicar</button><button onClick={() => removeEvent(event.id)}>Eliminar solo este día</button>{event.recurrence && event.recurrence !== 'No se repite' && <button onClick={() => removeEventSeries(event.id)}>Eliminar serie</button>}</div>}</div></div><p>{event.place} {event.tag && <span className="event-tag">#{event.tag}</span>}</p><span className="duration">{event.time} · {event.duration}{conflictIds.has(event.id) && <b className="conflict-label"> · Conflicto</b>}</span></div></article> }

  const renderDayView = () => { const dayEvents = visibleEvents.filter((event) => event.date === selectedDateKey); const sortedEvents = [...dayEvents].sort((a, b) => a.time.localeCompare(b.time)); const columns: number[] = []; const layouts = new Map<number, { left: string; width: string }>(); sortedEvents.forEach((event) => { const [hour, minute] = event.time.split(':').map(Number); const start = hour * 60 + minute; const end = start + durationToMinutes(event.duration); let column = columns.findIndex((columnEnd) => columnEnd <= start); if (column === -1) { column = columns.length; columns.push(end) } else columns[column] = end; const overlapping = sortedEvents.filter((other) => { const [otherHour, otherMinute] = other.time.split(':').map(Number); const otherStart = otherHour * 60 + otherMinute; const otherEnd = otherStart + durationToMinutes(other.duration); return otherStart < end && otherEnd > start }).length; layouts.set(event.id, { left: `${(column / overlapping) * 100}%`, width: `calc(${100 / overlapping}% - 4px)` }) }); return <div className="timeline"><div className="event-list"><div className="calendar-head"><span></span><strong>{weekDayNames[selectedDateObject.getDay()]} {selectedDateObject.getDate()}</strong></div>{Array.from({ length: 24 }, (_, hour) => { const hourEvents = dayEvents.filter((event) => Number(event.time.split(':')[0]) === hour); const isSelected = dragSelection && hour * 60 + 59 >= Math.min(dragSelection.start, dragSelection.end) && hour * 60 <= Math.max(dragSelection.start, dragSelection.end); const isCurrentHour = hour === currentHour; return <div className={`calendar-row ${isCurrentHour ? 'current-row' : ''} ${isSelected ? 'selecting-row' : ''}`} key={hour}><span className="calendar-time">{String(hour).padStart(2, '0')}:00</span><div className="calendar-cell" onPointerDown={(event) => beginTimeSelection(hour, event)} onPointerEnter={(event) => updateTimeSelection(hour, event)} onPointerUp={(event) => finishTimeSelection(hour, event)} onMouseDown={(event) => beginTimeSelection(hour, event)} onMouseEnter={(event) => updateTimeSelection(hour, event)} onMouseUp={(event) => finishTimeSelection(hour, event)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveEventToTime(hour, event)}>{isCurrentHour && <span className="now-line" style={{ top: `${currentMinute / 60 * 100}%` }}><i>Ahora</i></span>}{isSelected && <span className="selection-label">{String(Math.floor(Math.min(dragSelection.start, dragSelection.end) / 60)).padStart(2, '0')}:{String(Math.min(dragSelection.start, dragSelection.end) % 60).padStart(2, '0')}</span>}{hourEvents.map((event, slotIndex) => renderEventCard(event, false, slotIndex, layouts.get(event.id)))}</div></div> })}<button className="empty-slot" onClick={() => openAddEvent(selectedDateKey)}><span>+</span><span>Crear un evento</span></button></div></div> }

  const renderWeekView = () => {
    const hours = Array.from({ length: 12 }, (_, index) => index + 1)
    const rangeStart = 60
    const rangeEnd = 13 * 60
    const rowHeight = 72
    return <div className="week-view"><div className="week-head"><span></span>{weekDays.map((day) => <button key={day} className={day === selectedDateKey ? 'selected-day' : ''} onClick={() => { setSelectedDateKey(day); setCalendarView('day') }}><small>{weekDayNames[dateFromKey(day).getDay()]}</small><strong>{dateFromKey(day).getDate()}</strong></button>)}</div><div className="week-grid"><div className="week-times">{hours.map((hour) => <span key={hour}>{hour} {hour === 12 ? 'PM' : 'AM'}</span>)}</div>{weekDays.map((day) => {
      const dayEvents = visibleEvents.filter((event) => event.date === day).sort((first, second) => first.time.localeCompare(second.time))
      const columns: number[] = []
      const layouts = new Map<number, { left: string; width: string }>()
      dayEvents.forEach((event) => {
        const [hour, minute] = event.time.split(':').map(Number)
        const start = hour * 60 + minute
        const end = start + durationToMinutes(event.duration)
        let column = columns.findIndex((columnEnd) => columnEnd <= start)
        if (column === -1) { column = columns.length; columns.push(end) } else columns[column] = end
        const overlapping = dayEvents.filter((other) => {
          const [otherHour, otherMinute] = other.time.split(':').map(Number)
          const otherStart = otherHour * 60 + otherMinute
          return otherStart < end && otherStart + durationToMinutes(other.duration) > start
        }).length
        layouts.set(event.id, { left: `${column / overlapping * 100}%`, width: `calc(${100 / overlapping}% - 4px)` })
      })
      return <div className="week-column" key={day}>{hours.map((hour) => <div className="week-slot" key={hour} />)}{dayEvents.map((event) => {
        const [hour, minute] = event.time.split(':').map(Number)
        const start = hour * 60 + minute
        if (start < rangeStart || start >= rangeEnd) return null
        const height = Math.max(24, Math.min(durationToMinutes(event.duration), rangeEnd - start) / 60 * rowHeight - 4)
        const layout = layouts.get(event.id)
        return <article key={event.id} className={`week-event ${event.accent}`} style={{ top: `${(start - rangeStart) / 60 * rowHeight + 2}px`, height: `${height}px`, ...(layout || {}) }} title={`${event.time} · ${event.title} · ${event.duration}`}><strong>{event.time}</strong><span>{event.title}</span><small>{event.duration}</small></article>
      })}</div>
    })}</div></div>
  }

  const renderMonthView = () => <div className="month-view"><div className="month-weekdays">{['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((day) => <strong key={day}>{day}</strong>)}</div><div className="month-grid">{monthCells.map((day, index) => { const isCurrentMonth = day > 0 && day <= monthDays; const dateKey = isCurrentMonth ? dateKeyFromDate(new Date(selectedDateObject.getFullYear(), selectedDateObject.getMonth(), day)) : ''; const dayEvents = visibleEvents.filter((event) => event.date === dateKey).sort((first, second) => first.time.localeCompare(second.time)); return <button key={`${day}-${index}`} className={`month-cell ${dateKey === selectedDateKey ? 'selected-day' : ''} ${!isCurrentMonth ? 'outside-month' : ''}`} onClick={() => isCurrentMonth && openAddEvent(dateKey)}>{isCurrentMonth && <><span className="month-number">{day}</span>{dayEvents.slice(0, 3).map((event) => <span className={`month-event ${event.accent}`} key={event.id} title={`${event.time} · ${event.title} · ${event.duration}`}><time>{event.time}</time><span>{event.title}</span><small>{event.duration}</small></span>)}{dayEvents.length > 3 && <span className="month-more">+{dayEvents.length - 3} más</span>}{dayEvents.length === 0 && <span className="month-add">+</span>}</>}</button> })}</div></div>

  const renderYearView = () => <div className="year-view">{Array.from({ length: 12 }, (_, monthIndex) => { const monthName = new Date(selectedDateObject.getFullYear(), monthIndex, 1).toLocaleDateString('es-ES', { month: 'long' }); const daysInMonth = new Date(selectedDateObject.getFullYear(), monthIndex + 1, 0).getDate(); const offset = (new Date(selectedDateObject.getFullYear(), monthIndex, 1).getDay() + 6) % 7; return <button className="year-month" key={monthName} onClick={() => { setSelectedDateKey(dateKeyFromDate(new Date(selectedDateObject.getFullYear(), monthIndex, 1))); setCalendarView('month') }}><h3>{monthName}</h3><div className="mini-weekdays">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => <span key={day}>{day}</span>)}</div><div className="mini-days">{Array.from({ length: offset + daysInMonth }, (_, index) => { const day = index - offset + 1; const dateKey = day > 0 ? dateKeyFromDate(new Date(selectedDateObject.getFullYear(), monthIndex, day)) : ''; const dayEvents = visibleEvents.filter((event) => event.date === dateKey); const details = dayEvents.map((event) => `${event.time} ${event.title} (${event.duration})`).join('; '); return <span className={`${dayEvents.length ? 'has-event' : ''} ${dateKey === selectedDateKey ? 'selected-mini-day' : ''}`} title={details || undefined} aria-label={day > 0 ? `${day}${details ? `: ${details}` : ''}` : undefined} key={index}>{day > 0 ? day : ''}</span> })}</div></button> })}</div>

  const applyCommand = async (rawMessage: string) => {
    const text = rawMessage.trim()
    if (!text) return
    const normalized = text.toLowerCase()
    const requestedTime = text.match(/(?:a las|las)\s+(\d{1,2})(?::(\d{2}))?/) 
    const eventToMove = events.find((event) => normalized.includes(event.title.toLowerCase()))
    if (eventToMove && !eventToMove.seriesId && requestedTime) {
      const newTime = `${String(Number(requestedTime[1])).padStart(2, '0')}:${requestedTime[2] || '00'}`
      setEvents((current) => current.map((event) => event.id === eventToMove.id ? { ...event, time: newTime, date: selectedDateKey } : event))
      setConversation((current) => [...current, { from: 'user', text }, { from: 'assistant', text: `He movido “${eventToMove.title}” a las ${newTime}.` }])
      setMessage('')
      return
    }
    if (normalized.includes('elimina') || normalized.includes('borra')) {
      const eventToRemove = eventToMove || events.find((event) => event.date === selectedDateKey)
      if (eventToRemove) {
        setConversation((current) => [...current, { from: 'user', text }])
        confirmAction(`Confirma la eliminación de “${eventToRemove.title}”.`, () => {
          setEvents((current) => current.filter((event) => event.id !== eventToRemove.id))
          showNotice(`${eventToRemove.title} se ha eliminado de tu día.`)
        })
        setMessage('')
        return
      }
    }
    setConversation((current) => [...current, { from: 'user', text }])
    setMessage('')
    setIsThinking(true)
    try {
      const recentConversation = conversation.slice(-20)
      const firstUserMessage = recentConversation.findIndex((item) => item.from === 'user')
      const historyMessages = recentConversation.slice(firstUserMessage < 0 ? recentConversation.length : firstUserMessage).map((item) => ({ role: item.from, content: item.text }))
      const now = new Date()
      const localDate = dateKeyFromDate(now)
      const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const priorUserMessages = recentConversation.filter((item) => item.from === 'user').slice(-4).map((item) => item.text)
      const dateWasSpecified = hasExplicitDate(text) || priorUserMessages.some(hasExplicitDate)
      const seriesCatalog = Array.from(new Map(events.filter((event) => event.seriesId).map((event) => [event.seriesId!, event])).values()).map((seriesEvent) => {
        const occurrences = events.filter((event) => event.seriesId === seriesEvent.seriesId)
        const daysByTime = new Map<string, number[]>()
        occurrences.forEach((event) => {
          const days = daysByTime.get(event.time) || []
          const day = dateFromKey(event.date).getDay()
          if (!days.includes(day)) days.push(day)
          daysByTime.set(event.time, days)
        })
        const weeklySchedule = Array.from(daysByTime.entries()).map(([time, days]) => ({ days, time }))
        return { title: seriesEvent.title, seriesId: seriesEvent.seriesId, recurrence: seriesEvent.recurrence, weeklySchedule }
      })
      const assistantContext = `Fecha y hora local: ${localDate} ${localTime} (${timeZone}); usa fechas ISO locales y entiende DD/MM/YYYY como día/mes/año. Si agenda una tarea única, devuelve {"action":"create_event","event":{"title":"...","date":"YYYY-MM-DD o null","time":"HH:mm o null","duration":"30 min","place":"Agenda personal","category":"personal","priority":"media","flexibilityMinutes":0,"flexibilityWindow":null}}. Si pide una rutina recurrente nueva, devuelve {"action":"create_series","series":{"title":"...","startDate":"YYYY-MM-DD","duration":"30 min","place":"Agenda personal","weeklySchedule":[{"days":[1,2,3,4,5],"time":"16:00"},{"days":[0,6],"time":"07:30"}]}}. Los días son números: 0 domingo, 1 lunes, ..., 6 sábado. Interpreta “entre semana” como [1,2,3,4,5] y “fines de semana” como [0,6]; permite horas diferentes por grupo. Para editar una serie existente devuelve {"action":"edit_series","targetTitle":"título exacto del catálogo","weeklySchedule":[{"days":[...],"time":"HH:mm"}],"series":{"title":"opcional","duration":"opcional"}} y actualiza solo las ocurrencias existentes, no recrees días que se borraron. Catálogo actual de series: ${JSON.stringify(seriesCatalog)}. Si indica ventana de fecha/hora para una tarea única, conserva flexibilidadWindow y busca un hueco; no la conviertas en serie. No confirmes cambios que no apliques. Si no pide agendar ni editar, devuelve {"action":"reply","reply":"respuesta breve en español"}. Eventos próximos: ${events.slice(0, 80).map((event) => `${event.title} (${event.date} ${event.time}, ${event.duration})`).join('; ')}. Preferencias: ${memories.map((memory) => `${memory.title}: ${memory.content}`).join('; ')}. Solicitud actual: ${text}`
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: selectedProvider, apiKey: aiSettings[selectedProvider].apiKey, model: selectedModel, messages: [...historyMessages, { role: 'user', content: assistantContext }] }) })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok) throw new Error(data.error || 'No pude obtener una respuesta del asistente.')
      const reply = data.reply || ''
      const jsonStart = reply.indexOf('{')
      const jsonEnd = reply.lastIndexOf('}')
      let result: AssistantResult | null = null
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        try { result = JSON.parse(reply.slice(jsonStart, jsonEnd + 1)) as AssistantResult } catch { result = null }
      }
      if (result?.action === 'create_series' && result.series) {
        const series = result.series
        const startDate = series.startDate && isValidDateKey(series.startDate) ? series.startDate : localDate
        const firstId = Math.max(0, ...events.map((event) => event.id)) + 1
        const seriesId = `aura-series-${firstId}`
        const generated = buildWeeklySeries(seriesId, series, startDate, series.weeklySchedule || [])
        if (!generated.length) throw new Error('No pude crear la serie: revisa los días y las horas que propusiste.')
        setEvents((current) => [...current, ...generated.map((event, index) => ({ ...event, id: firstId + index }))])
        setSelectedDateKey(startDate)
        setCalendarView('day')
        setConversation((current) => [...current, { from: 'assistant', text: `Creé la serie de “${series.title}” con ${generated.length} ocurrencias para el próximo año.` }])
      } else if (result?.action === 'edit_series') {
        const targetTitle = result.targetTitle?.trim().toLocaleLowerCase('es')
        const target = events.find((event) => event.seriesId && event.title.toLocaleLowerCase('es') === targetTitle)
        const schedule = result.weeklySchedule || []
        if (!target || !target.seriesId) throw new Error(`No encontré una serie recurrente llamada “${result.targetTitle || ''}”.`)
        if (!isValidWeeklySchedule(schedule)) throw new Error('No pude interpretar las nuevas horas semanales de la serie.')
        const rules = new Map(schedule.flatMap((rule) => rule.days.map((day) => [day, rule.time] as const)))
        setEvents((current) => current.map((event) => {
          if (event.seriesId !== target.seriesId) return event
          const time = rules.get(dateFromKey(event.date).getDay())
          return time ? { ...event, time, title: result.series?.title?.trim() || event.title, duration: result.series?.duration?.trim() || event.duration } : event
        }))
        setConversation((current) => [...current, { from: 'assistant', text: `Actualicé la serie de “${target.title}” en los días y horarios indicados.` }])
      } else if (result?.action === 'create_event' && result.event) {
        const eventData = result.event
        const title = eventData.title?.trim()
        const modelTime = eventData.time?.trim()
        if (modelTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(modelTime)) throw new Error('La IA devolvió una hora no válida. Prueba a pedirla en formato de 24 horas, por ejemplo 17:30.')
        if (!title) throw new Error('La IA detectó una solicitud de agenda pero no pudo identificar el nombre de la tarea. Prueba a indicar qué necesitas hacer.')
        let flexibilityStart: string | undefined
        let flexibilityEnd: string | undefined
        const flexibilityMinutes = eventData.flexibilityMinutes || 0
        if (!Number.isFinite(flexibilityMinutes) || flexibilityMinutes < 0 || flexibilityMinutes > 1440) throw new Error('El margen en minutos debe estar entre 0 y 1440.')
        let date: string
        let time: string
        const requestedWindow = eventData.flexibilityWindow
        if (requestedWindow) {
          flexibilityStart = requestedWindow.start
          flexibilityEnd = requestedWindow.end
          const start = flexibilityStart && parseLocalDateTime(flexibilityStart)
          const end = flexibilityEnd && parseLocalDateTime(flexibilityEnd)
          if (!start || !end || start >= end) throw new Error('No pude interpretar la ventana de fecha y hora. Prueba con un intervalo concreto, por ejemplo “mañana entre las 15:00 y las 18:00”.')
          const availableSlot = findAvailableSlot(events, eventData.duration || '30 min', flexibilityStart!, flexibilityEnd!)
          if (!availableSlot) throw new Error('No encontré un espacio libre con duración suficiente dentro de esa ventana.')
          date = availableSlot.date
          time = availableSlot.time
        } else {
          time = modelTime || nextAvailableTime(now)
          const modelDate = eventData.date && isValidDateKey(eventData.date) ? eventData.date : null
          if (dateWasSpecified && !modelDate) throw new Error('No pude confirmar la fecha que pediste. Especifica el día con más claridad e inténtalo de nuevo.')
          date = dateWasSpecified ? modelDate! : defaultDateForTime(time, now)
        }
        const newId = Math.max(0, ...events.map((event) => event.id)) + 1
        const category = eventData.category || 'personal'
        const accent = category === 'focus' ? 'blue' : category === 'move' ? 'green' : category === 'rest' ? 'purple' : 'coral'
        setEvents((current) => [...current, { id: newId, date, time, title, place: eventData.place?.trim() || 'Agenda personal', category, duration: eventData.duration?.trim() || '30 min', accent, priority: eventData.priority || 'media', flexibilityMinutes, flexibilityStart, flexibilityEnd, tag: 'Personal' }])
        setSelectedDateKey(date)
        setCalendarView('day')
        setConversation((current) => [...current, { from: 'assistant', text: `Agendé “${title}” para el ${formatEventDate(date)} a las ${time}. Ya aparece en tu calendario.` }])
      } else {
        setConversation((current) => [...current, { from: 'assistant', text: result?.reply || reply || data.error || 'No pude obtener una respuesta.' }])
      }
    } catch (error) {
      setConversation((current) => [...current, { from: 'assistant', text: error instanceof Error ? error.message : 'No pude completar la solicitud. Comprueba tu clave API y vuelve a intentarlo.' }])
    } finally {
      setIsThinking(false)
    }
  }

  const duplicateCurrentConversation = () => {
    if (!activeConversation) return
    const duplicateId = `conversation-${conversationSessions.length + 1}`
    setConversationSessions((current) => [...current, { ...activeConversation, id: duplicateId, title: `Copia de ${activeConversation.title}`, messages: [...activeConversation.messages] }])
    setActiveConversationId(duplicateId)
    setScheduleProposal(null)
    showNotice('He duplicado la conversación. La copia es independiente de la original.')
  }

  const startNewConversation = () => {
    const conversationId = `conversation-${conversationSessions.length + 1}`
    setConversationSessions((current) => [...current, { id: conversationId, title: `Conversación ${current.length + 1}`, messages: [{ from: 'assistant', text: 'Conversación nueva. ¿Qué te gustaría planificar?' }] }])
    setActiveConversationId(conversationId)
    setScheduleProposal(null)
    showNotice('He iniciado una conversación nueva.')
  }

  const moveEvent = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return
    const fromIndex = events.findIndex((event) => event.id === draggedId)
    const toIndex = events.findIndex((event) => event.id === targetId)
    const reordered = [...events]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    setEvents(reordered)
    setDraggedId(null)
    setConversation((current) => [...current, { from: 'assistant', text: `He reordenado la agenda: ${moved.title} queda antes de ${events[toIndex].title}.` }])
  }

  const moveEventToTime = (hour: number, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (draggedId === null) return
    const minute = pointerMinute(hour, event)
    const newTime = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
    const movedEvent = events.find((item) => item.id === draggedId)
    setEvents((current) => current.map((item) => item.id === draggedId ? { ...item, date: selectedDateKey, time: newTime } : item))
    setDraggedId(null)
    if (movedEvent) showNotice(`${movedEvent.title} movida a las ${newTime}.`)
  }

  return (
    <main className={`app-shell ${darkMode ? 'dark-mode' : ''}`}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">a</span><span className="brand-copy"><strong>AURA</strong><small>Autonomous Unified Routine Assistant</small></span></div>
        <nav>{['Mi día', 'Proyectos', 'Memoria'].map((section) => <button key={section} className={`nav-link ${activeSection === section ? 'active' : ''}`} onClick={() => { setActiveSection(section); showNotice(`${section}: vista seleccionada.`) }}>{section}</button>)}</nav>
        <div className="top-actions">{searchOpen && <input autoFocus className="top-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en tu día" />}<button className="icon-button" aria-label="Buscar" onClick={() => { setSearchOpen((current) => !current); if (searchOpen) setSearch('') }}>⌕</button><button className="theme-button" aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'} onClick={toggleTheme}>{darkMode ? '☀' : '☾'}</button><div className="profile-wrap"><button className="avatar" aria-label="Abrir perfil" onClick={() => setProfileOpen((current) => !current)}>AL</button>{profileOpen && <div className="profile-menu"><strong>{userEmail || 'Modo local'}</strong><span>{userEmail ? 'Cuenta sincronizada' : 'Plan local'}</span>{onSignOut ? <button onClick={() => { setProfileOpen(false); void persistBeforeSignOut() }}>Cerrar sesión</button> : <button onClick={() => { setProfileOpen(false); showNotice('Sesión local activa.') }}>Cerrar menú</button>}</div>}</div></div>
      </header>

      <div className="workspace">
        {activeSection !== 'Mi día' && renderSectionHub()}
        <section className={`agenda-column ${activeSection !== 'Mi día' ? 'section-hidden' : ''}`}>
          <div className="calendar-toolbar"><button className="today-button" onClick={() => { const today = todayDateKey(); setSelectedDateKey(today); setNewEventDate(today); showNotice('Has vuelto a hoy.') }}>Hoy</button><button className="calendar-arrow" aria-label="Periodo anterior" onClick={() => changeCalendarDate(-1)}>‹</button><button className="calendar-arrow" aria-label="Periodo siguiente" onClick={() => changeCalendarDate(1)}>›</button><div className="calendar-heading"><p className="eyebrow">{selectedDate}</p><h1>{calendarView === 'year' ? selectedDateObject.getFullYear() : calendarView === 'month' ? selectedDateObject.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'Tu día, a tu ritmo.'}</h1></div><div className="date-picker"><button className="view-button" onClick={() => setDateMenuOpen((current) => !current)}>{calendarView === 'day' ? 'Día' : calendarView === 'week' ? 'Semana' : calendarView === 'month' ? 'Mes' : 'Año'} <span>⌄</span></button>{dateMenuOpen && <div className="date-menu">{[['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['year', 'Año']].map(([value, label]) => <button key={value} onClick={() => { setCalendarView(value as typeof calendarView); setDateMenuOpen(false) }}>{label}</button>)}</div>}</div></div>
          <div className="day-meta"><span className="local-clock">◷ {localTime}</span><span className="timezone">{timeZone}</span><span className="dot" /><span className="sun">☼</span><span>{temperature === null ? '--°' : `${temperature}°`} en {city}</span><span className="dot" /><span>{events.length} bloques</span><span className="meta-spacer" /><button className="text-button" onClick={() => openAddEvent()}>+ Crear</button></div>
          {calendarView === 'day' && renderDayView()}{calendarView === 'week' && renderWeekView()}{calendarView === 'month' && renderMonthView()}{calendarView === 'year' && renderYearView()}
        </section>
        {activeSection === 'Mi día' && <div className="productivity-panel"><div className="productivity-summary"><strong>{completedCount}/{selectedDayEvents.length}</strong><span>completadas</span><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong><span>planificadas</span>{conflictIds.size > 0 && <strong className="conflict-count">{conflictIds.size} conflictos</strong>}</div><div className="productivity-controls"><label>Prioridad<select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}><option value="todas">Todas</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></label><button onClick={() => setShowCompleted((current) => !current)}>{showCompleted ? 'Ocultar completadas' : 'Mostrar completadas'}</button><button className="organize-day-button" disabled={isThinking} onClick={organizeSelectedDay}>{isThinking ? 'Organizando...' : '✦ Organizar día'}</button></div></div>}
        {activeSection === 'Mi día' && events[0] && <div className="task-shortcuts"><button className="edit-shortcut" onClick={() => openEditEvent(events[0].id)}>Editar primera tarea</button><button className="delete-shortcut" onClick={() => removeEvent(events[0].id)}>Eliminar primera tarea</button></div>}

        <aside className={`assistant-panel ${activeSection !== 'Mi día' ? 'section-hidden' : ''}`}>
          <div className="assistant-header"><div className="assistant-title"><span className="spark">✦</span><div><p className="eyebrow">AURA AI</p><h2>Tu copiloto</h2><div className="ai-setup-row"><select className="provider-select" aria-label="Proveedor de IA" value={selectedProvider} onChange={(event) => handleProviderChange(event.target.value as keyof typeof providerModels)}>{providerOrder.map((provider) => <option key={provider} value={provider}>{providerLabels[provider]}</option>)}</select><button type="button" className="settings-link" onClick={() => setAiSettingsOpen((current) => !current)}>Claves IA</button></div><select className="model-select" aria-label="Modelo de IA" value={selectedModel} onChange={(event) => { setSelectedModel(event.target.value); setAiSettings((current) => ({ ...current, [selectedProvider]: { ...current[selectedProvider], model: event.target.value } })) }}>{providerModels[selectedProvider].map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></div></div><span className="online-dot">En línea</span></div>
          {aiSettingsOpen && <div className="ai-settings-panel">{providerOrder.map((provider) => <label key={provider} className="ai-key-field"><span>{providerLabels[provider]}</span><input type="password" value={aiSettings[provider].apiKey} onChange={(event) => updateAiSetting(provider, 'apiKey', event.target.value)} placeholder={`Pega la clave de ${providerLabels[provider]}`} /></label>)}<div className="ai-settings-actions"><button type="button" className="secondary-action" onClick={() => setAiSettingsOpen(false)}>Cerrar</button><button type="button" className="primary-action" onClick={() => { setAiSettingsOpen(false); showNotice('Credenciales guardadas en tu navegador.') }}>Guardar</button></div></div>}
          {scheduleProposal && <div className="schedule-proposal"><strong>Propuesta para {scheduleProposal.date}</strong><ul>{scheduleProposal.changes.map((change) => { const event = events.find((item) => item.id === change.id); return event ? <li key={change.id}><span>{event.title}</span><span>{event.time} → {change.time}</span></li> : null })}</ul><div><button onClick={() => setScheduleProposal(null)}>Descartar</button><button className="proposal-apply" disabled={scheduleProposal.date !== selectedDateKey} onClick={applyScheduleProposal}>Aplicar horario</button></div></div>}
          <div className="conversation">{conversation.map((item, index) => <div key={`${item.text}-${index}`} className={`message ${item.from}`}><p>{item.text}</p></div>)}{isThinking && <div className="message assistant thinking"><div className="typing-indicator" aria-label="El modelo está escribiendo"><span className="dot one" /><span className="dot two" /><span className="dot three" /></div></div>}<div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion} disabled={isThinking} onClick={() => applyCommand(suggestion)}>{suggestion}</button>)}</div></div>
          <div className="conversation-controls"><select aria-label="Conversaciones guardadas" disabled={isThinking} value={activeConversationId} onChange={(event) => { setActiveConversationId(event.target.value); setScheduleProposal(null) }}>{conversationSessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}</select><button type="button" className="new-chat-button" disabled={isThinking} onClick={duplicateCurrentConversation}>⧉ Duplicar conversación</button><button type="button" className="new-chat-button" disabled={isThinking} onClick={startNewConversation}>＋ Nueva conversación</button></div>
          <form className="composer" onSubmit={(event) => { event.preventDefault(); applyCommand(message) }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Dile a Aura qué necesitas..." /><button type="submit" aria-label="Enviar mensaje">↗</button></form>
          <div className={`voice-note ${voiceActive ? 'voice-active' : ''}`}><span className="wave">⌁</span><span>{voiceActive ? 'Escuchando tu instrucción...' : 'También puedes hablar con Aura'}</span><button aria-label="Activar dictado" onClick={toggleVoice}>◉</button></div>
          <div className="insight"><span className="insight-icon">✧</span><div><strong>Una pequeña observación</strong><p>Tu tarde tiene 45 min de margen. Es un buen momento para cerrar el día sin prisa.</p></div></div>
        </aside>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
      {pendingAction && <div className="confirm-bar" role="alert"><span>¿Quieres continuar?</span><button onClick={() => { pendingAction(); setPendingAction(null) }}>Confirmar</button><button onClick={() => setPendingAction(null)}>Cancelar</button></div>}
      {addEventOpen && <div className="modal-backdrop" onClick={() => setAddEventOpen(false)}><form className="add-modal" onSubmit={(event) => { event.preventDefault(); addEvent(new FormData(event.currentTarget)) }} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{formEventId === null ? 'NUEVO EVENTO' : 'EDITAR EVENTO'}</p><h2>{formEventId === null ? 'Añadir a tu calendario' : 'Actualizar tarea'}</h2></div><button type="button" className="modal-close" aria-label="Cerrar" onClick={() => setAddEventOpen(false)}>×</button></div><label>Qué necesitas hacer<input name="title" autoFocus defaultValue={formEventId === null ? '' : events.find((item) => item.id === formEventId)?.title} placeholder="Ej. Preparar la presentación" /></label><div className="form-row"><label>Fecha<input name="date" type="date" defaultValue={newEventDate} /></label><label>Hora<input name="time" type="time" defaultValue={newEventTime} /></label></div><div className="form-row"><label>Duración<div className="custom-value-field"><input name="durationValue" type="number" min="0.25" step="0.25" defaultValue={durationParts(formEventId === null ? newEventDuration : events.find((item) => item.id === formEventId)?.duration || '30 min').value} /><select name="durationUnit" defaultValue={durationParts(formEventId === null ? newEventDuration : events.find((item) => item.id === formEventId)?.duration || '30 min').unit}><option value="min">minutos</option><option value="h">horas</option></select></div></label><label>Lugar<input name="place" defaultValue={formEventId === null ? '' : events.find((item) => item.id === formEventId)?.place} placeholder="Opcional" /></label></div><div className="form-row"><label>Flexibilidad<select name="flexibilityMode" value={flexibilityMode} onChange={(event) => setFlexibilityMode(event.target.value as typeof flexibilityMode)}><option value="fixed">Fija</option><option value="minutes">Margen en minutos</option><option value="window">Ventana de fecha y hora</option></select></label>{flexibilityMode === 'minutes' && <label>Margen máximo (min)<input name="flexibilityMinutes" type="number" min="0" max="1440" step="1" defaultValue={formEventId === null ? 0 : events.find((item) => item.id === formEventId)?.flexibilityMinutes || 30} /></label>}</div>{flexibilityMode === 'window' && <div className="form-row"><label>Disponible desde<input name="flexibilityStart" type="datetime-local" defaultValue={formEventId === null ? '' : events.find((item) => item.id === formEventId)?.flexibilityStart || ''} /></label><label>Disponible hasta<input name="flexibilityEnd" type="datetime-local" defaultValue={formEventId === null ? '' : events.find((item) => item.id === formEventId)?.flexibilityEnd || ''} /></label></div>}<div className="form-row"><label>Se repite<select name="recurrence" defaultValue={formEventId === null ? 'No se repite' : events.find((item) => item.id === formEventId)?.recurrence || 'No se repite'}><option>No se repite</option><option>Cada día</option><option>Cada semana</option><option>Cada mes</option></select></label><label>Recordatorio<select name="reminder" value={reminderCustomEnabled ? 'Personalizado' : formEventId === null ? 'Sin recordatorio' : events.find((item) => item.id === formEventId)?.reminder || 'Sin recordatorio'} onChange={(event) => { setReminderCustomEnabled(event.target.value === 'Personalizado'); if (event.target.value !== 'Sin recordatorio') requestNotifications() }}><option>Sin recordatorio</option><option>5 minutos antes</option><option>10 minutos antes</option><option>30 minutos antes</option><option>1 hora antes</option><option>Personalizado</option></select></label></div>{reminderCustomEnabled && <div className="form-row"><label>Recordar con antelación<div className="custom-value-field"><input name="customReminderValue" type="number" min="1" step="1" defaultValue={reminderParts(formEventId === null ? '10 minutos antes' : events.find((item) => item.id === formEventId)?.reminder || '10 minutos antes').value} /><select name="customReminderUnit" defaultValue={reminderParts(formEventId === null ? '10 minutos antes' : events.find((item) => item.id === formEventId)?.reminder || '10 minutos antes').unit}><option value="minutos">minutos</option><option value="horas">horas</option></select></div></label></div>}<button className="modal-submit" type="submit">{formEventId === null ? 'Añadir evento' : 'Guardar cambios'}</button></form></div>}
      <footer><span>Planificado con intención</span><span>Última sincronización: ahora</span></footer>
    </main>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(!supabase)
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [localMode, setLocalMode] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    let active = true
    const client = supabase
    void client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionReady(true)
    })
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setSessionReady(true)
      setAuthMessage('')
      if (!nextSession) setSnapshot(null)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user.id) return
    let active = true
    const client = supabase
    const userId = session.user.id
    const loadSnapshot = async () => {
      try {
        const { data, error } = await client.from('aura_user_data').select('data').eq('user_id', userId).maybeSingle()
        if (error) throw error
        const apiKeyStorageKey = `aura-ai-settings:${userId}`
        const legacyMigration = !data && !localStorage.getItem('aura-cloud-migration-complete')
        let loaded = data?.data && typeof data.data === 'object'
          ? data.data as AppSnapshot
          : legacyMigration ? readLocalAppSnapshot() : createEmptyAppSnapshot()
        if (legacyMigration) {
          const legacySettings = localStorage.getItem('aura-ai-settings')
          if (legacySettings && !localStorage.getItem(apiKeyStorageKey)) localStorage.setItem(apiKeyStorageKey, legacySettings)
          localStorage.removeItem('aura-ai-settings')
        }
        if (!data) {
          const { error: migrationError } = await client.from('aura_user_data').upsert({ user_id: userId, data: snapshotForCloud(loaded) }, { onConflict: 'user_id' })
          if (migrationError) throw migrationError
        }
        if (!active) return
        localStorage.setItem('aura-cloud-migration-complete', 'true')
        loaded = { ...loaded, aiSettings: mergeAiSettings(loaded.aiSettings, apiKeyStorageKey) }
        setSnapshot(loaded)
      } catch (error) {
        if (active) setAuthMessage(error instanceof Error ? error.message : 'No se pudieron cargar tus datos. Revisa el esquema de almacenamiento.')
      }
    }
    void loadSnapshot()
    return () => { active = false }
  }, [session?.user.id])

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setAuthBusy(true)
    setAuthMessage('')
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        if (data.session) setSession(data.session)
        else setAuthMessage('Cuenta creada. Revisa tu correo para confirmar el registro y luego inicia sesión.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        setSession(data.session)
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'No se pudo autenticar la cuenta.')
    } finally {
      setAuthBusy(false)
    }
  }

  const signInWithGoogle = async () => {
    if (!supabase) { setAuthMessage('Para activar Google, configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env y reinicia la app.'); return }
    setAuthBusy(true)
    setAuthMessage('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
      if (error) throw error
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google.')
      setAuthBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) { setLocalMode(false); return }
    const { error } = await supabase.auth.signOut()
    if (error) setAuthMessage(error.message)
    else ['aura-events', 'aura-projects', 'aura-memories', 'aura-conversations', 'aura-active-conversation', 'aura-conversation'].forEach((key) => localStorage.removeItem(key))
  }

  const saveSnapshot = async (data: AppSnapshot) => {
    if (!supabase || !session?.user.id) return
    const { error } = await supabase.from('aura_user_data').upsert({ user_id: session.user.id, data: snapshotForCloud(data) }, { onConflict: 'user_id' })
    if (error) throw error
  }

  if (localMode) return <PlannerApp onSignOut={() => setLocalMode(false)} />
  if (!sessionReady) return <div className="auth-screen"><div className="auth-panel"><p className="eyebrow">AURA</p><h1>Comprobando sesión…</h1></div></div>
  if (session && !snapshot && !authMessage) return <div className="auth-screen"><div className="auth-panel"><p className="eyebrow">AURA</p><h1>Cargando tu agenda…</h1></div></div>
  if (session && snapshot) return <PlannerApp key={session.user.id} snapshot={snapshot} userEmail={session.user.email} localApiKeyStorageKey={`aura-ai-settings:${session.user.id}`} onSignOut={() => { void signOut() }} onSaveSnapshot={saveSnapshot} />
  if (session && authMessage) return <div className="auth-screen"><div className="auth-panel"><p className="eyebrow">AURA · SINCRONIZACIÓN</p><h1>No se pudo cargar la cuenta</h1><p className="auth-description">{authMessage}</p><button type="button" className="auth-submit" onClick={() => setLocalMode(true)}>Continuar en este dispositivo</button><button type="button" className="auth-mode-button" onClick={() => { void signOut() }}>Cerrar sesión</button></div></div>

  return <div className="auth-screen"><section className="auth-panel"><div className="auth-brand"><span className="brand-mark">a</span><div><strong>AURA</strong><small>Tu agenda, contigo</small></div></div><p className="eyebrow">CUENTA PERSONAL</p><h1>{supabase ? authMode === 'signin' ? 'Inicia sesión' : 'Crea tu cuenta' : 'Guarda tu agenda'}</h1><p className="auth-description">{supabase ? 'Accede a tus eventos, proyectos y memorias desde tus dispositivos.' : 'Configura Supabase para activar cuentas y sincronización. También puedes continuar guardando todo en este dispositivo.'}</p>
    <button className="google-signin" type="button" disabled={authBusy} onClick={() => { void signInWithGoogle() }}><span aria-hidden="true">G</span>Continuar con Google</button>
    {supabase && <form className="auth-form" onSubmit={(event) => { void submitAuth(event) }}><label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label><label>Contraseña<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" /></label><button className="auth-submit" disabled={authBusy} type="submit">{authBusy ? 'Un momento…' : authMode === 'signin' ? 'Entrar' : 'Crear cuenta'}</button><button className="auth-mode-button" type="button" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthMessage('') }}>{authMode === 'signin' ? 'Crear una cuenta' : 'Ya tengo cuenta'}</button></form>}
    {!supabase && <button className="auth-submit" type="button" onClick={() => setLocalMode(true)}>Continuar en este dispositivo</button>}
    {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
    {supabase && <button className="auth-mode-button" type="button" onClick={() => setLocalMode(true)}>Usar solo este dispositivo</button>}
  </section></div>
}

export default App
