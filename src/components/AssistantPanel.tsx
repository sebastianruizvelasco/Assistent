import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { customModelValue, providerLabels, providerModels, providerOrder, suggestions } from '../constants'
import type { AiSettings, ConversationMessage, ConversationSession, EventItem, ScheduleChange } from '../types'
import { LogoMark } from './Logo'
import { CopyIcon, MicIcon, PlusIcon, SendIcon, SettingsIcon, SparkIcon } from './Icons'

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
  voiceSupported: boolean
  voiceInterim: string
  toggleVoice: () => void
}

export function AssistantPanel({
  activeSection, selectedProvider, handleProviderChange, setAiSettingsOpen, selectedModel,
  setSelectedModel, setAiSettings, aiSettingsOpen, aiSettings, updateAiSetting, showNotice,
  scheduleProposal, events, setScheduleProposal, selectedDateKey, applyScheduleProposal,
  conversation, isThinking, applyCommand, activeConversationId, setActiveConversationId,
  conversationSessions, duplicateCurrentConversation, startNewConversation, message, setMessage,
  voiceActive, voiceSupported, voiceInterim, toggleVoice
}: AssistantPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const knownModels = providerModels[selectedProvider]
  // Un modelo guardado que ya no esté en la lista se muestra como ID personalizado, no se pierde.
  const isCustomModel = !knownModels.some((model) => model.id === selectedModel)
  const updateModel = (value: string) => {
    setSelectedModel(value)
    setAiSettings((current) => ({ ...current, [selectedProvider]: { ...current[selectedProvider], model: value } }))
  }

  // Mantiene visible el último mensaje cuando llega uno nuevo o el modelo está escribiendo.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [conversation.length, isThinking, activeConversationId])

  return (
    <aside className={`assistant-panel ${activeSection !== 'Mi día' ? 'section-hidden' : ''}`} aria-label="Asistente AURA">
      <header className="assistant-header">
        <div className="assistant-title">
          <LogoMark size={38} />
          <div>
            <p className="eyebrow">AURA AI</p>
            <h2>Tu copiloto</h2>
          </div>
        </div>
        <div className="assistant-header-actions">
          <span className="online-dot">En línea</span>
          <button type="button" className={`icon-button ${aiSettingsOpen ? 'active' : ''}`} aria-label="Ajustes de IA" aria-expanded={aiSettingsOpen} onClick={() => setAiSettingsOpen((current) => !current)}><SettingsIcon /></button>
        </div>
      </header>

      <div className="assistant-model-bar">
        <select className="provider-select" aria-label="Proveedor de IA" value={selectedProvider} onChange={(event) => handleProviderChange(event.target.value as keyof typeof providerModels)}>
          {providerOrder.map((provider) => <option key={provider} value={provider}>{providerLabels[provider]}</option>)}
        </select>
        <select className="model-select" aria-label="Modelo de IA" value={isCustomModel ? customModelValue : selectedModel} onChange={(event) => updateModel(event.target.value === customModelValue ? '' : event.target.value)}>
          {knownModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
          <option value={customModelValue}>Otro modelo (ID personalizado)</option>
        </select>
        {isCustomModel && (
          <input
            className="model-custom"
            aria-label="ID de modelo personalizado"
            value={selectedModel}
            onChange={(event) => updateModel(event.target.value)}
            placeholder="ID del modelo, p. ej. gpt-6-luna (vacío = el que use el proxy)"
            spellCheck={false}
            autoComplete="off"
          />
        )}
      </div>

      {aiSettingsOpen && (
        <div className="ai-settings-panel">
          <p className="ai-settings-title">Claves de API</p>
          {providerOrder.map((provider) => (
            <label key={provider} className="ai-key-field">
              <span>{providerLabels[provider]}</span>
              <input type="password" value={aiSettings[provider].apiKey} onChange={(event) => updateAiSetting(provider, 'apiKey', event.target.value)} placeholder={`Pega la clave de ${providerLabels[provider]}`} />
            </label>
          ))}
          <div className="ai-settings-actions">
            <button type="button" className="secondary-action" onClick={() => setAiSettingsOpen(false)}>Cerrar</button>
            <button type="button" className="primary-action" onClick={() => { setAiSettingsOpen(false); showNotice('Credenciales guardadas en tu navegador.') }}>Guardar</button>
          </div>
        </div>
      )}

      {scheduleProposal && (
        <div className="schedule-proposal">
          <strong>Propuesta para {scheduleProposal.date}</strong>
          <ul>
            {scheduleProposal.changes.map((change) => {
              const event = events.find((item) => item.id === change.id)
              return event ? <li key={change.id}><span>{event.title}</span><span>{event.time} → {change.time}</span></li> : null
            })}
          </ul>
          <div>
            <button onClick={() => setScheduleProposal(null)}>Descartar</button>
            <button className="proposal-apply" disabled={scheduleProposal.date !== selectedDateKey} onClick={applyScheduleProposal}>Aplicar horario</button>
          </div>
        </div>
      )}

      <div className="conversation-controls">
        <select aria-label="Conversaciones guardadas" disabled={isThinking} value={activeConversationId} onChange={(event) => { setActiveConversationId(event.target.value); setScheduleProposal(null) }}>
          {conversationSessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}
        </select>
        <button type="button" className="icon-button bordered" title="Duplicar conversación" aria-label="Duplicar conversación" disabled={isThinking} onClick={duplicateCurrentConversation}><CopyIcon /></button>
        <button type="button" className="icon-button bordered" title="Nueva conversación" aria-label="Nueva conversación" disabled={isThinking} onClick={startNewConversation}><PlusIcon /></button>
      </div>

      <div className="conversation" ref={scrollRef} aria-live="polite">
        <div className="insight">
          <span className="insight-icon"><SparkIcon size={16} /></span>
          <div>
            <strong>Una pequeña observación</strong>
            <p>Tu tarde tiene 45 min de margen. Es un buen momento para cerrar el día sin prisa.</p>
          </div>
        </div>
        {conversation.map((item, index) => <div key={`${item.text}-${index}`} className={`message ${item.from}`}><p>{item.text}</p></div>)}
        {isThinking && <div className="message assistant thinking"><div className="typing-indicator" aria-label="El modelo está escribiendo"><span className="dot one" /><span className="dot two" /><span className="dot three" /></div></div>}
      </div>

      <div className="assistant-footer">
        <div className="suggestions">
          {suggestions.map((suggestion) => <button key={suggestion} disabled={isThinking} onClick={() => applyCommand(suggestion)}>{suggestion}</button>)}
        </div>
        <form className="composer" onSubmit={(event) => { event.preventDefault(); applyCommand(message) }}>
          <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Dile a Aura qué necesitas..." />
          <button
            type="button"
            className={`mic-button ${voiceActive ? 'voice-active' : ''}`}
            aria-label={voiceActive ? 'Detener dictado' : 'Activar dictado'}
            aria-pressed={voiceActive}
            title={voiceSupported ? (voiceActive ? 'Detener dictado' : 'Dictar con el micrófono') : 'Tu navegador no admite dictado por voz'}
            disabled={!voiceSupported}
            onClick={toggleVoice}
          ><MicIcon /></button>
          <button type="submit" className="send-button" aria-label="Enviar mensaje"><SendIcon /></button>
        </form>
        <p className={`voice-note ${voiceActive ? 'voice-active' : ''}`} aria-live="polite">
          {voiceActive
            ? (voiceInterim ? `Escuchando: “${voiceInterim}”` : 'Escuchando tu instrucción…')
            : voiceSupported ? 'También puedes hablar con Aura' : 'Tu navegador no admite dictado; escribe la instrucción'}
        </p>
      </div>
    </aside>
  )
}
