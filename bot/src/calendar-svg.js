// Generación del SVG del calendario. Sin dependencias: el rasterizado vive en calendar-image.js,
// así esta parte se puede probar sin binarios nativos.

const COLORS = {
  background: '#11121b',
  panel: '#1a1c27',
  text: '#f4f5fb',
  muted: '#9aa0b4',
  faint: '#5f6579',
  accent: '#7b7bff',
  focus: '#6d8bff',
  move: '#3ec98a',
  rest: '#b07dff',
  personal: '#ff8a70',
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DAY_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

export const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const colorFor = (category) => COLORS[category] || COLORS.personal

const dateFromKey = (key) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

export const longDate = (key) => {
  const date = dateFromKey(key)
  return capitalize(`${DAY_NAMES[date.getDay()]}, ${date.getDate()} de ${date.toLocaleDateString('es-CO', { month: 'long' })}`)
}

export const shortDate = (key) => {
  const date = dateFromKey(key)
  return { weekday: DAY_SHORT[date.getDay()], day: String(date.getDate()), month: date.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '') }
}

// Recorta por caracteres: en SVG no hay salto de línea automático.
const clip = (text, max) => {
  const value = String(text ?? '')
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value
}

const frame = (width, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="aura" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7b7bff"/>
      <stop offset="100%" stop-color="#4ad6b8"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${COLORS.background}"/>
  ${body}
</svg>`

const header = (width, title, subtitle) => `
  <text x="64" y="92" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="18" font-weight="600" fill="${COLORS.accent}" letter-spacing="4">AURA</text>
  <text x="64" y="150" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="46" font-weight="700" fill="${COLORS.text}">${escapeXml(title)}</text>
  <text x="64" y="190" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="20" fill="${COLORS.muted}">${escapeXml(subtitle)}</text>
  <rect x="64" y="214" width="${width - 128}" height="2" fill="${COLORS.panel}"/>`

const footer = (width, height, text) => `
  <text x="64" y="${height - 40}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="16" fill="${COLORS.faint}">${escapeXml(text)}</text>
  <rect x="${width - 200}" y="${height - 54}" width="136" height="6" rx="3" fill="url(#aura)"/>`

// Vista de un día: una fila por evento con su hora destacada y una barra de color por categoría.
export const buildDaySvg = ({ dateKey, events, timeZone }) => {
  const width = 1200
  const sorted = [...events].sort((a, b) => String(a.time).localeCompare(String(b.time)))
  const rowHeight = 96
  const height = Math.max(760, 300 + sorted.length * rowHeight + 90)
  const rows = sorted.map((event, index) => {
    const y = 270 + index * rowHeight
    const accent = colorFor(event.category)
    const meta = [event.duration, event.place && event.place !== 'Agenda personal' ? event.place : ''].filter(Boolean).join(' · ')
    return `
    <g>
      <rect x="64" y="${y}" width="${width - 128}" height="${rowHeight - 14}" rx="18" fill="${COLORS.panel}"/>
      <rect x="64" y="${y}" width="8" height="${rowHeight - 14}" rx="4" fill="${accent}"/>
      <text x="104" y="${y + 52}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="${COLORS.text}">${escapeXml(event.time || '--:--')}</text>
      <text x="248" y="${y + 44}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="28" font-weight="600" fill="${COLORS.text}">${escapeXml(clip(event.title, 46))}</text>
      <text x="248" y="${y + 70}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="18" fill="${COLORS.muted}">${escapeXml(clip(meta, 70))}</text>
      ${event.completed ? `<text x="${width - 104}" y="${y + 52}" text-anchor="end" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="18" fill="${COLORS.move}">hecho</text>` : ''}
    </g>`
  }).join('')

  const empty = `
    <rect x="64" y="270" width="${width - 128}" height="220" rx="18" fill="${COLORS.panel}"/>
    <text x="${width / 2}" y="370" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="28" font-weight="600" fill="${COLORS.muted}">Sin eventos</text>
    <text x="${width / 2}" y="408" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="18" fill="${COLORS.faint}">El día está libre.</text>`

  return frame(width, height, [
    header(width, longDate(dateKey), `${events.length} evento${events.length === 1 ? '' : 's'}${timeZone ? ` · ${timeZone}` : ''}`),
    sorted.length ? rows : empty,
    footer(width, height, 'Generado por AURA · Discord'),
  ].join(''))
}

// Vista de semana: siete columnas con los eventos de cada día.
export const buildWeekSvg = ({ days, timeZone }) => {
  const width = 1500
  const height = 940
  const columnWidth = (width - 128 - 6 * 16) / 7
  const todayKey = days.find((day) => day.isToday)?.key

  const columns = days.map((day, index) => {
    const x = 64 + index * (columnWidth + 16)
    const { weekday, day: dayNumber } = shortDate(day.key)
    const isToday = day.key === todayKey
    const events = [...day.events].sort((a, b) => String(a.time).localeCompare(String(b.time)))
    const visible = events.slice(0, 7)
    const rows = visible.map((event, rowIndex) => {
      const y = 360 + rowIndex * 68
      return `
      <g>
        <rect x="${x + 10}" y="${y}" width="${columnWidth - 20}" height="56" rx="10" fill="${COLORS.panel}"/>
        <rect x="${x + 10}" y="${y}" width="5" height="56" rx="2.5" fill="${colorFor(event.category)}"/>
        <text x="${x + 26}" y="${y + 22}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="16" font-weight="700" fill="${COLORS.text}">${escapeXml(event.time)}</text>
        <text x="${x + 26}" y="${y + 44}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="15" fill="${COLORS.muted}">${escapeXml(clip(event.title, 18))}</text>
      </g>`
    }).join('')
    const more = events.length > visible.length
      ? `<text x="${x + 20}" y="${360 + visible.length * 68 + 18}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="15" fill="${COLORS.faint}">+${events.length - visible.length} más</text>`
      : ''
    return `
    <g>
      <rect x="${x}" y="250" width="${columnWidth}" height="${height - 340}" rx="20" fill="${isToday ? '#20233a' : '#161824'}" stroke="${isToday ? COLORS.accent : 'transparent'}" stroke-width="2"/>
      <text x="${x + columnWidth / 2}" y="300" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="${isToday ? COLORS.accent : COLORS.faint}" letter-spacing="2">${weekday}</text>
      <text x="${x + columnWidth / 2}" y="342" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="${isToday ? COLORS.text : COLORS.muted}">${dayNumber}</text>
      ${rows}${more}
      ${events.length === 0 ? `<text x="${x + columnWidth / 2}" y="400" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="15" fill="${COLORS.faint}">libre</text>` : ''}
    </g>`
  }).join('')

  const total = days.reduce((sum, day) => sum + day.events.length, 0)
  const first = shortDate(days[0].key)
  const last = shortDate(days[days.length - 1].key)
  const range = first.month === last.month
    ? `${first.day} – ${last.day} de ${first.month}`
    : `${first.day} de ${first.month} – ${last.day} de ${last.month}`
  return frame(width, height, [
    header(width, range, `${total} evento${total === 1 ? '' : 's'}${timeZone ? ` · ${timeZone}` : ''}`),
    columns,
    footer(width, height, 'Generado por AURA · Discord'),
  ].join(''))
}
