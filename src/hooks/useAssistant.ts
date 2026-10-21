import { useState, type Dispatch, type SetStateAction } from 'react'
import { buildAssistantContext, buildSeriesCatalog, parseAssistantResult, requestAssistant } from '../lib/assistant'
import { dateFromKey, dateKeyFromDate, defaultDateForTime, formatEventDate, hasExplicitDate, isValidDateKey, nextAvailableTime, parseLocalDateTime } from '../lib/dates'
import { buildWeeklySeries, findAvailableSlot, isValidWeeklySchedule, validateSchedule } from '../lib/schedule'
import type { AiSettings, CalendarView, ConversationMessage, EventItem, Memory, ProviderKey, ScheduleChange, ScheduleProposal } from '../types'

type AssistantParams = {
  events: EventItem[]
  setEvents: Dispatch<SetStateAction<EventItem[]>>
  memories: Memory[]
  selectedDateKey: string
  setSelectedDateKey: Dispatch<SetStateAction<string>>
  setCalendarView: Dispatch<SetStateAction<CalendarView>>
  conversation: ConversationMessage[]
  setConversation: (update: ConversationMessage[] | ((current: ConversationMessage[]) => ConversationMessage[])) => void
  setMessage: Dispatch<SetStateAction<string>>
  confirmAction: (message: string, action: () => void) => void
  showNotice: (text: string) => void
  timeZone: string
  selectedProvider: ProviderKey
  selectedModel: string
  aiSettings: AiSettings
  setScheduleProposal: Dispatch<SetStateAction<ScheduleProposal | null>>
}

// Interpreta lo que escribe la persona: comandos locales sencillos o una consulta al modelo de IA.
export function useAssistant({ events, setEvents, memories, selectedDateKey, setSelectedDateKey, setCalendarView, conversation, setConversation, setMessage, confirmAction, showNotice, timeZone, selectedProvider, selectedModel, aiSettings, setScheduleProposal }: AssistantParams) {
  const [isThinking, setIsThinking] = useState(false)
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
      const seriesCatalog = buildSeriesCatalog(events)
      const assistantContext = buildAssistantContext({ localDate, localTime, timeZone, seriesCatalog, events, memories, text })
      const data = await requestAssistant({ provider: selectedProvider, apiKey: aiSettings[selectedProvider].apiKey, model: selectedModel, messages: [...historyMessages, { role: 'user', content: assistantContext }] })
      const reply = data.reply || ''
      const result = parseAssistantResult(reply)
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
      const data = await requestAssistant({ provider: selectedProvider, apiKey: aiSettings[selectedProvider].apiKey, model: selectedModel, messages: [{ role: 'user', content: `Organiza el horario del día usando estos datos: ${JSON.stringify(context)}. Reordena solo los eventos no completados; conserva cada duración, deja intactos los completados y no crees ni elimines eventos. Prioriza los de prioridad alta y considera las preferencias. REGLA OBLIGATORIA: los eventos con flexibilityStart/end deben quedar enteros dentro de esa ventana; los que tienen flexibilityMinutes pueden moverse como máximo esa cantidad de minutos respecto a su hora; los demás son fijos. Solo puedes reorganizar dentro del día seleccionado. Devuelve exclusivamente JSON válido con esta forma: {"schedule":[{"id":1,"time":"09:00"}],"summary":"explicación breve en español"}. Incluye exactamente una entrada por cada evento pendiente y evita solapamientos.` }] }, 'No pude obtener una propuesta del modelo.')
      if (!data.reply) throw new Error(data.error || 'No pude obtener una propuesta del modelo.')
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

  return { isThinking, applyCommand, organizeSelectedDay }
}
