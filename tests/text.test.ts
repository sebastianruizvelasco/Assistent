import { describe, expect, it } from 'vitest'
import { findEventsByMention, isDeleteIntent, normalizeText, parseMentionedTime } from '../src/lib/text'

const events = [
  { id: 1, title: 'Reunión de equipo', time: '09:00' },
  { id: 2, title: 'Llamada con mamá', time: '17:00' },
  { id: 3, title: 'Gimnasio', time: '07:00', seriesId: 'serie-1' },
]

describe('normalizeText', () => {
  it('quita acentos, mayúsculas y signos', () => {
    expect(normalizeText('  Reunión  de EQUIPO! ')).toBe('reunion de equipo')
  })
})

describe('findEventsByMention', () => {
  it('encuentra un evento aunque se escriba sin acentos ni mayúsculas', () => {
    const mention = findEventsByMention(events, 'mueve la reunion de equipo a las 16:00')
    expect(mention.best?.id).toBe(1)
    expect(mention.ambiguous).toBe(false)
  })

  it('tolera plurales en el título', () => {
    const mention = findEventsByMention([{ id: 9, title: 'Reuniones' }], 'borra la reunion')
    expect(mention.best?.id).toBe(9)
  })

  it('no confunde una palabra corta con otra más larga', () => {
    const mention = findEventsByMention([{ id: 4, title: 'Mar' }], 'borra el martes')
    expect(mention.matches).toHaveLength(0)
  })

  it('avisa cuando hay empate en vez de elegir uno al azar', () => {
    const mention = findEventsByMention(
      [{ id: 5, title: 'Revisar propuesta' }, { id: 6, title: 'Revisar informe' }],
      'borra revisar',
    )
    expect(mention.best).toBeNull()
    expect(mention.ambiguous).toBe(true)
    expect(mention.matches.map((event) => event.id).sort()).toEqual([5, 6])
  })

  it('no devuelve nada cuando el título no se menciona', () => {
    const mention = findEventsByMention(events, 'organiza mi día')
    expect(mention.matches).toHaveLength(0)
    expect(mention.best).toBeNull()
  })
})

describe('parseMentionedTime', () => {
  it('lee horas con y sin minutos', () => {
    expect(parseMentionedTime('mueve la reunión a las 16:30')).toBe('16:30')
    expect(parseMentionedTime('pásalo a las 9')).toBe('09:00')
  })

  it('descarta horas imposibles o frases sin hora', () => {
    expect(parseMentionedTime('muévelo a las 25')).toBeNull()
    expect(parseMentionedTime('muévelo por la tarde')).toBeNull()
  })
})

describe('isDeleteIntent', () => {
  it('reconoce la intención de borrar', () => {
    expect(isDeleteIntent('borra la reunión')).toBe(true)
    expect(isDeleteIntent('Elimina el gimnasio del lunes')).toBe(true)
  })

  it('no se activa dentro de otra palabra', () => {
    expect(isDeleteIntent('el bordado queda pendiente')).toBe(false)
  })
})
