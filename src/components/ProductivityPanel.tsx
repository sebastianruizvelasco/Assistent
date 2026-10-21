import { type Dispatch, type SetStateAction } from 'react'
import type { EventItem } from '../types'

type ProductivityPanelProps = {
  activeSection: string
  completedCount: number
  selectedDayEvents: EventItem[]
  totalMinutes: number
  conflictIds: Set<number>
  priorityFilter: "todas" | "alta" | "media" | "baja"
  setPriorityFilter: Dispatch<SetStateAction<"todas" | "alta" | "media" | "baja">>
  setShowCompleted: Dispatch<SetStateAction<boolean>>
  showCompleted: boolean
  isThinking: boolean
  organizeSelectedDay: () => Promise<void>
  events: EventItem[]
  openEditEvent: (eventId: number) => void
  removeEvent: (eventId: number) => void
}

export function ProductivityPanel({
  activeSection, completedCount, selectedDayEvents, totalMinutes, conflictIds, priorityFilter,
  setPriorityFilter, setShowCompleted, showCompleted, isThinking, organizeSelectedDay, events,
  openEditEvent, removeEvent
}: ProductivityPanelProps) {
  return (
    <>
{activeSection === 'Mi día' && <div className="productivity-panel"><div className="productivity-summary"><strong>{completedCount}/{selectedDayEvents.length}</strong><span>completadas</span><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong><span>planificadas</span>{conflictIds.size > 0 && <strong className="conflict-count">{conflictIds.size} conflictos</strong>}</div><div className="productivity-controls"><label>Prioridad<select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}><option value="todas">Todas</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></label><button onClick={() => setShowCompleted((current) => !current)}>{showCompleted ? 'Ocultar completadas' : 'Mostrar completadas'}</button><button className="organize-day-button" disabled={isThinking} onClick={organizeSelectedDay}>{isThinking ? 'Organizando...' : '✦ Organizar día'}</button></div></div>}
        {activeSection === 'Mi día' && events[0] && <div className="task-shortcuts"><button className="edit-shortcut" onClick={() => openEditEvent(events[0].id)}>Editar primera tarea</button><button className="delete-shortcut" onClick={() => removeEvent(events[0].id)}>Eliminar primera tarea</button></div>}

</>
  )
}
