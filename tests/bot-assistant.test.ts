import { describe, expect, it } from 'vitest'
import { applyAssistantAction, parseAssistantResult } from '../bot/src/assistant.js'

const now = new Date('2026-10-28T10:00:00')

describe('applyAssistantAction', () => {
  it('crea un evento con fecha y hora del modelo', () => {
    const result = applyAssistantAction({
      result: { action: 'create_event', event: { title: 'Pagar la luz', date: '2026-10-29', time: '18:00' } },
      events: [],
      now,
    })
    expect(result.changed).toBe(true)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({ title: 'Pagar la luz', date: '2026-10-29', time: '18:00', tag: 'Discord' })
  })

  it('si no hay hora usa la próxima en punto y una fecha coherente', () => {
    const result = applyAssistantAction({ result: { action: 'create_event', event: { title: 'Llamar' } }, events: [], now })
    expect(result.changed).toBe(true)
    expect(result.events[0].time).toMatch(/^\d{2}:\d{2}$/)
    expect(result.events[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('rechaza una hora inválida del modelo', () => {
    expect(() => applyAssistantAction({
      result: { action: 'create_event', event: { title: 'X', time: '25:99' } },
      events: [],
      now,
    })).toThrow(/hora no válida/i)
  })

  it('genera una serie semanal', () => {
    const result = applyAssistantAction({
      result: { action: 'create_series', series: { title: 'Gimnasio', startDate: '2026-10-26', weeklySchedule: [{ days: [1, 3, 5], time: '07:00' }] } },
      events: [{ id: 1, date: '2026-10-28', time: '09:00', title: 'Otra cosa', duration: '30 min' }],
      now,
    })
    expect(result.changed).toBe(true)
    expect(result.events.length).toBeGreaterThan(50)
    const series = result.events.filter((event) => event.seriesId)
    expect(series.every((event) => event.time === '07:00')).toBe(true)
  })

  it('edita las horas de una serie existente sin recrear días', () => {
    const created = applyAssistantAction({
      result: { action: 'create_series', series: { title: 'Gimnasio', startDate: '2026-10-26', weeklySchedule: [{ days: [1], time: '07:00' }] } },
      events: [],
      now,
    })
    const before = created.events.length
    const edited = applyAssistantAction({
      result: { action: 'edit_series', targetTitle: 'Gimnasio', weeklySchedule: [{ days: [1], time: '06:30' }] },
      events: created.events,
      now,
    })
    expect(edited.events).toHaveLength(before)
    expect(edited.events.every((event) => event.time === '06:30')).toBe(true)
  })

  it('no toca nada cuando el modelo solo responde texto', () => {
    const events = [{ id: 1, date: '2026-10-28', time: '09:00', title: 'Reunión', duration: '30 min' }]
    const result = applyAssistantAction({ result: { action: 'reply', reply: 'Tienes una reunión.' }, events, now })
    expect(result.changed).toBe(false)
    expect(result.events).toBe(events)
    expect(result.reply).toBe('Tienes una reunión.')
  })
})

describe('parseAssistantResult', () => {
  it('lee el JSON rodeado de texto', () => {
    const parsed = parseAssistantResult('Claro: {"action":"reply","reply":"vale"} ¿algo más?')
    expect(parsed?.action).toBe('reply')
  })

  it('no se rompe con llaves dentro de una cadena', () => {
    const parsed = parseAssistantResult('{"action":"reply","reply":"usa {esto}"}')
    expect(parsed?.reply).toBe('usa {esto}')
  })
})
