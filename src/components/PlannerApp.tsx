import { useEffect, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent } from 'react'
import { AddEventModal } from './AddEventModal'
import { AssistantPanel } from './AssistantPanel'
import { CalendarBody } from './CalendarBody'
import { CalendarHeader } from './CalendarHeader'
import { ProductivityPanel } from './ProductivityPanel'
import { SectionHub } from './SectionHub'
import { Topbar } from './Topbar'
import { availableModels, providerModels } from '../constants'
import { useAssistant } from '../hooks/useAssistant'
import { useGoogleCalendar } from '../hooks/useGoogleCalendar'
import { useClock } from '../hooks/useClock'
import { useCloudSync } from '../hooks/useCloudSync'
import { useLocalPersistence } from '../hooks/useLocalPersistence'
import { useNotice } from '../hooks/useNotice'
import { useReminders } from '../hooks/useReminders'
import { useWeather } from '../hooks/useWeather'
import { buildInitialEvents, initialMemories, initialProjects } from '../initialData'
import { dateFromKey, dateKeyFromDate, defaultDateForTime, formatDateLabel, formatEventDate, nextAvailableTime, parseLocalDateTime, shiftLocalDateTime, startOfWeek, todayDateKey } from '../lib/dates'
import { durationToMinutes, findAvailableSlot, validateSchedule } from '../lib/schedule'
import { mergeAiSettings, readStored, snapshotForCloud } from '../lib/snapshot'
import type { AiSettings, AppSnapshot, CalendarView, ConversationMessage, ConversationSession, EventItem, Memory, Project, ScheduleChange } from '../types'

export function PlannerApp({ snapshot, userEmail, onSignOut, onSaveSnapshot, localApiKeyStorageKey }: { snapshot?: AppSnapshot; userEmail?: string; onSignOut?: () => void; onSaveSnapshot?: (data: AppSnapshot) => Promise<void>; localApiKeyStorageKey?: string }) {
  const aiSettingsStorageKey = localApiKeyStorageKey || 'aura-ai-settings'
  const [events, setEvents] = useState<EventItem[]>(() => snapshot?.events || readStored('aura-events', buildInitialEvents()))
  const [message, setMessage] = useState('')
  const [activeSection, setActiveSection] = useState('Mi día')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [selectedDateKey, setSelectedDateKey] = useState(() => snapshot?.selectedDateKey || todayDateKey())
  const [calendarView, setCalendarView] = useState<CalendarView>(() => snapshot?.calendarView || 'day')
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
  const [pendingMessage, setPendingMessage] = useState('')
  const { localTime, timeZone } = useClock()
  const { temperature, city } = useWeather()
  const { notice, showNotice } = useNotice()
  useLocalPersistence({ events, projects, memories, aiSettings, aiSettingsStorageKey, conversationSessions, activeConversationId })
  useCloudSync({ events, projects, memories, aiSettings, conversationSessions, activeConversationId, darkMode, selectedDateKey, calendarView }, onSaveSnapshot, showNotice)
  useReminders(events)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateFromDevice = (event: MediaQueryListEvent) => { if (!localStorage.getItem('aura-theme')) setDarkMode(event.matches) }
    mediaQuery.addEventListener('change', updateFromDevice)
    return () => mediaQuery.removeEventListener('change', updateFromDevice)
  }, [])

  const persistBeforeSignOut = async () => {
    if (!onSaveSnapshot) { onSignOut?.(); return }
    try {
      await onSaveSnapshot(snapshotForCloud({ events, projects, memories, aiSettings, conversationSessions, activeConversationId, darkMode, selectedDateKey, calendarView }))
      onSignOut?.()
    } catch {
      showNotice('No pude guardar los últimos cambios; mantuve la sesión abierta para reintentar.')
    }
  }

  const confirmAction = (message: string, action: () => void) => {
    setPendingAction(() => action)
    setPendingMessage(message)
    showNotice(message)
  }

  const google = useGoogleCalendar({ events, setEvents, showNotice, confirmAction, timeZone })

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
    setEvents((current) => [...current, { ...event, id: duplicateId, title: `${event.title} (copia)`, google: undefined }])
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

  const { isThinking, applyCommand, organizeSelectedDay } = useAssistant({ events, setEvents, memories, selectedDateKey, setSelectedDateKey, setCalendarView, conversation, setConversation, setMessage, confirmAction, showNotice, timeZone, selectedProvider, selectedModel, aiSettings, setScheduleProposal })

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
      <Topbar google={google} activeSection={activeSection} setActiveSection={setActiveSection} showNotice={showNotice} searchOpen={searchOpen} search={search} setSearch={setSearch} setSearchOpen={setSearchOpen} darkMode={darkMode} toggleTheme={toggleTheme} setProfileOpen={setProfileOpen} profileOpen={profileOpen} userEmail={userEmail} onSignOut={onSignOut} persistBeforeSignOut={persistBeforeSignOut} />

      <div className="workspace">
        {activeSection !== 'Mi día' && <SectionHub activeSection={activeSection} setProjectFormOpen={setProjectFormOpen} projects={projects} projectFormOpen={projectFormOpen} addProject={addProject} setMemoryFormOpen={setMemoryFormOpen} memories={memories} memoryFormOpen={memoryFormOpen} addMemory={addMemory} />}
        <section className={`agenda-column ${activeSection !== 'Mi día' ? 'section-hidden' : ''}`}>
          <CalendarHeader setSelectedDateKey={setSelectedDateKey} setNewEventDate={setNewEventDate} showNotice={showNotice} changeCalendarDate={changeCalendarDate} selectedDate={selectedDate} calendarView={calendarView} selectedDateObject={selectedDateObject} setDateMenuOpen={setDateMenuOpen} dateMenuOpen={dateMenuOpen} setCalendarView={setCalendarView} localTime={localTime} timeZone={timeZone} temperature={temperature} city={city} events={events} openAddEvent={openAddEvent} />
          <CalendarBody setEvents={setEvents} conflictIds={conflictIds} editingEventId={editingEventId} setDraggedId={setDraggedId} moveEvent={moveEvent} toggleComplete={toggleComplete} setEditingEventId={setEditingEventId} setEventMenuId={setEventMenuId} eventMenuId={eventMenuId} openEditEvent={openEditEvent} duplicateEvent={duplicateEvent} removeEvent={removeEvent} removeEventSeries={removeEventSeries} visibleEvents={visibleEvents} selectedDateKey={selectedDateKey} selectedDateObject={selectedDateObject} dragSelection={dragSelection} currentHour={currentHour} beginTimeSelection={beginTimeSelection} updateTimeSelection={updateTimeSelection} finishTimeSelection={finishTimeSelection} moveEventToTime={moveEventToTime} currentMinute={currentMinute} openAddEvent={openAddEvent} weekDays={weekDays} setSelectedDateKey={setSelectedDateKey} setCalendarView={setCalendarView} monthCells={monthCells} monthDays={monthDays} calendarView={calendarView} />
        </section>
        <ProductivityPanel activeSection={activeSection} completedCount={completedCount} selectedDayEvents={selectedDayEvents} totalMinutes={totalMinutes} conflictIds={conflictIds} priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter} setShowCompleted={setShowCompleted} showCompleted={showCompleted} isThinking={isThinking} organizeSelectedDay={organizeSelectedDay} events={events} openEditEvent={openEditEvent} removeEvent={removeEvent} />

        <AssistantPanel activeSection={activeSection} selectedProvider={selectedProvider} handleProviderChange={handleProviderChange} setAiSettingsOpen={setAiSettingsOpen} selectedModel={selectedModel} setSelectedModel={setSelectedModel} setAiSettings={setAiSettings} aiSettingsOpen={aiSettingsOpen} aiSettings={aiSettings} updateAiSetting={updateAiSetting} showNotice={showNotice} scheduleProposal={scheduleProposal} events={events} setScheduleProposal={setScheduleProposal} selectedDateKey={selectedDateKey} applyScheduleProposal={applyScheduleProposal} conversation={conversation} isThinking={isThinking} applyCommand={applyCommand} activeConversationId={activeConversationId} setActiveConversationId={setActiveConversationId} conversationSessions={conversationSessions} duplicateCurrentConversation={duplicateCurrentConversation} startNewConversation={startNewConversation} message={message} setMessage={setMessage} voiceActive={voiceActive} toggleVoice={toggleVoice} />
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
      {pendingAction && <div className="confirm-bar" role="alert"><span>{pendingMessage || '¿Quieres continuar?'}</span><button onClick={() => { pendingAction(); setPendingAction(null); setPendingMessage('') }}>Confirmar</button><button onClick={() => { setPendingAction(null); setPendingMessage('') }}>Cancelar</button></div>}
      <AddEventModal addEventOpen={addEventOpen} setAddEventOpen={setAddEventOpen} addEvent={addEvent} formEventId={formEventId} events={events} newEventDate={newEventDate} newEventTime={newEventTime} newEventDuration={newEventDuration} flexibilityMode={flexibilityMode} setFlexibilityMode={setFlexibilityMode} reminderCustomEnabled={reminderCustomEnabled} setReminderCustomEnabled={setReminderCustomEnabled} requestNotifications={requestNotifications} />
      <footer><span>Planificado con intención</span><span>Última sincronización: ahora</span></footer>
    </main>
  )
}
