import { type Dispatch, type SetStateAction } from 'react'
import { todayDateKey } from '../lib/dates'
import type { CalendarView, EventItem } from '../types'

type CalendarHeaderProps = {
  setSelectedDateKey: Dispatch<SetStateAction<string>>
  setNewEventDate: Dispatch<SetStateAction<string>>
  showNotice: (text: string) => void
  changeCalendarDate: (direction: number) => void
  selectedDate: string
  calendarView: CalendarView
  selectedDateObject: Date
  setDateMenuOpen: Dispatch<SetStateAction<boolean>>
  dateMenuOpen: boolean
  setCalendarView: Dispatch<SetStateAction<CalendarView>>
  localTime: string
  timeZone: string
  temperature: number | null
  city: string
  events: EventItem[]
  openAddEvent: (date?: string, time?: string, duration?: string) => void
}

export function CalendarHeader({
  setSelectedDateKey, setNewEventDate, showNotice, changeCalendarDate, selectedDate, calendarView,
  selectedDateObject, setDateMenuOpen, dateMenuOpen, setCalendarView, localTime, timeZone,
  temperature, city, events, openAddEvent
}: CalendarHeaderProps) {
  return (
    <>
<div className="calendar-toolbar"><button className="today-button" onClick={() => { const today = todayDateKey(); setSelectedDateKey(today); setNewEventDate(today); showNotice('Has vuelto a hoy.') }}>Hoy</button><button className="calendar-arrow" aria-label="Periodo anterior" onClick={() => changeCalendarDate(-1)}>‹</button><button className="calendar-arrow" aria-label="Periodo siguiente" onClick={() => changeCalendarDate(1)}>›</button><div className="calendar-heading"><p className="eyebrow">{selectedDate}</p><h1>{calendarView === 'year' ? selectedDateObject.getFullYear() : calendarView === 'month' ? selectedDateObject.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'Tu día, a tu ritmo.'}</h1></div><div className="date-picker"><button className="view-button" onClick={() => setDateMenuOpen((current) => !current)}>{calendarView === 'day' ? 'Día' : calendarView === 'week' ? 'Semana' : calendarView === 'month' ? 'Mes' : 'Año'} <span>⌄</span></button>{dateMenuOpen && <div className="date-menu">{[['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['year', 'Año']].map(([value, label]) => <button key={value} onClick={() => { setCalendarView(value as typeof calendarView); setDateMenuOpen(false) }}>{label}</button>)}</div>}</div></div>
          <div className="day-meta"><span className="local-clock">◷ {localTime}</span><span className="timezone">{timeZone}</span><span className="dot" /><span className="sun">☼</span><span>{temperature === null ? '--°' : `${temperature}°`} en {city}</span><span className="dot" /><span>{events.length} bloques</span><span className="meta-spacer" /><button className="text-button" onClick={() => openAddEvent()}>+ Crear</button></div>

</>
  )
}
