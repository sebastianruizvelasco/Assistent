import { useState, type FormEvent } from 'react'
import { averageProgress, clampProgress, dueStatus, filterProjects, formatDue, PROJECT_COLORS, projectStatus, statusLabel } from '../lib/projects'
import type { Project, ProjectFilter } from '../types'

type ProjectsPanelProps = {
  projects: Project[]
  filter: ProjectFilter
  setFilter: (filter: ProjectFilter) => void
  formOpen: boolean
  setFormOpen: (open: boolean) => void
  onCreate: (formData: FormData) => void
  onUpdate: (id: number, patch: Partial<Project>) => void
  onRemove: (id: number) => void
}

const FILTERS: Array<{ value: ProjectFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'en-curso', label: 'En curso' },
  { value: 'completados', label: 'Completados' },
]

export function ProjectsPanel({ projects, filter, setFilter, formOpen, setFormOpen, onCreate, onUpdate, onRemove }: ProjectsPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const visible = filterProjects(projects, filter)
  const done = projects.filter((project) => projectStatus(project) === 'done').length

  const submitEdit = (event: FormEvent<HTMLFormElement>, project: Project) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    onUpdate(project.id, {
      name: String(formData.get('name') || project.name).trim(),
      description: String(formData.get('description') || '').trim(),
      due: String(formData.get('due') || '').trim(),
      color: String(formData.get('color') || project.color),
    })
    setEditingId(null)
  }

  return (
    <section className="section-hub">
      <div className="hub-header">
        <div>
          <p className="eyebrow">ESPACIO DE TRABAJO</p>
          <h1>Proyectos</h1>
          <p>Convierte tus objetivos en pasos que AURA pueda organizar.</p>
        </div>
        <button className="primary-action" onClick={() => setFormOpen(true)}>+ Nuevo proyecto</button>
      </div>

      <div className="hub-toolbar">
        <div className="hub-filters" role="tablist" aria-label="Filtrar proyectos">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              role="tab"
              aria-selected={filter === option.value}
              className={`hub-chip ${filter === option.value ? 'active' : ''}`}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="hub-summary">
          {projects.length} proyecto{projects.length === 1 ? '' : 's'} · {done} completado{done === 1 ? '' : 's'} · {averageProgress(projects)}% de media
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="hub-empty">
          <strong>{projects.length === 0 ? 'Todavía no hay proyectos' : 'Nada con este filtro'}</strong>
          <p>{projects.length === 0 ? 'Crea el primero y AURA lo tendrá en cuenta al organizar tu día.' : 'Cambia el filtro para ver los demás.'}</p>
        </div>
      ) : (
        <div className="project-grid">
          {visible.map((project) => {
            const status = projectStatus(project)
            const due = dueStatus(project.due)
            return (
              <article className={`project-card ${status === 'done' ? 'is-done' : ''}`} key={project.id}>
                <div className={`project-icon ${project.color}`}>✦</div>
                <div className="project-card-header">
                  <div>
                    <h2>{project.name}</h2>
                    <p>{project.description || 'Sin descripción'}</p>
                  </div>
                  <span className={`project-status ${status}`}>{statusLabel(status)}</span>
                </div>

                {editingId === project.id ? (
                  <form className="project-edit" onSubmit={(event) => submitEdit(event, project)}>
                    <input name="name" defaultValue={project.name} required placeholder="Nombre" />
                    <input name="description" defaultValue={project.description} placeholder="Descripción" />
                    <div className="project-edit-row">
                      <input name="due" type="date" defaultValue={/^\d{4}-\d{2}-\d{2}$/.test(project.due) ? project.due : ''} aria-label="Fecha límite" />
                      <select name="color" defaultValue={project.color} aria-label="Color">
                        {PROJECT_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
                      </select>
                    </div>
                    <div className="project-edit-actions">
                      <button type="button" className="secondary-action" onClick={() => setEditingId(null)}>Cancelar</button>
                      <button type="submit" className="primary-action">Guardar</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="project-progress">
                      <div><span>Progreso</span><strong>{clampProgress(project.progress)}%</strong></div>
                      <div className="progress-track"><span style={{ width: `${clampProgress(project.progress)}%` }} /></div>
                    </div>
                    <div className="project-actions">
                      <button onClick={() => onUpdate(project.id, { progress: clampProgress(project.progress) - 10 })} aria-label={`Bajar 10% en ${project.name}`}>−10%</button>
                      <button onClick={() => onUpdate(project.id, { progress: clampProgress(project.progress) + 10 })} aria-label={`Subir 10% en ${project.name}`}>+10%</button>
                      <button onClick={() => onUpdate(project.id, { progress: 100 })}>Completar</button>
                      <button onClick={() => setEditingId(project.id)}>Editar</button>
                      <button className="danger-link" onClick={() => onRemove(project.id)} aria-label={`Eliminar ${project.name}`}>Eliminar</button>
                    </div>
                    <footer>
                      <span className={due === 'overdue' ? 'due-overdue' : due === 'soon' ? 'due-soon' : ''}>{project.due ? `Entrega: ${formatDue(project.due)}` : 'Sin fecha'}</span>
                    </footer>
                  </>
                )}
              </article>
            )
          })}
        </div>
      )}

      {formOpen && (
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); onCreate(new FormData(event.currentTarget)) }}>
          <div><p className="eyebrow">NUEVO PROYECTO</p><h2>¿En qué estás trabajando?</h2></div>
          <input name="name" autoFocus required placeholder="Nombre del proyecto" />
          <input name="description" placeholder="Descripción breve" />
          <div className="project-edit-row">
            <label>Fecha límite<input name="due" type="date" /></label>
            <label>Color
              <select name="color" defaultValue="blue">
                {PROJECT_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
              </select>
            </label>
          </div>
          <div>
            <button type="button" className="secondary-action" onClick={() => setFormOpen(false)}>Cancelar</button>
            <button className="primary-action" type="submit">Crear proyecto</button>
          </div>
        </form>
      )}
    </section>
  )
}
