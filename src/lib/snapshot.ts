import { defaultAiKeys, providerModels, providerOrder } from '../constants'
import { buildInitialEvents, initialMemories, initialProjects } from '../initialData'
import { todayDateKey } from './dates'
import type { AiSettings, AppSnapshot, ConversationSession } from '../types'

export const readStored = <T,>(key: string, fallback: T) => { try { const stored = localStorage.getItem(key); return stored ? JSON.parse(stored) as T : fallback } catch { return fallback } }
export const mergeAiSettings = (cloudSettings?: Partial<AiSettings>, localStorageKey = 'aura-ai-settings') => {
  const localSettings = readStored(localStorageKey, defaultAiKeys as AiSettings)
  return Object.fromEntries(providerOrder.map((provider) => [provider, {
    apiKey: localSettings[provider]?.apiKey || '',
    model: cloudSettings?.[provider]?.model || localSettings[provider]?.model || providerModels[provider][0].id,
  }])) as AiSettings
}
export const readLocalAppSnapshot = (): AppSnapshot => {
  const savedSessions = readStored<ConversationSession[]>('aura-conversations', [])
  const theme = localStorage.getItem('aura-theme')
  return {
    events: readStored('aura-events', buildInitialEvents()),
    projects: readStored('aura-projects', initialProjects),
    memories: readStored('aura-memories', initialMemories),
    aiSettings: mergeAiSettings(),
    conversationSessions: savedSessions.length ? savedSessions : [{ id: 'conversation-1', title: 'Conversación actual', messages: readStored('aura-conversation', [{ from: 'assistant', text: 'Buenos días, Alex. He dejado espacio para que el día respire. ¿Qué quieres ajustar?' }]) }],
    activeConversationId: localStorage.getItem('aura-active-conversation') || 'conversation-1',
    darkMode: theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches,
    selectedDateKey: todayDateKey(),
    calendarView: 'day',
  }
}
export const createEmptyAppSnapshot = (): AppSnapshot => ({
  events: buildInitialEvents(),
  projects: initialProjects,
  memories: initialMemories,
  aiSettings: mergeAiSettings(),
  conversationSessions: [{ id: 'conversation-1', title: 'Conversación actual', messages: [{ from: 'assistant', text: 'Buenos días, Alex. He dejado espacio para que el día respire. ¿Qué quieres ajustar?' }] }],
  activeConversationId: 'conversation-1',
  selectedDateKey: todayDateKey(),
  calendarView: 'day',
})
export const snapshotForCloud = (snapshot: AppSnapshot): AppSnapshot => ({
  ...snapshot,
  aiSettings: snapshot.aiSettings ? Object.fromEntries(providerOrder.map((provider) => [provider, { apiKey: '', model: snapshot.aiSettings?.[provider]?.model || providerModels[provider][0].id }])) as AiSettings : undefined,
})
