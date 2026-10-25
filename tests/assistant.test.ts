import { describe, expect, it } from 'vitest'
import { extractJsonObject, parseAssistantResult, parseJsonPayload } from '../src/lib/assistant'

describe('extractJsonObject', () => {
  it('ignora el texto que rodea al JSON', () => {
    expect(extractJsonObject('Claro, esto es: {"action":"reply","reply":"hecho"} ¿te sirve?')).toBe('{"action":"reply","reply":"hecho"}')
  })

  it('no se corta con llaves dentro de una cadena', () => {
    const raw = '{"action":"reply","reply":"usa {esto} y }aquello}"} fin'
    expect(JSON.parse(extractJsonObject(raw)!)).toEqual({ action: 'reply', reply: 'usa {esto} y }aquello}' })
  })

  it('devuelve solo el primer objeto cuando hay varios', () => {
    expect(extractJsonObject('{"a":1} y luego {"b":2}')).toBe('{"a":1}')
  })

  it('devuelve null si el JSON está incompleto o no hay llaves', () => {
    expect(extractJsonObject('{"a":1')).toBeNull()
    expect(extractJsonObject('sin json')).toBeNull()
  })
})

describe('parseJsonPayload', () => {
  it('parsea un objeto anidado completo', () => {
    const payload = parseJsonPayload<{ schedule: Array<{ id: number; time: string }> }>('Propuesta: {"schedule":[{"id":1,"time":"09:00"}],"summary":"ok"}')
    expect(payload?.schedule[0]?.time).toBe('09:00')
  })

  it('devuelve null si el contenido no es JSON válido', () => {
    expect(parseJsonPayload('{action: reply}')).toBeNull()
  })
})

describe('parseAssistantResult', () => {
  it('lee la acción y los datos del evento', () => {
    const result = parseAssistantResult('{"action":"create_event","event":{"title":"Pagar la luz","time":"18:00"}}')
    expect(result?.action).toBe('create_event')
    expect(result?.event?.title).toBe('Pagar la luz')
  })

  it('devuelve null cuando el modelo solo escribe texto', () => {
    expect(parseAssistantResult('No pude entender la solicitud.')).toBeNull()
  })
})
