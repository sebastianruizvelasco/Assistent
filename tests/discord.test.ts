import { describe, expect, it } from 'vitest'
import { createLinkCode, LINK_CODE_LENGTH, normalizeLinkCode } from '../src/lib/discord'

// Bytes fijos para que el código sea predecible en la prueba.
const fixedBytes = (values: number[]) => (length: number) => Uint8Array.from({ length }, (_, index) => values[index] ?? 0)

describe('createLinkCode', () => {
  it('genera un código de la longitud esperada y sin caracteres ambiguos', () => {
    const code = createLinkCode()
    expect(code).toHaveLength(LINK_CODE_LENGTH)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/)
    expect(code).not.toMatch(/[OI01]/)
  })

  it('es determinista con la misma fuente de bytes', () => {
    expect(createLinkCode(fixedBytes([0, 1, 2, 3, 4, 5]))).toBe(createLinkCode(fixedBytes([0, 1, 2, 3, 4, 5])))
  })

  it('produce códigos distintos con bytes distintos', () => {
    expect(createLinkCode(fixedBytes([0, 0, 0, 0, 0, 0]))).not.toBe(createLinkCode(fixedBytes([9, 9, 9, 9, 9, 9])))
  })
})

describe('normalizeLinkCode', () => {
  it('acepta el código como lo escriba la persona', () => {
    expect(normalizeLinkCode(' k7m2qx ')).toBe('K7M2QX')
    expect(normalizeLinkCode('k7m-2qx')).toBe('K7M2QX')
  })

  it('recorta lo que sobra', () => {
    expect(normalizeLinkCode('ABCDEFGHIJKLMNOP')).toHaveLength(12)
  })
})
