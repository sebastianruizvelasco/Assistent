

export type EventItem = {
  id: number
  date: string
  time: string
  title: string
  place: string
  category: 'focus' | 'move' | 'rest' | 'personal'
  duration: string
  accent: string
  recurrence?: string
  reminder?: string
  seriesId?: string
  flexibilityMinutes?: number
  flexibilityStart?: string
  flexibilityEnd?: string
  priority?: 'alta' | 'media' | 'baja'
  tag?: string
  completed?: boolean
}

export type CalendarView = 'day' | 'week' | 'month' | 'year'
export type ScheduleChange = { id: number; date?: string; time: string }
export type ScheduleProposal = { date: string; changes: ScheduleChange[]; summary: string }
export type ConversationMessage = { from: 'assistant' | 'user'; text: string }
export type ConversationSession = { id: string; title: string; messages: ConversationMessage[] }
export type WeeklyScheduleRule = { days: number[]; time: string }
export type AssistantSeries = { title?: string; startDate?: string; duration?: string; place?: string; weeklySchedule?: WeeklyScheduleRule[] }
export type AssistantResult = { action?: 'create_event' | 'create_series' | 'edit_series' | 'reply'; reply?: string; targetTitle?: string; weeklySchedule?: WeeklyScheduleRule[]; series?: AssistantSeries; event?: { title?: string; date?: string | null; time?: string | null; duration?: string; place?: string; category?: EventItem['category']; priority?: EventItem['priority']; flexibilityMinutes?: number; flexibilityWindow?: { start?: string; end?: string } | null } }
export type Project = { id: number; name: string; description: string; progress: number; color: string; due: string }
export type Memory = { id: number; title: string; content: string; category: string }
export type ProviderKey = 'openrouter' | 'openai' | 'gemini' | 'anthropic'
export type AiSettings = Record<ProviderKey, { apiKey: string; model: string }>
export type AppSnapshot = {
  events?: EventItem[]
  projects?: Project[]
  memories?: Memory[]
  aiSettings?: Partial<AiSettings>
  conversationSessions?: ConversationSession[]
  activeConversationId?: string
  darkMode?: boolean
  selectedDateKey?: string
  calendarView?: CalendarView
}
