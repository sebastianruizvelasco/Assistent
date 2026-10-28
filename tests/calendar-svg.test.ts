import { describe, expect, it } from 'vitest'
import { buildDaySvg, buildWeekSvg, escapeXml, longDate } from '../bot/src/calendar-svg.js'

const events = [
  { id: 1, date: '2026-10-28', time: '16:00', title: 'Pausa y paseo', place: 'Parque', duration: '45 min', category: 'rest', completed: true },
  { id: 2, date: '2026-10-28', time: '09:00', title: 'Revisión <de> producto & equipo', place: 'Sala', duration: '45 min', category: 'focus' },
]

describe('escapeXml', () => {
  it('neutraliza los caracteres que romperían el SVG', () => {
    expect(escapeXml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &apos;y&apos;&lt;/b&gt;')
  })
})

describe('buildDaySvg', () => {
  it('pinta los eventos ordenados por hora y escapa los títulos', () => {
    const svg = buildDaySvg({ dateKey: '2026-10-28', events, timeZone: 'America/Bogota' })
    expect(svg).toContain('09:00')
    expect(svg).toContain('16:00')
    expect(svg.indexOf('09:00')).toBeLessThan(svg.indexOf('16:00'))
    expect(svg).toContain('Revisión &lt;de&gt; producto &amp; equipo')
    expect(svg).not.toContain('<de>')
    expect(svg).toContain('hecho')
  })

  it('muestra un estado vacío cuando no hay eventos', () => {
    const svg = buildDaySvg({ dateKey: '2026-10-28', events: [], timeZone: 'America/Bogota' })
    expect(svg).toContain('Sin eventos')
    expect(svg).toContain('0 eventos')
  })
})

describe('buildWeekSvg', () => {
  const days = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']
    .map((key) => ({ key, isToday: key === '2026-10-28', events: key === '2026-10-28' ? [events[0]] : [] }))

  it('incluye los siete días y marca el de hoy', () => {
    const svg = buildWeekSvg({ days, timeZone: 'America/Bogota' })
    for (const label of ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']) expect(svg).toContain(label)
    expect(svg).toContain('26 de oct')
    expect(svg).toContain('1 evento')
  })

  it('resume el rango entre dos meses', () => {
    const svg = buildWeekSvg({ days, timeZone: 'America/Bogota' })
    expect(svg).toContain('26 de oct – 1 de nov')
  })
})

describe('longDate', () => {
  it('empieza en mayúscula', () => {
    expect(longDate('2026-10-28')).toMatch(/^Miércoles/)
  })
})
