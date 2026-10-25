// Fechas y texto en la zona horaria del proceso (TZ del .env). Sin dependencias.

export const pad = (value) => String(value).padStart(2, '0')

// Clave de fecha local «YYYY-MM-DD», igual que la usa AURA en el navegador.
export const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const parseDateKey = (key) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const addDays = (key, days) => {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

export const todayKey = () => dateKey(new Date())

export const isDateKey = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateKey(value).getTime())

// «hoy», «mañana», «pasado mañana», «25/10», «2026-10-25» → clave de fecha.
export const resolveDate = (input, fallback = todayKey()) => {
  if (!input) return fallback
  const text = input.trim().toLowerCase()
  if (text === 'hoy' || text === 'today') return todayKey()
  if (text === 'mañana' || text === 'manana' || text === 'tomorrow') return addDays(todayKey(), 1)
  if (text === 'pasado mañana' || text === 'pasado manana') return addDays(todayKey(), 2)
  if (text === 'ayer' || text === 'yesterday') return addDays(todayKey(), -1)
  if (isDateKey(text)) return text
  const short = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/)
  if (short) {
    const day = Number(short[1])
    const month = Number(short[2])
    const currentYear = new Date().getFullYear()
    const year = short[3] ? Number(short[3].length === 2 ? `20${short[3]}` : short[3]) : currentYear
    const candidate = `${year}-${pad(month)}-${pad(day)}`
    return isDateKey(candidate) ? candidate : fallback
  }
  return null
}

const longDate = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
const shortDate = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })

export const humanDate = (key) => longDate.format(parseDateKey(key))
export const shortHumanDate = (key) => shortDate.format(parseDateKey(key))

// «30 min», «1 h», «1.5 h», «45» → duración en el formato que guarda AURA.
export const normalizeDuration = (input) => {
  if (!input) return '30 min'
  const text = String(input).trim().toLowerCase().replace(',', '.')
  const hours = text.match(/^([\d.]+)\s*(h|hora|horas)$/)
  if (hours) return `${Math.round(Number(hours[1]) * 60)} min`
  const minutes = text.match(/^(\d+)\s*(m|min|minutos?)?$/)
  if (minutes) return `${Number(minutes[1])} min`
  return null
}

// «16», «16:30», «9.30» → «HH:mm»; null si no es una hora válida.
export const normalizeTime = (input) => {
  if (!input) return null
  const match = String(input).trim().match(/^(\d{1,2})(?:[:.](\d{2}))?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  if (hours > 23 || minutes > 59) return null
  return `${pad(hours)}:${pad(minutes)}`
}

// Normaliza para comparar títulos sin acentos ni mayúsculas.
export const normalizeText = (value) => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const findEventsByTitle = (events, query) => {
  const text = normalizeText(query)
  if (!text) return []
  const exact = events.filter((event) => normalizeText(event.title) === text)
  if (exact.length) return exact
  const partial = events.filter((event) => normalizeText(event.title).includes(text))
  if (partial.length) return partial
  const words = text.split(' ').filter((word) => word.length > 2)
  return events.filter((event) => {
    const title = normalizeText(event.title)
    return words.length > 0 && words.every((word) => title.includes(word))
  })
}
