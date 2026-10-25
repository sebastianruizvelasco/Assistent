export const suggestions = ['Mueve el almuerzo a las 13:30', 'Libérame una hora esta tarde', '¿Qué tengo después de comer?']

// Valor especial del selector para escribir un ID de modelo que no esté en la lista.
// Las listas de modelos caducan rápido: el ID personalizado evita quedarse sin opciones.
export const customModelValue = '__custom__'

export const providerModels = {
  openrouter: [
    { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol' },
    { id: 'openai/gpt-6-luna', name: 'GPT-6 Luna' },
    { id: 'anthropic/claude-haiku-5.5', name: 'Claude Haiku 5.5' },
    { id: 'google/gemini-4-argon', name: 'Gemini 4 Argon' },
  ],
  openai: [
    { id: 'gpt-6-luna', name: 'GPT-6 Luna' },
    { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' },
    { id: 'gpt-6-astra', name: 'GPT-6 Astra' },
  ],
  gemini: [
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
    { id: 'gemini-4-argon', name: 'Gemini 4 Argon' },
  ],
  anthropic: [
    { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' },
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
  ],
} as const
export const providerLabels = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic',
} as const
export const providerOrder = Object.keys(providerLabels) as Array<keyof typeof providerLabels>
export const defaultAiKeys = {
  openrouter: { apiKey: '', model: providerModels.openrouter[0].id },
  openai: { apiKey: '', model: providerModels.openai[0].id },
  gemini: { apiKey: '', model: providerModels.gemini[0].id },
  anthropic: { apiKey: '', model: providerModels.anthropic[0].id },
} as const
export const availableModels = providerModels.openrouter

export const weekDayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
