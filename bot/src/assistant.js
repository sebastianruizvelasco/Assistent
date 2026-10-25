// El mismo cerebro que el panel de AURA: contexto de agenda + modelo + acciones estructuradas.
// Se mantiene en paralelo a src/lib/assistant.ts y src/hooks/useAssistant.ts (ver aviso en planner.js).

import {
  buildWeeklySeries,
  dateKeyFromDate,
  defaultDateForTime,
  findAvailableSlot,
  formatEventDate,
  isValidDateKey,
  isValidWeeklySchedule,
  nextAvailableTime,
  parseLocalDateTime,
} from './planner.js'

const SYSTEM_PROMPT = 'Eres AURA, un asistente de calendario en español. Responde de forma breve y útil. Puedes sugerir cambios, pero no inventes eventos ni confirmes cambios que el usuario no haya pedido.'

const PROVIDERS = {
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions' },
  openai: { url: 'https://api.openai.com/v1/chat/completions' },
  anthropic: { url: 'https://api.anthropic.com/v1/messages' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models' },
}

// Resume cada serie recurrente (título, id y horarios por día) para que el modelo pueda editarla.
export const buildSeriesCatalog = (events) => Array.from(new Map(
  events.filter((event) => event.seriesId).map((event) => [event.seriesId, event]),
).values()).map((seriesEvent) => {
  const occurrences = events.filter((event) => event.seriesId === seriesEvent.seriesId)
  const daysByTime = new Map()
  for (const event of occurrences) {
    const days = daysByTime.get(event.time) || []
    const day = new Date(`${event.date}T00:00:00`).getDay()
    if (!days.includes(day)) days.push(day)
    daysByTime.set(event.time, days)
  }
  return {
    title: seriesEvent.title,
    seriesId: seriesEvent.seriesId,
    recurrence: seriesEvent.recurrence,
    weeklySchedule: Array.from(daysByTime.entries()).map(([time, days]) => ({ days, time })),
  }
})

// Copia literal del contexto que usa la web, para que el modelo responda igual.
export const buildAssistantContext = ({ localDate, localTime, timeZone, seriesCatalog, events, memories, text }) => `Fecha y hora local: ${localDate} ${localTime} (${timeZone}); usa fechas ISO locales y entiende DD/MM/YYYY como día/mes/año. Si agenda una tarea única, devuelve {"action":"create_event","event":{"title":"...","date":"YYYY-MM-DD o null","time":"HH:mm o null","duration":"30 min","place":"Agenda personal","category":"personal","priority":"media","flexibilityMinutes":0,"flexibilityWindow":null}}. Si pide una rutina recurrente nueva, devuelve {"action":"create_series","series":{"title":"...","startDate":"YYYY-MM-DD","duration":"30 min","place":"Agenda personal","weeklySchedule":[{"days":[1,2,3,4,5],"time":"16:00"},{"days":[0,6],"time":"07:30"}]}}. Los días son números: 0 domingo, 1 lunes, ..., 6 sábado. Interpreta “entre semana” como [1,2,3,4,5] y “fines de semana” como [0,6]; permite horas diferentes por grupo. Para editar una serie existente devuelve {"action":"edit_series","targetTitle":"título exacto del catálogo","weeklySchedule":[{"days":[...],"time":"HH:mm"}],"series":{"title":"opcional","duration":"opcional"}} y actualiza solo las ocurrencias existentes, no recrees días que se borraron. Catálogo actual de series: ${JSON.stringify(seriesCatalog)}. Si indica ventana de fecha/hora para una tarea única, conserva flexibilidadWindow y busca un hueco; no la conviertas en serie. No confirmes cambios que no apliques. Si no pide agendar ni editar, devuelve {"action":"reply","reply":"respuesta breve en español"}. Eventos próximos: ${events.slice(0, 80).map((event) => `${event.title} (${event.date} ${event.time}, ${event.duration})`).join('; ')}. Preferencias: ${memories.map((memory) => `${memory.title}: ${memory.content}`).join('; ')}. Solicitud actual: ${text}`

// Extrae el primer objeto JSON completo de la respuesta del modelo.
export const extractJsonObject = (raw) => {
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

export const parseAssistantResult = (raw) => {
  const json = extractJsonObject(raw)
  if (!json) return null
  try { return JSON.parse(json) } catch { return null }
}

const readJson = async (response) => {
  try { return await response.json() } catch { return {} }
}

const upstreamError = (data) => {
  const raw = data?.error
  if (typeof raw === 'string') return raw
  if (raw && typeof raw.message === 'string') return raw.message
  return 'El proveedor de IA no devolvió una respuesta válida.'
}

// Llama al proveedor elegido con la clave del bot y devuelve el texto de la respuesta.
export const requestAssistant = async ({ provider = 'openrouter', model, apiKey, messages, timeoutMs = 45_000 }) => {
  const config = PROVIDERS[provider]
  if (!config) throw new Error(`Proveedor de IA desconocido: ${provider}`)
  if (!apiKey) throw new Error('Falta AI_API_KEY en bot/.env.')
  const signal = AbortSignal.timeout(timeoutMs)

  let upstream
  if (provider === 'openrouter' || provider === 'openai') {
    const chatMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]
    upstream = await fetch(config.url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(provider === 'openai'
        ? { model, max_completion_tokens: 800, messages: chatMessages }
        : { model, temperature: 0.3, max_tokens: 800, messages: chatMessages }),
    })
  } else if (provider === 'anthropic') {
    upstream = await fetch(config.url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 800, system: SYSTEM_PROMPT, messages }),
    })
  } else {
    upstream = await fetch(`${config.url}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
      }),
    })
  }

  const data = await readJson(upstream)
  if (!upstream.ok || data?.error) throw new Error(upstreamError(data))
  const reply = provider === 'anthropic'
    ? data.content?.[0]?.text
    : provider === 'gemini'
      ? data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('')
      : data.choices?.[0]?.message?.content
  if (!reply) throw new Error('No pude obtener una respuesta del proveedor de IA.')
  return reply
}

const accentFor = (category) => (category === 'focus' ? 'blue' : category === 'move' ? 'green' : category === 'rest' ? 'purple' : 'coral')

// Aplica la acción que devolvió el modelo sobre la lista de eventos y explica qué hizo.
// Devuelve `changed: false` cuando solo fue una respuesta de texto.
export const applyAssistantAction = ({ result, events, now = new Date() }) => {
  if (result?.action === 'create_series' && result.series) {
    const series = result.series
    const startDate = series.startDate && isValidDateKey(series.startDate) ? series.startDate : dateKeyFromDate(now)
    const firstId = Math.max(0, ...events.map((event) => Number(event.id) || 0)) + 1
    const seriesId = `aura-series-${firstId}`
    const generated = buildWeeklySeries(seriesId, series, startDate, series.weeklySchedule || [])
    if (!generated.length) throw new Error('No pude crear la serie: revisa los días y las horas que propusiste.')
    const created = generated.map((event, index) => ({ ...event, id: firstId + index }))
    return {
      changed: true,
      events: [...events, ...created],
      reply: `Creé la serie de “${series.title}” con ${created.length} ocurrencias para el próximo año.`,
    }
  }

  if (result?.action === 'edit_series') {
    const targetTitle = result.targetTitle?.trim().toLocaleLowerCase('es')
    const target = events.find((event) => event.seriesId && event.title.toLocaleLowerCase('es') === targetTitle)
    const schedule = result.weeklySchedule || []
    if (!target || !target.seriesId) throw new Error(`No encontré una serie recurrente llamada “${result.targetTitle || ''}”.`)
    if (!isValidWeeklySchedule(schedule)) throw new Error('No pude interpretar las nuevas horas semanales de la serie.')
    const rules = new Map(schedule.flatMap((rule) => rule.days.map((day) => [day, rule.time])))
    const updated = events.map((event) => {
      if (event.seriesId !== target.seriesId) return event
      const time = rules.get(new Date(`${event.date}T00:00:00`).getDay())
      return time
        ? {
          ...event,
          time,
          title: result.series?.title?.trim() || event.title,
          duration: result.series?.duration?.trim() || event.duration,
        }
        : event
    })
    return { changed: true, events: updated, reply: `Actualicé la serie de “${target.title}” en los días y horarios indicados.` }
  }

  if (result?.action === 'create_event' && result.event) {
    const eventData = result.event
    const title = eventData.title?.trim()
    const modelTime = eventData.time?.trim()
    if (modelTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(modelTime)) throw new Error('La IA devolvió una hora no válida. Pide la hora en formato de 24 horas, por ejemplo 17:30.')
    if (!title) throw new Error('La IA detectó una solicitud de agenda pero no pudo identificar el nombre de la tarea.')

    let date
    let time
    const requestedWindow = eventData.flexibilityWindow
    if (requestedWindow) {
      const start = requestedWindow.start && parseLocalDateTime(requestedWindow.start)
      const end = requestedWindow.end && parseLocalDateTime(requestedWindow.end)
      if (!start || !end || start >= end) throw new Error('No pude interpretar la ventana de fecha y hora. Prueba con un intervalo concreto, por ejemplo “mañana entre las 15:00 y las 18:00”.')
      const slot = findAvailableSlot(events, eventData.duration || '30 min', requestedWindow.start, requestedWindow.end)
      if (!slot) throw new Error('No encontré un espacio libre con duración suficiente dentro de esa ventana.')
      date = slot.date
      time = slot.time
    } else {
      time = modelTime || nextAvailableTime(now)
      date = eventData.date && isValidDateKey(eventData.date) ? eventData.date : defaultDateForTime(time, now)
    }

    const created = {
      id: Math.max(0, ...events.map((event) => Number(event.id) || 0)) + 1,
      date,
      time,
      title,
      place: eventData.place?.trim() || 'Agenda personal',
      category: eventData.category || 'personal',
      duration: eventData.duration?.trim() || '30 min',
      accent: accentFor(eventData.category || 'personal'),
      priority: eventData.priority || 'media',
      tag: 'Discord',
    }
    return {
      changed: true,
      events: [...events, created],
      reply: `Agendé “${title}” para el ${formatEventDate(date)} a las ${time}.`,
    }
  }

  return { changed: false, events, reply: result?.reply || 'No pude interpretar la solicitud.' }
}
