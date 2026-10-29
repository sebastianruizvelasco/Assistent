import type { Memory, Project, ProjectFilter } from '../types'
import { normalizeText } from './text'

// Lógica pura del panel de proyectos y memorias: sin React, para poder probarla.

export const PROJECT_COLORS = ['blue', 'green', 'yellow', 'coral', 'purple'] as const
export const MEMORY_CATEGORIES = ['Preferencias', 'Contexto', 'Rutinas', 'Personas', 'Trabajo', 'Ideas', 'General'] as const

export type ProjectStatus = 'todo' | 'active' | 'done'

export const clampProgress = (value: number) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.min(100, Math.max(0, Math.round(number)))
}

export const projectStatus = (project: Pick<Project, 'progress'>): ProjectStatus => {
  if (project.progress >= 100) return 'done'
  return project.progress > 0 ? 'active' : 'todo'
}

export const statusLabel = (status: ProjectStatus) => (status === 'done' ? 'Completado' : status === 'active' ? 'En curso' : 'Sin empezar')

export const filterProjects = (projects: Project[], filter: ProjectFilter) => {
  if (filter === 'en-curso') return projects.filter((project) => projectStatus(project) === 'active' || projectStatus(project) === 'todo')
  if (filter === 'completados') return projects.filter((project) => projectStatus(project) === 'done')
  return projects
}

export const averageProgress = (projects: Project[]) => {
  if (!projects.length) return 0
  return Math.round(projects.reduce((total, project) => total + clampProgress(project.progress), 0) / projects.length)
}

export const nextProjectId = (projects: Project[]) => Math.max(0, ...projects.map((project) => Number(project.id) || 0)) + 1
export const nextMemoryId = (memories: Memory[]) => Math.max(0, ...memories.map((memory) => Number(memory.id) || 0)) + 1

// Acepta «2026-11-18» y devuelve la etiqueta corta; si es texto libre, se respeta.
export const formatDue = (due: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return due
  const [year, month, day] = due.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return due
  const label = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
  return label
}

// Para pintar en rojo lo vencido y en ámbar lo que vence esta semana.
export const dueStatus = (due: string, now = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return 'none' as const
  const [year, month, day] = due.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  if (Number.isNaN(target.getTime())) return 'none' as const
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return 'overdue' as const
  if (days <= 7) return 'soon' as const
  return 'later' as const
}

export const searchMemories = (memories: Memory[], query: string) => {
  const needle = normalizeText(query)
  if (!needle) return memories
  return memories.filter((memory) => normalizeText(`${memory.title} ${memory.content} ${memory.category}`).includes(needle))
}

// Agrupa por categoría conservando el orden de llegada.
export const groupMemories = (memories: Memory[]) => {
  const groups = new Map<string, Memory[]>()
  for (const memory of memories) {
    const key = memory.category || 'General'
    groups.set(key, [...(groups.get(key) || []), memory])
  }
  return groups
}

export const parseDueFromForm = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.trim())
