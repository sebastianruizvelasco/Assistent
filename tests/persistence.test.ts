import { describe, expect, it } from 'vitest'
import { eventsToIcs } from '../src/lib/ics'
import { normalizeSnapshot } from '../src/lib/validate'
import { mergeSnapshots } from '../src/lib/snapshot-merge'

const event = {
  id: 1,
  date: '2026-10-28',
  time: '16:30',
  title: 'Reunión, con; acentos',
  place: 'Sala Nube',
  category: 'focus' as const,
  duration: '45 min',
  accent: 'blue',
  reminder: '30 minutos antes',
}

describe('eventsToIcs', () => {
  it('genera un VCALENDAR con el evento y hora local', () => {
    const ics = eventsToIcs([event], { now: new Date('2026-10-28T12:00:00Z') })
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('DTSTART:20261028T163000')
    expect(ics).toContain('DTEND:20261028T171500')
    expect(ics).toContain('SUMMARY:Reunión\\, con\\; acentos')
    expect(ics).toContain('LOCATION:Sala Nube')
  })

  it('usa saltos de línea CRLF, como exige el formato', () => {
    const ics = eventsToIcs([event])
    expect(ics).toContain('\r\n')
    expect(ics.split('\r\n').every((line) => !line.includes('\n'))).toBe(true)
  })

  it('ordena por fecha y hora', () => {
    const later = { ...event, id: 2, time: '18:00' }
    const ics = eventsToIcs([later, event])
    expect(ics.indexOf('T163000')).toBeLessThan(ics.indexOf('T180000'))
  })
})

describe('normalizeSnapshot', () => {
  it('descarta eventos sin fecha u hora válidas', () => {
    const snapshot = normalizeSnapshot({
      events: [
        { id: 1, date: '2026-10-28', time: '09:00', title: 'Válido' },
        { id: 2, date: '28/10/2026', time: '09:00', title: 'Fecha mala' },
        { id: 3, date: '2026-10-28', time: '25:00', title: 'Hora mala' },
        { id: 4, date: '2026-10-28', time: '10:00', title: '' },
      ],
    })
    expect(snapshot?.events?.map((item) => item.title)).toEqual(['Válido'])
  })

  it('reasigna ids repetidos para no romper las listas de React', () => {
    const snapshot = normalizeSnapshot({
      events: [
        { id: 7, date: '2026-10-28', time: '09:00', title: 'A' },
        { id: 7, date: '2026-10-28', time: '10:00', title: 'B' },
      ],
    })
    expect(snapshot?.events?.[0]?.id).not.toBe(snapshot?.events?.[1]?.id)
  })

  it('devuelve null si no es un objeto', () => {
    expect(normalizeSnapshot('texto')).toBeNull()
    expect(normalizeSnapshot(null)).toBeNull()
  })
})

describe('mergeSnapshots', () => {
  it('conserva los eventos que solo existen en la nube (los del bot)', () => {
    const local = { events: [{ ...event, id: 1, title: 'Local' }] }
    const remote = { events: [{ ...event, id: 9, title: 'Del bot' }] }
    const merged = mergeSnapshots(local, remote)
    expect(merged.events?.map((item) => item.title).sort()).toEqual(['Del bot', 'Local'])
  })

  it('el cliente gana cuando el mismo id está en los dos lados', () => {
    const local = { events: [{ ...event, id: 1, title: 'Editado aquí' }] }
    const remote = { events: [{ ...event, id: 1, title: 'Viejo' }] }
    expect(mergeSnapshots(local, remote).events?.[0]?.title).toBe('Editado aquí')
  })
})
