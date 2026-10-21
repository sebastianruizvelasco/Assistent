

export const todayDateKey = () => dateKeyFromDate(new Date())
export const dateKeyFromDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const dateFromKey = (key: string) => { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day) }
export const isValidDateKey = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKeyFromDate(dateFromKey(key)) === key
export const formatDateLabel = (key: string) => dateFromKey(key).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
export const formatEventDate = (key: string) => dateFromKey(key).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
export const parseLocalDateTime = (value: string) => /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && isValidDateKey(value.slice(0, 10)) ? new Date(`${value}:00`) : null
export const shiftLocalDateTime = (value: string | undefined, dayOffset: number) => {
  if (!value) return undefined
  const date = parseLocalDateTime(value)
  if (!date) return value
  date.setDate(date.getDate() + dayOffset)
  return `${dateKeyFromDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
export const hasExplicitDate = (text: string) => /\b(?:hoy|mañana|pasado mañana|esta tarde|esta noche|este fin de semana|próxima semana|la próxima semana|lunes|martes|miércoles|jueves|viernes|sábado|domingo|20\d{2}-\d{2}-\d{2}|\d{1,2} de enero|\d{1,2} de febrero|\d{1,2} de marzo|\d{1,2} de abril|\d{1,2} de mayo|\d{1,2} de junio|\d{1,2} de julio|\d{1,2} de agosto|\d{1,2} de septiembre|\d{1,2} de octubre|\d{1,2} de noviembre|\d{1,2} de diciembre)\b/i.test(text)
export const defaultDateForTime = (time: string, now = new Date()) => {
  const [hour, minute] = time.split(':').map(Number)
  const scheduled = new Date(now)
  scheduled.setHours(hour, minute, 0, 0)
  if (scheduled.getTime() <= now.getTime()) scheduled.setDate(scheduled.getDate() + 1)
  return dateKeyFromDate(scheduled)
}
export const nextAvailableTime = (now = new Date()) => {
  const nextSlot = new Date(now)
  nextSlot.setMinutes(Math.ceil((now.getMinutes() + 15) / 15) * 15, 0, 0)
  return `${String(nextSlot.getHours()).padStart(2, '0')}:${String(nextSlot.getMinutes()).padStart(2, '0')}`
}
export const startOfWeek = (date: Date) => { const copy = new Date(date); const day = copy.getDay(); copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1)); return copy }
export const formatLocalTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
