import { dateFromKey } from './dates'
import type { AiSettings, AssistantResult, EventItem, Memory, Project, ProviderKey } from '../types'

export type AssistantRequest = {
  provider: ProviderKey
  apiKey: AiSettings[ProviderKey]['apiKey']
  model: string
  messages: Array<{ role: string; content: string }>
}

// Resume cada serie recurrente (título, id y horarios por día) para que el modelo pueda editarla.
export const buildSeriesCatalog = (events: EventItem[]) => Array.from(new Map(events.filter((event) => event.seriesId).map((event) => [event.seriesId!, event])).values()).map((seriesEvent) => {
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

type AssistantContextInput = {
  localDate: string
  localTime: string
  timeZone: string
  seriesCatalog: ReturnType<typeof buildSeriesCatalog>
  events: EventItem[]
  memories: Memory[]
  projects?: Project[]
  text: string
}

// Instrucciones + contexto de agenda que se envían al modelo junto con la solicitud.
export const buildAssistantContext = ({ localDate, localTime, timeZone, seriesCatalog, events, memories, projects = [], text }: AssistantContextInput) => {
  // Solo lo que viene a partir de hoy y en orden: antes se mandaban los primeros del array, que
  // podían ser eventos viejos y dejar fuera los próximos.
  const upcoming = [...events]
    .filter((event) => event.date >= localDate)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 80)
  const projectList = projects.length
    ? projects.map((project) => `${project.name} (${project.progress}%${project.due ? `, entrega ${project.due}` : ''}): ${project.description}`).join('; ')
    : 'ninguno'

  return `Fecha y hora local: ${localDate} ${localTime} (${timeZone}); usa fechas ISO locales y entiende DD/MM/YYYY como día/mes/año. Si agenda una tarea única, devuelve {"action":"create_event","event":{"title":"...","date":"YYYY-MM-DD o null","time":"HH:mm o null","duration":"30 min","place":"Agenda personal","category":"personal","priority":"media","flexibilityMinutes":0,"flexibilityWindow":null}}. Si pide una rutina recurrente nueva, devuelve {"action":"create_series","series":{"title":"...","startDate":"YYYY-MM-DD","duration":"30 min","place":"Agenda personal","weeklySchedule":[{"days":[1,2,3,4,5],"time":"16:00"},{"days":[0,6],"time":"07:30"}]}}. Los días son números: 0 domingo, 1 lunes, ..., 6 sábado. Interpreta “entre semana” como [1,2,3,4,5] y “fines de semana” como [0,6]; permite horas diferentes por grupo. Para editar una serie existente devuelve {"action":"edit_series","targetTitle":"título exacto del catálogo","weeklySchedule":[{"days":[...],"time":"HH:mm"}],"series":{"title":"opcional","duration":"opcional"}} y actualiza solo las ocurrencias existentes, no recrees días que se borraron. Catálogo actual de series: ${JSON.stringify(seriesCatalog)}. Si pide un proyecto nuevo devuelve {"action":"create_project","project":{"name":"...","description":"...","due":"YYYY-MM-DD o vacío","color":"blue|green|yellow|coral|purple","progress":0}}. Si pide cambiar el avance, el nombre o la fecha de un proyecto existente devuelve {"action":"update_project","targetProject":"nombre exacto del catálogo de proyectos","project":{"progress":60}} (incluye solo lo que cambie). Si pide que recuerdes algo de forma permanente (preferencias, rutinas, personas), devuelve {"action":"save_memory","memory":{"title":"...","content":"...","category":"Preferencias|Contexto|Rutinas|Personas|Trabajo|Ideas|General"}}. Si indica ventana de fecha/hora para una tarea única, conserva flexibilidadWindow y busca un hueco; no la conviertas en serie. No confirmes cambios que no apliques. Si no pide agendar, editar, crear proyectos ni recordar nada, devuelve {"action":"reply","reply":"respuesta breve en español"}. Eventos próximos: ${upcoming.map((event) => `${event.title} (${event.date} ${event.time}, ${event.duration})`).join('; ')}. Proyectos: ${projectList}. Preferencias: ${memories.map((memory) => `${memory.title}: ${memory.content}`).join('; ')}. Solicitud actual: ${text}`
}

// Llama al proxy /api/assistant y devuelve su respuesta; lanza un Error si el proxy falla.
export const requestAssistant = async (request: AssistantRequest, fallbackError = 'No pude obtener una respuesta del asistente.') => {
  const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  const data = await response.json() as { reply?: string; error?: string }
  if (!response.ok) throw new Error(data.error || fallbackError)
  return data
}

// Extrae el primer objeto JSON completo de una respuesta, aunque el modelo lo envuelva en texto.
// Se cuenta la profundidad de llaves para no cortar el JSON en el primer `}` de un valor anidado
// (el `lastIndexOf('}')` anterior rompía cuando la respuesta incluía varias acciones o texto extra).
export const extractJsonObject = (raw: string): string | null => {
  const start = raw.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return raw.slice(start, index + 1)
    }
  }
  return null
}

// Parsea un JSON que el modelo devuelve dentro de su texto; null si no hay nada válido.
export const parseJsonPayload = <T,>(raw: string): T | null => {
  const json = extractJsonObject(raw)
  if (!json) return null
  try { return JSON.parse(json) as T } catch { return null }
}

// Extrae el objeto JSON de acción que el modelo incluye en su respuesta (o null si no hay).
export const parseAssistantResult = (reply: string): AssistantResult | null => parseJsonPayload<AssistantResult>(reply)
