import { type Dispatch, type DragEvent, type PointerEvent, type SetStateAction, type MouseEvent as ReactMouseEvent } from 'react'
import { weekDayNames } from '../constants'
import { dateFromKey, dateKeyFromDate } from '../lib/dates'
import { durationToMinutes } from '../lib/schedule'
import type { CalendarView, EventItem } from '../types'

type CalendarBodyProps = {
  setEvents: Dispatch<SetStateAction<EventItem[]>>
  conflictIds: Set<number>
  editingEventId: number | null
  setDraggedId: Dispatch<SetStateAction<number | null>>
  moveEvent: (targetId: number) => void
  toggleComplete: (eventId: number) => void
  setEditingEventId: Dispatch<SetStateAction<number | null>>
  setEventMenuId: Dispatch<SetStateAction<number | null>>
  eventMenuId: number | null
  openEditEvent: (eventId: number) => void
  duplicateEvent: (eventId: number) => void
  removeEvent: (eventId: number) => void
  removeEventSeries: (eventId: number) => void
  visibleEvents: EventItem[]
  selectedDateKey: string
  selectedDateObject: Date
  dragSelection: { start: number; end: number; } | null
  currentHour: number
  beginTimeSelection: (hour: number, event: PointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>) => void
  updateTimeSelection: (hour: number, event: PointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>) => void
  finishTimeSelection: (hour: number, event: PointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>) => void
  moveEventToTime: (hour: number, event: DragEvent<HTMLDivElement>) => void
  currentMinute: number
  openAddEvent: (date?: string, time?: string, duration?: string) => void
  weekDays: string[]
  setSelectedDateKey: Dispatch<SetStateAction<string>>
  setCalendarView: Dispatch<SetStateAction<CalendarView>>
  monthCells: number[]
  monthDays: number
  calendarView: CalendarView
}

export function CalendarBody({
  setEvents, conflictIds, editingEventId, setDraggedId, moveEvent, toggleComplete,
  setEditingEventId, setEventMenuId, eventMenuId, openEditEvent, duplicateEvent, removeEvent,
  removeEventSeries, visibleEvents, selectedDateKey, selectedDateObject, dragSelection,
  currentHour, beginTimeSelection, updateTimeSelection, finishTimeSelection, moveEventToTime,
  currentMinute, openAddEvent, weekDays, setSelectedDateKey, setCalendarView, monthCells,
  monthDays, calendarView
}: CalendarBodyProps) {
  const renderEventCard = (event: EventItem, compact = false, slotIndex = 0, overlap?: { left: string; width: string }) => { const height = `${Math.max(42, durationToMinutes(event.duration) / 60 * 72 - 8)}px`; const minuteOffset = Number(event.time.split(':')[1]) || 0; const updateTitle = (title: string) => setEvents((current) => current.map((item) => item.id === event.id ? { ...item, title: title || ' ' } : item)); const style = compact ? undefined : { height, top: `${minuteOffset / 60 * 72 + 4 + slotIndex * 4}px`, ...(overlap || {}) }; return <article key={event.id} style={style} className={`event-card ${event.accent} ${event.completed ? 'completed-event' : ''} ${conflictIds.has(event.id) ? 'conflict-event' : ''} ${compact ? 'compact-event' : ''}`} draggable={editingEventId !== event.id} onDragStart={() => setDraggedId(event.id)} onDragOver={(dragEvent) => dragEvent.preventDefault()} onDrop={(dragEvent) => { dragEvent.stopPropagation(); moveEvent(event.id) }}><div className="event-body"><div className="event-heading"><div className="event-title-row"><button className={`complete-toggle ${event.completed ? 'checked' : ''}`} aria-label={event.completed ? `Marcar ${event.title} como pendiente` : `Marcar ${event.title} como completada`} onClick={() => toggleComplete(event.id)}>{event.completed ? '✓' : ''}</button>{editingEventId === event.id ? <input className="inline-title" autoFocus value={event.title} onChange={(inputEvent) => updateTitle(inputEvent.target.value)} onBlur={() => setEditingEventId(null)} onKeyDown={(keyEvent) => { if (keyEvent.key === 'Enter') setEditingEventId(null) }} /> : <h2>{event.title}</h2>}</div><div className="event-actions"><span className={`priority-dot ${event.priority || 'media'}`} title={`Prioridad ${event.priority || 'media'}`} /><button aria-label={`Opciones de ${event.title}`} className="more-button" onClick={() => setEventMenuId(eventMenuId === event.id ? null : event.id)}>•••</button>{eventMenuId === event.id && <div className="event-menu"><button onClick={() => openEditEvent(event.id)}>Editar</button><button onClick={() => duplicateEvent(event.id)}>Duplicar</button><button onClick={() => removeEvent(event.id)}>Eliminar solo este día</button>{event.recurrence && event.recurrence !== 'No se repite' && <button onClick={() => removeEventSeries(event.id)}>Eliminar serie</button>}</div>}</div></div><p>{event.place} {event.tag && <span className="event-tag">#{event.tag}</span>}</p><span className="duration">{event.time} · {event.duration}{conflictIds.has(event.id) && <b className="conflict-label"> · Conflicto</b>}</span></div></article> }

  const renderDayView = () => { const dayEvents = visibleEvents.filter((event) => event.date === selectedDateKey); const sortedEvents = [...dayEvents].sort((a, b) => a.time.localeCompare(b.time)); const columns: number[] = []; const layouts = new Map<number, { left: string; width: string }>(); sortedEvents.forEach((event) => { const [hour, minute] = event.time.split(':').map(Number); const start = hour * 60 + minute; const end = start + durationToMinutes(event.duration); let column = columns.findIndex((columnEnd) => columnEnd <= start); if (column === -1) { column = columns.length; columns.push(end) } else columns[column] = end; const overlapping = sortedEvents.filter((other) => { const [otherHour, otherMinute] = other.time.split(':').map(Number); const otherStart = otherHour * 60 + otherMinute; const otherEnd = otherStart + durationToMinutes(other.duration); return otherStart < end && otherEnd > start }).length; layouts.set(event.id, { left: `${(column / overlapping) * 100}%`, width: `calc(${100 / overlapping}% - 4px)` }) }); return <div className="timeline"><div className="event-list"><div className="calendar-head"><span></span><strong>{weekDayNames[selectedDateObject.getDay()]} {selectedDateObject.getDate()}</strong></div>{Array.from({ length: 24 }, (_, hour) => { const hourEvents = dayEvents.filter((event) => Number(event.time.split(':')[0]) === hour); const isSelected = dragSelection && hour * 60 + 59 >= Math.min(dragSelection.start, dragSelection.end) && hour * 60 <= Math.max(dragSelection.start, dragSelection.end); const isCurrentHour = hour === currentHour; return <div className={`calendar-row ${isCurrentHour ? 'current-row' : ''} ${isSelected ? 'selecting-row' : ''}`} key={hour}><span className="calendar-time">{String(hour).padStart(2, '0')}:00</span><div className="calendar-cell" onPointerDown={(event) => beginTimeSelection(hour, event)} onPointerEnter={(event) => updateTimeSelection(hour, event)} onPointerUp={(event) => finishTimeSelection(hour, event)} onMouseDown={(event) => beginTimeSelection(hour, event)} onMouseEnter={(event) => updateTimeSelection(hour, event)} onMouseUp={(event) => finishTimeSelection(hour, event)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveEventToTime(hour, event)}>{isCurrentHour && <span className="now-line" style={{ top: `${currentMinute / 60 * 100}%` }}><i>Ahora</i></span>}{isSelected && <span className="selection-label">{String(Math.floor(Math.min(dragSelection.start, dragSelection.end) / 60)).padStart(2, '0')}:{String(Math.min(dragSelection.start, dragSelection.end) % 60).padStart(2, '0')}</span>}{hourEvents.map((event, slotIndex) => renderEventCard(event, false, slotIndex, layouts.get(event.id)))}</div></div> })}<button className="empty-slot" onClick={() => openAddEvent(selectedDateKey)}><span>+</span><span>Crear un evento</span></button></div></div> }

  const renderWeekView = () => {
    const hours = Array.from({ length: 12 }, (_, index) => index + 1)
    const rangeStart = 60
    const rangeEnd = 13 * 60
    const rowHeight = 72
    return <div className="week-view"><div className="week-head"><span></span>{weekDays.map((day) => <button key={day} className={day === selectedDateKey ? 'selected-day' : ''} onClick={() => { setSelectedDateKey(day); setCalendarView('day') }}><small>{weekDayNames[dateFromKey(day).getDay()]}</small><strong>{dateFromKey(day).getDate()}</strong></button>)}</div><div className="week-grid"><div className="week-times">{hours.map((hour) => <span key={hour}>{hour} {hour === 12 ? 'PM' : 'AM'}</span>)}</div>{weekDays.map((day) => {
      const dayEvents = visibleEvents.filter((event) => event.date === day).sort((first, second) => first.time.localeCompare(second.time))
      const columns: number[] = []
      const layouts = new Map<number, { left: string; width: string }>()
      dayEvents.forEach((event) => {
        const [hour, minute] = event.time.split(':').map(Number)
        const start = hour * 60 + minute
        const end = start + durationToMinutes(event.duration)
        let column = columns.findIndex((columnEnd) => columnEnd <= start)
        if (column === -1) { column = columns.length; columns.push(end) } else columns[column] = end
        const overlapping = dayEvents.filter((other) => {
          const [otherHour, otherMinute] = other.time.split(':').map(Number)
          const otherStart = otherHour * 60 + otherMinute
          return otherStart < end && otherStart + durationToMinutes(other.duration) > start
        }).length
        layouts.set(event.id, { left: `${column / overlapping * 100}%`, width: `calc(${100 / overlapping}% - 4px)` })
      })
      return <div className="week-column" key={day}>{hours.map((hour) => <div className="week-slot" key={hour} />)}{dayEvents.map((event) => {
        const [hour, minute] = event.time.split(':').map(Number)
        const start = hour * 60 + minute
        if (start < rangeStart || start >= rangeEnd) return null
        const height = Math.max(24, Math.min(durationToMinutes(event.duration), rangeEnd - start) / 60 * rowHeight - 4)
        const layout = layouts.get(event.id)
        return <article key={event.id} className={`week-event ${event.accent}`} style={{ top: `${(start - rangeStart) / 60 * rowHeight + 2}px`, height: `${height}px`, ...(layout || {}) }} title={`${event.time} · ${event.title} · ${event.duration}`}><strong>{event.time}</strong><span>{event.title}</span><small>{event.duration}</small></article>
      })}</div>
    })}</div></div>
  }

  const renderMonthView = () => <div className="month-view"><div className="month-weekdays">{['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((day) => <strong key={day}>{day}</strong>)}</div><div className="month-grid">{monthCells.map((day, index) => { const isCurrentMonth = day > 0 && day <= monthDays; const dateKey = isCurrentMonth ? dateKeyFromDate(new Date(selectedDateObject.getFullYear(), selectedDateObject.getMonth(), day)) : ''; const dayEvents = visibleEvents.filter((event) => event.date === dateKey).sort((first, second) => first.time.localeCompare(second.time)); return <button key={`${day}-${index}`} className={`month-cell ${dateKey === selectedDateKey ? 'selected-day' : ''} ${!isCurrentMonth ? 'outside-month' : ''}`} onClick={() => isCurrentMonth && openAddEvent(dateKey)}>{isCurrentMonth && <><span className="month-number">{day}</span>{dayEvents.slice(0, 3).map((event) => <span className={`month-event ${event.accent}`} key={event.id} title={`${event.time} · ${event.title} · ${event.duration}`}><time>{event.time}</time><span>{event.title}</span><small>{event.duration}</small></span>)}{dayEvents.length > 3 && <span className="month-more">+{dayEvents.length - 3} más</span>}{dayEvents.length === 0 && <span className="month-add">+</span>}</>}</button> })}</div></div>

  const renderYearView = () => <div className="year-view">{Array.from({ length: 12 }, (_, monthIndex) => { const monthName = new Date(selectedDateObject.getFullYear(), monthIndex, 1).toLocaleDateString('es-ES', { month: 'long' }); const daysInMonth = new Date(selectedDateObject.getFullYear(), monthIndex + 1, 0).getDate(); const offset = (new Date(selectedDateObject.getFullYear(), monthIndex, 1).getDay() + 6) % 7; return <button className="year-month" key={monthName} onClick={() => { setSelectedDateKey(dateKeyFromDate(new Date(selectedDateObject.getFullYear(), monthIndex, 1))); setCalendarView('month') }}><h3>{monthName}</h3><div className="mini-weekdays">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => <span key={day}>{day}</span>)}</div><div className="mini-days">{Array.from({ length: offset + daysInMonth }, (_, index) => { const day = index - offset + 1; const dateKey = day > 0 ? dateKeyFromDate(new Date(selectedDateObject.getFullYear(), monthIndex, day)) : ''; const dayEvents = visibleEvents.filter((event) => event.date === dateKey); const details = dayEvents.map((event) => `${event.time} ${event.title} (${event.duration})`).join('; '); return <span className={`${dayEvents.length ? 'has-event' : ''} ${dateKey === selectedDateKey ? 'selected-mini-day' : ''}`} title={details || undefined} aria-label={day > 0 ? `${day}${details ? `: ${details}` : ''}` : undefined} key={index}>{day > 0 ? day : ''}</span> })}</div></button> })}</div>
  return (
    <>
{calendarView === 'day' && renderDayView()}{calendarView === 'week' && renderWeekView()}{calendarView === 'month' && renderMonthView()}{calendarView === 'year' && renderYearView()}

</>
  )
}
