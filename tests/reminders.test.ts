import { describe, expect, it } from 'vitest'
import { findDueReminders, reminderKey, reminderMessage } from '../bot/src/reminders.js'

const event = (overrides = {}) => ({
  id: 1,
  date: '2026-10-28',
  time: '16:00',
  title: 'Reunión de equipo',
  place: 'Sala Nube',
  duration: '30 min',
  reminder: '30 minutos antes',
  ...overrides,
})

const at = (iso) => new Date(iso)

describe('findDueReminders', () => {
  it('avisa cuando llega la hora del recordatorio', () => {
    const due = findDueReminders([event()], { now: at('2026-10-28T15:30:00') })
    expect(due).toHaveLength(1)
    expect(due[0].minutesBefore).toBe(30)
    expect(due[0].key).toBe('1:2026-10-28T16:00')
  })

  it('no avisa antes de tiempo', () => {
    expect(findDueReminders([event()], { now: at('2026-10-28T15:20:00') })).toHaveLength(0)
  })

  it('no avisa si llega tarde (bot apagado)', () => {
    expect(findDueReminders([event()], { now: at('2026-10-28T16:30:00') })).toHaveLength(0)
  })

  it('no repite lo que ya se envió', () => {
    const due = findDueReminders([event()], { now: at('2026-10-28T15:30:00'), alreadySent: new Set([reminderKey(event())]) })
    expect(due).toHaveLength(0)
  })

  it('ignora eventos sin recordatorio o completados', () => {
    expect(findDueReminders([event({ reminder: 'Sin recordatorio' })], { now: at('2026-10-28T15:30:00') })).toHaveLength(0)
    expect(findDueReminders([event({ completed: true })], { now: at('2026-10-28T15:30:00') })).toHaveLength(0)
  })

  it('entiende recordatorios en horas', () => {
    const due = findDueReminders([event({ reminder: '2 horas antes' })], { now: at('2026-10-28T14:00:00') })
    expect(due).toHaveLength(1)
    expect(due[0].minutesBefore).toBe(120)
  })
})

describe('reminderMessage', () => {
  it('resume el aviso con la hora y el lugar', () => {
    const [due] = findDueReminders([event()], { now: at('2026-10-28T15:30:00') })
    const message = reminderMessage(due)
    expect(message.title).toContain('Reunión de equipo')
    expect(message.body).toContain('30 minutos')
    expect(message.body).toContain('Sala Nube')
    expect(message.tag).toBe('1:2026-10-28T16:00')
  })

  it('usa horas cuando son exactas', () => {
    const [due] = findDueReminders([event({ reminder: '1 hora antes' })], { now: at('2026-10-28T15:00:00') })
    expect(reminderMessage(due).body).toContain('1 hora')
  })
})
