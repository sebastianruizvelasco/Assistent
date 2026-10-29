import { durationToMinutes } from './schedule'
import type { EventItem } from '../types'

// Texto corto del panel del asistente: antes era una frase fija («Tu tarde tiene 45 min de margen»)
// que no tenía nada que ver con la agenda real.

const DAY_WINDOW_MINUTES = 12 * 60 // de 08:00 a 20:00

export const dayInsight = (events: EventItem[], dateKey: string) => {
  const day = events.filter((event) => event.date === dateKey)
  if (!day.length) return 'No hay nada agendado. Buen momento para adelantar un proyecto o descansar.'

  const pending = day.filter((event) => !event.completed)
  const planned = pending.reduce((total, event) => total + durationToMinutes(event.duration), 0)
  const free = DAY_WINDOW_MINUTES - planned

  if (planned > DAY_WINDOW_MINUTES) return `Hay ${Math.round(planned / 60)} h planificadas: más de las que caben en un día. Conviene mover algo.`
  if (free >= 120) return `Quedan unas ${Math.floor(free / 60)} h libres. Buen hueco para un bloque de concentración.`
  if (free >= 45) return `Quedan ${free} minutos libres: suficiente para cerrar un pendiente corto.`
  if (pending.length === 0) return 'Todo lo de hoy está completado.'
  return 'El día está bastante lleno. Deja un margen entre tareas.'
}
