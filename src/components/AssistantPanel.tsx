import { type Dispatch, type SetStateAction } from 'react'
import { providerLabels, providerModels, providerOrder, suggestions } from '../constants'
import type { AiSettings, ConversationMessage, ConversationSession, EventItem, ScheduleChange } from '../types'

type AssistantPanelProps = {
  activeSection: string
  selectedProvider: "openrouter" | "openai" | "gemini" | "anthropic"
  handleProviderChange: (nextProvider: keyof typeof providerModels) => void
  setAiSettingsOpen: Dispatch<SetStateAction<boolean>>
  selectedModel: string
  setSelectedModel: Dispatch<SetStateAction<string>>
  setAiSettings: Dispatch<SetStateAction<AiSettings>>
  aiSettingsOpen: boolean
  aiSettings: AiSettings
  updateAiSetting: (provider: keyof typeof providerModels, key: "apiKey" | "model", value: string) => void
  showNotice: (text: string) => void
  scheduleProposal: { date: string; changes: ScheduleChange[]; summary: string; } | null
  events: EventItem[]
  setScheduleProposal: Dispatch<SetStateAction<{ date: string; changes: ScheduleChange[]; summary: string; } | null>>
  selectedDateKey: string
  applyScheduleProposal: () => void
  conversation: ConversationMessage[]
  isThinking: boolean
  applyCommand: (rawMessage: string) => Promise<void>
  activeConversationId: string
  setActiveConversationId: Dispatch<SetStateAction<string>>
  conversationSessions: ConversationSession[]
  duplicateCurrentConversation: () => void
  startNewConversation: () => void
  message: string
  setMessage: Dispatch<SetStateAction<string>>
  voiceActive: boolean
  toggleVoice: () => void
}

export function AssistantPanel({
  activeSection, selectedProvider, handleProviderChange, setAiSettingsOpen, selectedModel,
  setSelectedModel, setAiSettings, aiSettingsOpen, aiSettings, updateAiSetting, showNotice,
  scheduleProposal, events, setScheduleProposal, selectedDateKey, applyScheduleProposal,
  conversation, isThinking, applyCommand, activeConversationId, setActiveConversationId,
  conversationSessions, duplicateCurrentConversation, startNewConversation, message, setMessage,
  voiceActive, toggleVoice
}: AssistantPanelProps) {
  return (
    <aside className={`assistant-panel ${activeSection !== 'Mi día' ? 'section-hidden' : ''}`}>
          <div className="assistant-header"><div className="assistant-title"><span className="spark">✦</span><div><p className="eyebrow">AURA AI</p><h2>Tu copiloto</h2><div className="ai-setup-row"><select className="provider-select" aria-label="Proveedor de IA" value={selectedProvider} onChange={(event) => handleProviderChange(event.target.value as keyof typeof providerModels)}>{providerOrder.map((provider) => <option key={provider} value={provider}>{providerLabels[provider]}</option>)}</select><button type="button" className="settings-link" onClick={() => setAiSettingsOpen((current) => !current)}>Claves IA</button></div><select className="model-select" aria-label="Modelo de IA" value={selectedModel} onChange={(event) => { setSelectedModel(event.target.value); setAiSettings((current) => ({ ...current, [selectedProvider]: { ...current[selectedProvider], model: event.target.value } })) }}>{providerModels[selectedProvider].map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></div></div><span className="online-dot">En línea</span></div>
          {aiSettingsOpen && <div className="ai-settings-panel">{providerOrder.map((provider) => <label key={provider} className="ai-key-field"><span>{providerLabels[provider]}</span><input type="password" value={aiSettings[provider].apiKey} onChange={(event) => updateAiSetting(provider, 'apiKey', event.target.value)} placeholder={`Pega la clave de ${providerLabels[provider]}`} /></label>)}<div className="ai-settings-actions"><button type="button" className="secondary-action" onClick={() => setAiSettingsOpen(false)}>Cerrar</button><button type="button" className="primary-action" onClick={() => { setAiSettingsOpen(false); showNotice('Credenciales guardadas en tu navegador.') }}>Guardar</button></div></div>}
          {scheduleProposal && <div className="schedule-proposal"><strong>Propuesta para {scheduleProposal.date}</strong><ul>{scheduleProposal.changes.map((change) => { const event = events.find((item) => item.id === change.id); return event ? <li key={change.id}><span>{event.title}</span><span>{event.time} → {change.time}</span></li> : null })}</ul><div><button onClick={() => setScheduleProposal(null)}>Descartar</button><button className="proposal-apply" disabled={scheduleProposal.date !== selectedDateKey} onClick={applyScheduleProposal}>Aplicar horario</button></div></div>}
          <div className="conversation">{conversation.map((item, index) => <div key={`${item.text}-${index}`} className={`message ${item.from}`}><p>{item.text}</p></div>)}{isThinking && <div className="message assistant thinking"><div className="typing-indicator" aria-label="El modelo está escribiendo"><span className="dot one" /><span className="dot two" /><span className="dot three" /></div></div>}<div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion} disabled={isThinking} onClick={() => applyCommand(suggestion)}>{suggestion}</button>)}</div></div>
          <div className="conversation-controls"><select aria-label="Conversaciones guardadas" disabled={isThinking} value={activeConversationId} onChange={(event) => { setActiveConversationId(event.target.value); setScheduleProposal(null) }}>{conversationSessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}</select><button type="button" className="new-chat-button" disabled={isThinking} onClick={duplicateCurrentConversation}>⧉ Duplicar conversación</button><button type="button" className="new-chat-button" disabled={isThinking} onClick={startNewConversation}>＋ Nueva conversación</button></div>
          <form className="composer" onSubmit={(event) => { event.preventDefault(); applyCommand(message) }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Dile a Aura qué necesitas..." /><button type="submit" aria-label="Enviar mensaje">↗</button></form>
          <div className={`voice-note ${voiceActive ? 'voice-active' : ''}`}><span className="wave">⌁</span><span>{voiceActive ? 'Escuchando tu instrucción...' : 'También puedes hablar con Aura'}</span><button aria-label="Activar dictado" onClick={toggleVoice}>◉</button></div>
          <div className="insight"><span className="insight-icon">✧</span><div><strong>Una pequeña observación</strong><p>Tu tarde tiene 45 min de margen. Es un buen momento para cerrar el día sin prisa.</p></div></div>
        </aside>

  )
}
