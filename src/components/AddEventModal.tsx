import { type Dispatch, type SetStateAction } from 'react'
import { durationParts, reminderParts } from '../lib/schedule'
import type { EventItem } from '../types'

type AddEventModalProps = {
  addEventOpen: boolean
  setAddEventOpen: Dispatch<SetStateAction<boolean>>
  addEvent: (formData: FormData) => void
  formEventId: number | null
  events: EventItem[]
  newEventDate: string
  newEventTime: string
  newEventDuration: string
  flexibilityMode: "fixed" | "minutes" | "window"
  setFlexibilityMode: Dispatch<SetStateAction<"fixed" | "minutes" | "window">>
  reminderCustomEnabled: boolean
  setReminderCustomEnabled: Dispatch<SetStateAction<boolean>>
  requestNotifications: () => Promise<void>
}

export function AddEventModal({
  addEventOpen, setAddEventOpen, addEvent, formEventId, events, newEventDate, newEventTime,
  newEventDuration, flexibilityMode, setFlexibilityMode, reminderCustomEnabled,
  setReminderCustomEnabled, requestNotifications
}: AddEventModalProps) {
  if (!addEventOpen) return null
  return (
    <div className="modal-backdrop" onClick={() => setAddEventOpen(false)}><form className="add-modal" onSubmit={(event) => { event.preventDefault(); addEvent(new FormData(event.currentTarget)) }} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{formEventId === null ? 'NUEVO EVENTO' : 'EDITAR EVENTO'}</p><h2>{formEventId === null ? 'Añadir a tu calendario' : 'Actualizar tarea'}</h2></div><button type="button" className="modal-close" aria-label="Cerrar" onClick={() => setAddEventOpen(false)}>×</button></div><label>Qué necesitas hacer<input name="title" autoFocus defaultValue={formEventId === null ? '' : events.find((item) => item.id === formEventId)?.title} placeholder="Ej. Preparar la presentación" /></label><div className="form-row"><label>Fecha<input name="date" type="date" defaultValue={newEventDate} /></label><label>Hora<input name="time" type="time" defaultValue={newEventTime} /></label></div><div className="form-row"><label>Duración<div className="custom-value-field"><input name="durationValue" type="number" min="0.25" step="0.25" defaultValue={durationParts(formEventId === null ? newEventDuration : events.find((item) => item.id === formEventId)?.duration || '30 min').value} /><select name="durationUnit" defaultValue={durationParts(formEventId === null ? newEventDuration : events.find((item) => item.id === formEventId)?.duration || '30 min').unit}><option value="min">minutos</option><option value="h">horas</option></select></div></label><label>Lugar<input name="place" defaultValue={formEventId === null ? '' : events.find((item) => item.id === formEventId)?.place} placeholder="Opcional" /></label></div><div className="form-row"><label>Flexibilidad<select name="flexibilityMode" value={flexibilityMode} onChange={(event) => setFlexibilityMode(event.target.value as typeof flexibilityMode)}><option value="fixed">Fija</option><option value="minutes">Margen en minutos</option><option value="window">Ventana de fecha y hora</option></select></label>{flexibilityMode === 'minutes' && <label>Margen máximo (min)<input name="flexibilityMinutes" type="number" min="0" max="1440" step="1" defaultValue={formEventId === null ? 0 : events.find((item) => item.id === formEventId)?.flexibilityMinutes || 30} /></label>}</div>{flexibilityMode === 'window' && <div className="form-row"><label>Disponible desde<input name="flexibilityStart" type="datetime-local" defaultValue={formEventId === null ? '' : events.find((item) => item.id === formEventId)?.flexibilityStart || ''} /></label><label>Disponible hasta<input name="flexibilityEnd" type="datetime-local" defaultValue={formEventId === null ? '' : events.find((item) => item.id === formEventId)?.flexibilityEnd || ''} /></label></div>}<div className="form-row"><label>Se repite<select name="recurrence" defaultValue={formEventId === null ? 'No se repite' : events.find((item) => item.id === formEventId)?.recurrence || 'No se repite'}><option>No se repite</option><option>Cada día</option><option>Cada semana</option><option>Cada mes</option></select></label><label>Recordatorio<select name="reminder" value={reminderCustomEnabled ? 'Personalizado' : formEventId === null ? 'Sin recordatorio' : events.find((item) => item.id === formEventId)?.reminder || 'Sin recordatorio'} onChange={(event) => { setReminderCustomEnabled(event.target.value === 'Personalizado'); if (event.target.value !== 'Sin recordatorio') requestNotifications() }}><option>Sin recordatorio</option><option>5 minutos antes</option><option>10 minutos antes</option><option>30 minutos antes</option><option>1 hora antes</option><option>Personalizado</option></select></label></div>{reminderCustomEnabled && <div className="form-row"><label>Recordar con antelación<div className="custom-value-field"><input name="customReminderValue" type="number" min="1" step="1" defaultValue={reminderParts(formEventId === null ? '10 minutos antes' : events.find((item) => item.id === formEventId)?.reminder || '10 minutos antes').value} /><select name="customReminderUnit" defaultValue={reminderParts(formEventId === null ? '10 minutos antes' : events.find((item) => item.id === formEventId)?.reminder || '10 minutos antes').unit}><option value="minutos">minutos</option><option value="horas">horas</option></select></div></label></div>}<button className="modal-submit" type="submit">{formEventId === null ? 'Añadir evento' : 'Guardar cambios'}</button></form></div>
  )
}
