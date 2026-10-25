// Códigos de un solo uso para vincular una cuenta de Discord con una cuenta de AURA.

// Sin caracteres ambiguos (0/O, 1/I) para que se pueda dictar o copiar sin errores.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LINK_CODE_LENGTH = 6
export const LINK_CODE_TTL_MS = 10 * 60 * 1000

type ByteSource = (length: number) => Uint8Array

export const secureBytes: ByteSource = (length) => {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

// Genera un código como «K7M2QX». `source` se inyecta en las pruebas.
export const createLinkCode = (source: ByteSource = secureBytes): string => {
  const bytes = source(LINK_CODE_LENGTH)
  let code = ''
  for (let index = 0; index < LINK_CODE_LENGTH; index += 1) {
    code += ALPHABET[(bytes[index] ?? 0) % ALPHABET.length]
  }
  return code
}

// Lo que escribe la persona en Discord puede venir con espacios o minúsculas.
export const normalizeLinkCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
