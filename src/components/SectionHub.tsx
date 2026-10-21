import { type Dispatch, type SetStateAction } from 'react'
import type { Memory, Project } from '../types'

type SectionHubProps = {
  activeSection: string
  setProjectFormOpen: Dispatch<SetStateAction<boolean>>
  projects: Project[]
  projectFormOpen: boolean
  addProject: (formData: FormData) => void
  setMemoryFormOpen: Dispatch<SetStateAction<boolean>>
  memories: Memory[]
  memoryFormOpen: boolean
  addMemory: (formData: FormData) => void
}

export function SectionHub({
  activeSection, setProjectFormOpen, projects, projectFormOpen, addProject, setMemoryFormOpen,
  memories, memoryFormOpen, addMemory
}: SectionHubProps) {
  return (
    activeSection === 'Proyectos' ? <section className="section-hub"><div className="hub-header"><div><p className="eyebrow">ESPACIO DE TRABAJO</p><h1>Proyectos</h1><p>Convierte tus objetivos en pasos que AURA pueda organizar.</p></div><button className="primary-action" onClick={() => setProjectFormOpen(true)}>+ Nuevo proyecto</button></div><div className="project-grid">{projects.map((project) => <article className="project-card" key={project.id}><div className={`project-icon ${project.color}`}>✦</div><div className="project-card-header"><div><h2>{project.name}</h2><p>{project.description}</p></div><button className="more-button" aria-label={`Opciones de ${project.name}`}>•••</button></div><div className="project-progress"><div><span>Progreso</span><strong>{project.progress}%</strong></div><div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div></div><footer><span>{project.due}</span><span>{project.progress === 100 ? 'Completado' : 'En curso'}</span></footer></article>)}</div>{projectFormOpen && <form className="inline-form" onSubmit={(event) => { event.preventDefault(); addProject(new FormData(event.currentTarget)) }}><div><p className="eyebrow">NUEVO PROYECTO</p><h2>¿En qué estás trabajando?</h2></div><input name="name" autoFocus placeholder="Nombre del proyecto" /><input name="description" placeholder="Descripción breve" /><div><button type="button" className="secondary-action" onClick={() => setProjectFormOpen(false)}>Cancelar</button><button className="primary-action" type="submit">Crear proyecto</button></div></form>}</section> : <section className="section-hub"><div className="hub-header"><div><p className="eyebrow">LO QUE AURA RECUERDA</p><h1>Memoria</h1><p>Contexto personal para que tus decisiones no empiecen de cero.</p></div><button className="primary-action" onClick={() => setMemoryFormOpen(true)}>+ Guardar memoria</button></div><div className="memory-list">{memories.map((memory) => <article className="memory-card" key={memory.id}><div className="memory-symbol">⌁</div><div><span>{memory.category}</span><h2>{memory.title}</h2><p>{memory.content}</p></div><button className="more-button" aria-label={`Opciones de ${memory.title}`}>•••</button></article>)}</div>{memoryFormOpen && <form className="inline-form memory-form" onSubmit={(event) => { event.preventDefault(); addMemory(new FormData(event.currentTarget)) }}><div><p className="eyebrow">NUEVA MEMORIA</p><h2>¿Qué debería recordar AURA?</h2></div><input name="title" autoFocus placeholder="Título" /><textarea name="content" placeholder="Escribe el contexto que quieres conservar..." /><div><button type="button" className="secondary-action" onClick={() => setMemoryFormOpen(false)}>Cancelar</button><button className="primary-action" type="submit">Guardar memoria</button></div></form>}</section>
  )
}
