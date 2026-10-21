import { useEffect } from 'react'
import type { AiSettings, ConversationSession, EventItem, Memory, Project } from '../types'

type PersistedState = {
  events: EventItem[]
  projects: Project[]
  memories: Memory[]
  aiSettings: AiSettings
  aiSettingsStorageKey: string
  conversationSessions: ConversationSession[]
  activeConversationId: string
}

// Guarda en localStorage el estado que debe sobrevivir a una recarga.
export function useLocalPersistence({ events, projects, memories, aiSettings, aiSettingsStorageKey, conversationSessions, activeConversationId }: PersistedState) {
  useEffect(() => { localStorage.setItem('aura-events', JSON.stringify(events)) }, [events])
  useEffect(() => { localStorage.setItem(aiSettingsStorageKey, JSON.stringify(aiSettings)) }, [aiSettings, aiSettingsStorageKey])
  useEffect(() => { localStorage.setItem('aura-projects', JSON.stringify(projects)) }, [projects])
  useEffect(() => { localStorage.setItem('aura-memories', JSON.stringify(memories)) }, [memories])
  useEffect(() => {
    localStorage.setItem('aura-conversations', JSON.stringify(conversationSessions.map((session) => ({ ...session, messages: session.messages.slice(-100) }))))
    localStorage.setItem('aura-active-conversation', activeConversationId)
    const activeMessages = conversationSessions.find((session) => session.id === activeConversationId)?.messages || []
    localStorage.setItem('aura-conversation', JSON.stringify(activeMessages.slice(-100)))
  }, [conversationSessions, activeConversationId])
}
