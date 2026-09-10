import { useState } from 'react'
import './App.css'

type EventItem = {
  id: number
  time: string
  title: string
  place: string
  category: 'focus' | 'move' | 'rest' | 'personal'
  duration: string
  accent: string
}

const initialEvents: EventItem[] = [
  { id: 1, time: '09:00', title: 'Revisión de producto', place: 'Sala Nube · Meet', category: 'focus', duration: '45 min', accent: 'blue' },
  { id: 2, time: '10:15', title: 'Bloque de trabajo profundo', place: 'Sin interrupciones', category: 'focus', duration: '2 h', accent: 'yellow' },
  { id: 3, time: '12:30', title: 'Almuerzo con Elena', place: 'Casa Bonay · 12 min a pie', category: 'personal', duration: '1 h', accent: 'coral' },
  { id: 4, time: '14:00', title: 'Llamada con el equipo', place: 'Google Meet', category: 'move', duration: '30 min', accent: 'green' },
  { id: 5, time: '16:00', title: 'Pausa y paseo', place: 'Parque de la Ciutadella', category: 'rest', duration: '45 min', accent: 'purple' },
]

const suggestions = ['Mueve el almuerzo a las 13:30', 'Libérame una hora esta tarde', '¿Qué tengo después de comer?']

function App() {
  const [events, setEvents] = useState(initialEvents)
  const [message, setMessage] = useState('')
  const [conversation, setConversation] = useState([
    { from: 'assistant', text: 'Buenos días, Alex. He dejado espacio para que el día respire. ¿Qué quieres ajustar?' },
  ])
  const [draggedId, setDraggedId] = useState<number | null>(null)

  const applyCommand = (rawMessage: string) => {
    const text = rawMessage.trim()
    if (!text) return
    let reply = 'Lo tengo. Puedo mover, crear o liberar bloques de tu agenda. Prueba con una hora concreta.'
    let updatedEvents = [...events]

    if (text.toLowerCase().includes('almuerzo') && /13[:.]?30/.test(text)) {
      updatedEvents = events.map((event) => event.id === 3 ? { ...event, time: '13:30' } : event)
      reply = 'He movido el almuerzo con Elena a las 13:30. El resto del día mantiene sus márgenes.'
    } else if (text.toLowerCase().includes('libérame') || text.toLowerCase().includes('libera')) {
      updatedEvents = events.filter((event) => event.id !== 5)
      reply = 'He liberado la pausa de la tarde. Te queda una ventana abierta de 16:00 a 16:45.'
    } else if (text.toLowerCase().includes('después de comer')) {
      reply = 'Después de comer tienes la llamada con el equipo a las 14:00, por Google Meet.'
    }

    setEvents(updatedEvents)
    setConversation((current) => [...current, { from: 'user', text }, { from: 'assistant', text: reply }])
    setMessage('')
  }

  const moveEvent = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return
    const fromIndex = events.findIndex((event) => event.id === draggedId)
    const toIndex = events.findIndex((event) => event.id === targetId)
    const reordered = [...events]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    setEvents(reordered)
    setDraggedId(null)
    setConversation((current) => [...current, { from: 'assistant', text: `He reordenado la agenda: ${moved.title} queda antes de ${events[toIndex].title}.` }])
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">a</span><span className="brand-copy"><strong>AURA</strong><small>Autonomous Unified Routine Assistant</small></span></div>
        <nav><button className="nav-link active">Mi día</button><button className="nav-link">Proyectos</button><button className="nav-link">Memoria</button></nav>
        <div className="top-actions"><button className="icon-button" aria-label="Buscar">⌕</button><button className="avatar" aria-label="Abrir perfil">AL</button></div>
      </header>

      <div className="workspace">
        <section className="agenda-column">
          <div className="date-row"><div><p className="eyebrow">MIÉRCOLES, 18 DE SEPTIEMBRE</p><h1>Tu día, a tu ritmo.</h1></div><button className="today-button">Hoy <span>⌄</span></button></div>
          <div className="day-meta"><span className="sun">☼</span><span>24° en Barcelona</span><span className="dot" /><span>5 bloques</span><span className="meta-spacer" /><button className="text-button">+ Añadir</button></div>
          <div className="timeline">
            <div className="time-rail"><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span><span>18:00</span></div>
            <div className="event-list">
              <div className="now-line"><span>Ahora</span></div>
              {events.map((event) => (
                <article key={event.id} className={`event-card ${event.accent}`} draggable onDragStart={() => setDraggedId(event.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => moveEvent(event.id)}>
                  <div className="event-time">{event.time}</div><div className="event-body"><div className="event-heading"><h2>{event.title}</h2><button aria-label={`Opciones de ${event.title}`} className="more-button">•••</button></div><p>{event.place}</p><span className="duration">{event.duration}</span></div><span className="drag-handle">⋮⋮</span>
                </article>
              ))}
              <div className="empty-slot"><span>+</span><span>Espacio libre para lo que necesites</span></div>
            </div>
          </div>
        </section>

        <aside className="assistant-panel">
          <div className="assistant-header"><div className="assistant-title"><span className="spark">✦</span><div><p className="eyebrow">AURA AI</p><h2>Tu copiloto</h2></div></div><span className="online-dot">En línea</span></div>
          <div className="conversation">{conversation.map((item, index) => <div key={`${item.text}-${index}`} className={`message ${item.from}`}><p>{item.text}</p></div>)}<div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => applyCommand(suggestion)}>{suggestion}</button>)}</div></div>
          <form className="composer" onSubmit={(event) => { event.preventDefault(); applyCommand(message) }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Dile a Selene qué necesitas..." /><button type="submit" aria-label="Enviar mensaje">↗</button></form>
          <div className="voice-note"><span className="wave">⌁</span><span>También puedes hablar con Aura</span><button aria-label="Activar dictado">◉</button></div>
          <div className="insight"><span className="insight-icon">✧</span><div><strong>Una pequeña observación</strong><p>Tu tarde tiene 45 min de margen. Es un buen momento para cerrar el día sin prisa.</p></div></div>
        </aside>
      </div>
      <footer><span>Planificado con intención</span><span>Última sincronización: ahora</span></footer>
    </main>
  )
}

export default App
