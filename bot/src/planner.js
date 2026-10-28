// Copia en JavaScript de las funciones puras de src/lib/dates.ts y src/lib/schedule.ts.
// El bot no puede importar TypeScript sin extensiones, así que se mantienen aquí en paralelo:
// si cambias una regla en la web, cámbiala también aquí.

export const pad = (value) => String(value).padStart(2, '0')

export const dateKeyFromDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const dateFromKey = (key) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const isValidDateKey = (key) => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKeyFromDate(dateFromKey(key)) === key

// Acepta «YYYY-MM-DDTHH:mm» en hora local.
export const parseLocalDateTime = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  if (!isValidDateKey(value.slice(0, 10))) return null
  return new Date(`${value}:00`)
}

export const durationToMinutes = (duration = '30 min') => {
  const hours = String(duration).match(/(\d+(?:[.,]\d+)?)\s*h/)
  const minutes = String(duration).match(/(\d+(?:[.,]\d+)?)\s*min/)
  if (hours) return Number(hours[1].replace(',', '.')) * 60
  if (minutes) return Number(minutes[1].replace(',', '.'))
  return 30
}

export const formatEventDate = (key) => dateFromKey(key).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

// «30 minutos antes», «1 hora antes» → minutos. Igual que reminderToMinutes de src/lib/schedule.ts.
export const reminderToMinutes = (reminder) => {
  const match = String(reminder ?? '').match(/(\d+(?:[.,]\d+)?)\s*(minutos?|min|horas?|h)\s+antes/i)
  if (!match) return 0
  const value = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(value)) return 0
  return value * (/^(?:h|hora)/i.test(match[2]) ? 60 : 1)
}

// Misma búsqueda de hueco que la web: pasos de 15 minutos dentro de la ventana pedida.
export const findAvailableSlot = (events, duration, windowStart, windowEnd) => {
  const start = parseLocalDateTime(windowStart)
  const end = parseLocalDateTime(windowEnd)
  if (!start || !end || start >= end) return null
  const durationMs = durationToMinutes(duration) * 60_000
  for (let timestamp = start.getTime(); timestamp + durationMs <= end.getTime(); timestamp += 15 * 60_000) {
    const candidate = new Date(timestamp)
    const date = dateKeyFromDate(candidate)
    const time = `${pad(candidate.getHours())}:${pad(candidate.getMinutes())}`
    const conflicts = events.some((event) => {
      if (event.date !== date) return false
      const [hour, minute] = String(event.time).split(':').map(Number)
      const eventStart = dateFromKey(event.date)
      eventStart.setHours(hour, minute, 0, 0)
      const eventEnd = eventStart.getTime() + durationToMinutes(event.duration) * 60_000
      return timestamp < eventEnd && eventStart.getTime() < timestamp + durationMs
    })
    if (!conflicts) return { date, time }
  }
  return null
}

export const isValidWeeklySchedule = (schedule) => Array.isArray(schedule)
  && schedule.length > 0
  && !schedule.some((rule) => !Array.isArray(rule.days)
    || !rule.days.length
    || rule.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.time))

// Genera un año de ocurrencias para cada regla semanal (días 0 = domingo … 6 = sábado).
export const buildWeeklySeries = (seriesId, series, startDate, schedule) => {
  const title = series?.title?.trim()
  if (!title || !isValidDateKey(startDate) || !isValidWeeklySchedule(schedule)) return []
  const duration = series.duration?.trim() || '30 min'
  const place = series.place?.trim() || 'Agenda personal'
  const firstDate = dateFromKey(startDate)
  const occurrences = []
  for (let dayOffset = 0; dayOffset < 366; dayOffset += 1) {
    const date = new Date(firstDate)
    date.setDate(firstDate.getDate() + dayOffset)
    const rule = schedule.find((item) => item.days.includes(date.getDay()))
    if (!rule) continue
    occurrences.push({
      id: 0,
      date: dateKeyFromDate(date),
      time: rule.time,
      title,
      place,
      category: 'focus',
      duration,
      accent: 'blue',
      recurrence: 'Cada semana',
      seriesId,
      priority: 'media',
      tag: 'Trabajo',
    })
  }
  return occurrences
}

// Si no se indica fecha: hoy cuando la hora aún no pasó, mañana cuando ya pasó.
export const defaultDateForTime = (time, now = new Date()) => {
  const [hour, minute] = String(time).split(':').map(Number)
  const scheduled = new Date(now)
  scheduled.setHours(hour, minute, 0, 0)
  if (scheduled.getTime() <= now.getTime()) scheduled.setDate(scheduled.getDate() + 1)
  return dateKeyFromDate(scheduled)
}

export const nextAvailableTime = (now = new Date()) => {
  const nextSlot = new Date(now)
  nextSlot.setMinutes(Math.ceil((now.getMinutes() + 15) / 15) * 15, 0, 0)
  return `${pad(nextSlot.getHours())}:${pad(nextSlot.getMinutes())}`
}
