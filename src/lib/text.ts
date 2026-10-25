// Utilidades de texto para interpretar lo que escribe la persona sin depender de acentos,
// mayúsculas ni puntuación. Se usan para decidir a qué evento se refiere una instrucción local.

const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'con', 'para', 'por', 'mi', 'mis', 'al', 'que'])

// Minúsculas, sin acentos y sin signos: “Reunión de Equipo.” y “reunion equipo” deben coincidir.
export const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Raíces aproximadas de una palabra para tolerar plurales: “reuniones” también encuentra “reunión”.
const wordStems = (word: string) => {
  const stems = [word]
  if (word.length > 4 && word.endsWith('es')) stems.push(word.slice(0, -2))
  if (word.length > 3 && word.endsWith('s')) stems.push(word.slice(0, -1))
  return stems
}

// Palabras significativas del título (sin artículos ni preposiciones) con sus raíces.
const titleWords = (title: string) => normalizeText(title)
  .split(' ')
  .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
  .map(wordStems)

// Acepta hasta dos letras de sufijo (“reunión” → “reuniones”) pero no una palabra distinta
// (“mar” no debe encontrar “martes”).
const matchesStem = (haystack: string, stem: string) => new RegExp(`\\b${escapeRegExp(stem)}\\w{0,2}\\b`, 'i').test(haystack)

export type TitleMention<T> = {
  matches: T[]
  best: T | null
  ambiguous: boolean
  score: number
}

// Busca en `text` los eventos cuyo título se menciona y devuelve solo los que puntúan más alto.
// Nunca devuelve `best` cuando hay empate: en ese caso `ambiguous` es true y decide la persona.
export const findEventsByMention = <T extends { title: string }>(events: T[], text: string, minimumScore = 0.5): TitleMention<T> => {
  const haystack = ` ${normalizeText(text)} `
  const scored = events.flatMap((event) => {
    const words = titleWords(event.title)
    if (!words.length) return []
    const hits = words.filter((stems) => stems.some((stem) => matchesStem(haystack, stem))).length
    return [{ event, score: hits / words.length }]
  }).filter((item) => item.score >= minimumScore)

  if (!scored.length) return { matches: [], best: null, ambiguous: false, score: 0 }
  const top = Math.max(...scored.map((item) => item.score))
  const matches = scored.filter((item) => item.score === top).map((item) => item.event)
  return { matches, best: matches.length === 1 ? matches[0]! : null, ambiguous: matches.length > 1, score: top }
}

// Interpreta la hora que se menciona en la frase (“a las 15”, “a las 9:30”).
// Devuelve null si no hay una hora creíble: así no se mueve un evento por una coincidencia casual.
export const parseMentionedTime = (text: string): string | null => {
  const match = normalizeText(text).match(/\b(?:a\s+las|las)\s+(\d{1,2})(?:\s+(\d{2}))?\b/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = match[2] === undefined ? 0 : Number(match[2])
  if (!Number.isFinite(hours) || hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// Detecta la intención de borrar sin aceptar coincidencias dentro de otras palabras.
export const isDeleteIntent = (text: string) => /\b(elimina|eliminar|elimines|borra|borrar|borres|quita|quitar)\b/.test(normalizeText(text))
