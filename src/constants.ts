

export const suggestions = ['Mueve el almuerzo a las 13:30', 'Libérame una hora esta tarde', '¿Qué tengo después de comer?']
export const providerModels = {
  openrouter: [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini Flash' },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude Haiku' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
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
