import { dateKeyFromDate } from './lib/dates'
import type { EventItem, Memory, Project } from './types'

export const buildInitialEvents = (): EventItem[] => {
  const today = new Date()
  const todayKey = dateKeyFromDate(today)
  return [
    { id: 1, date: todayKey, time: '09:00', title: 'Revisión de producto', place: 'Sala Nube · Meet', category: 'focus', duration: '45 min', accent: 'blue', priority: 'alta', tag: 'Trabajo' },
    { id: 2, date: todayKey, time: '10:15', title: 'Bloque de trabajo profundo', place: 'Sin interrupciones', category: 'focus', duration: '2 h', accent: 'yellow', priority: 'alta', tag: 'Trabajo' },
    { id: 3, date: todayKey, time: '12:30', title: 'Almuerzo con Elena', place: 'Casa Bonay · 12 min a pie', category: 'personal', duration: '1 h', accent: 'coral', priority: 'media', tag: 'Personal' },
    { id: 4, date: todayKey, time: '14:00', title: 'Llamada con el equipo', place: 'Google Meet', category: 'move', duration: '30 min', accent: 'green', priority: 'alta', tag: 'Trabajo' },
    { id: 5, date: todayKey, time: '16:00', title: 'Pausa y paseo', place: 'Parque de la Ciutadella', category: 'rest', duration: '45 min', accent: 'purple', priority: 'baja', tag: 'Bienestar' },
  ]
}

export const initialProjects: Project[] = [
  { id: 1, name: 'Lanzamiento de AURA', description: 'Producto y experiencia del asistente', progress: 68, color: 'blue', due: '18 sep.' },
  { id: 2, name: 'Casa nueva', description: 'Organizar mudanza y compras', progress: 32, color: 'green', due: '02 oct.' },
  { id: 3, name: 'Aprender italiano', description: 'Rutina de estudio semanal', progress: 45, color: 'yellow', due: 'Continuo' },
]
export const initialMemories: Memory[] = [
  { id: 1, title: 'Cómo trabajo mejor', content: 'Prefiero bloques de concentración por la mañana y reuniones después de comer.', category: 'Preferencias' },
  { id: 2, title: 'Lugares habituales', content: 'Casa Bonay para almuerzos y Parque de la Ciutadella para pasear.', category: 'Contexto' },
  { id: 3, title: 'Ritual de cierre', content: 'Revisar pendientes y preparar el día siguiente antes de las 18:00.', category: 'Rutinas' },
]
