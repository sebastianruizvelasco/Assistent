import type { AiSettings, AppSnapshot, ConversationSession, EventItem, Memory, Project } from '../types'
import { providerOrder, providerModels } from '../constants'

// Une dos listas por id: gana el elemento de `primary` y se conservan los ids que solo existen en
// `secondary`. Sirve para no borrar lo que escribió el bot de Discord (u otro dispositivo) mientras
// esta pestaña tenía la agenda abierta.
const mergeById = <T extends { id: number }>(primary: T[], secondary: T[]): T[] => {
  const byId = new Map<number, T>()
  for (const item of secondary) byId.set(item.id, item)
  for (const item of primary) byId.set(item.id, item)
  return [...byId.values()]
}

const mergeSessions = (primary: ConversationSession[], secondary: ConversationSession[]): ConversationSession[] => {
  const byId = new Map<string, ConversationSession>()
  for (const session of secondary) byId.set(session.id, session)
  for (const session of primary) byId.set(session.id, session)
  return [...byId.values()]
}

const mergeSettings = (primary?: Partial<AiSettings>, secondary?: Partial<AiSettings>): AiSettings | undefined => {
  if (!primary && !secondary) return undefined
  const result = {} as AiSettings
  for (const provider of providerOrder) {
    result[provider] = {
      apiKey: primary?.[provider]?.apiKey || secondary?.[provider]?.apiKey || '',
      model: primary?.[provider]?.model || secondary?.[provider]?.model || providerModels[provider][0].id,
    }
  }
  return result
}

// `primary` es lo que este cliente acaba de escribir; `secondary` lo que había en la nube.
export const mergeSnapshots = (primary: AppSnapshot, secondary?: AppSnapshot | null): AppSnapshot => {
  if (!secondary) return primary
  return {
    events: mergeById(primary.events || [], secondary.events || []),
    projects: mergeById(primary.projects || [], secondary.projects || []),
    memories: mergeById(primary.memories || [], secondary.memories || []),
    conversationSessions: mergeSessions(primary.conversationSessions || [], secondary.conversationSessions || []),
    aiSettings: mergeSettings(primary.aiSettings, secondary.aiSettings),
    activeConversationId: primary.activeConversationId || secondary.activeConversationId,
    darkMode: primary.darkMode ?? secondary.darkMode,
    selectedDateKey: primary.selectedDateKey || secondary.selectedDateKey,
    calendarView: primary.calendarView || secondary.calendarView,
  }
}

// Tipos auxiliares para quien importa este módulo (evita arrastrar tipos sueltos).
export type { AiSettings, AppSnapshot, ConversationSession, EventItem, Memory, Project }
