import { MemoriesPanel } from './MemoriesPanel'
import { ProjectsPanel } from './ProjectsPanel'
import type { Memory, Project, ProjectFilter } from '../types'

type SectionHubProps = {
  activeSection: string
  projects: Project[]
  projectFilter: ProjectFilter
  setProjectFilter: (filter: ProjectFilter) => void
  projectFormOpen: boolean
  setProjectFormOpen: (open: boolean) => void
  addProject: (formData: FormData) => void
  updateProject: (id: number, patch: Partial<Project>) => void
  removeProject: (id: number) => void
  memories: Memory[]
  memoryFormOpen: boolean
  setMemoryFormOpen: (open: boolean) => void
  addMemory: (formData: FormData) => void
  updateMemory: (id: number, patch: Partial<Memory>) => void
  removeMemory: (id: number) => void
}

// Elige el panel de la sección activa. «Mi día» lo pinta el calendario, no este componente.
export function SectionHub({
  activeSection, projects, projectFilter, setProjectFilter, projectFormOpen, setProjectFormOpen,
  addProject, updateProject, removeProject, memories, memoryFormOpen, setMemoryFormOpen,
  addMemory, updateMemory, removeMemory,
}: SectionHubProps) {
  if (activeSection === 'Proyectos') {
    return (
      <ProjectsPanel
        projects={projects}
        filter={projectFilter}
        setFilter={setProjectFilter}
        formOpen={projectFormOpen}
        setFormOpen={setProjectFormOpen}
        onCreate={addProject}
        onUpdate={updateProject}
        onRemove={removeProject}
      />
    )
  }
  if (activeSection === 'Memoria') {
    return (
      <MemoriesPanel
        memories={memories}
        formOpen={memoryFormOpen}
        setFormOpen={setMemoryFormOpen}
        onCreate={addMemory}
        onUpdate={updateMemory}
        onRemove={removeMemory}
      />
    )
  }
  return null
}
