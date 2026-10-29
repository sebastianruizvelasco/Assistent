import { useState, type FormEvent } from 'react'
import { groupMemories, MEMORY_CATEGORIES, searchMemories } from '../lib/projects'
import type { Memory } from '../types'

type MemoriesPanelProps = {
  memories: Memory[]
  formOpen: boolean
  setFormOpen: (open: boolean) => void
  onCreate: (formData: FormData) => void
  onUpdate: (id: number, patch: Partial<Memory>) => void
  onRemove: (id: number) => void
}

export function MemoriesPanel({ memories, formOpen, setFormOpen, onCreate, onUpdate, onRemove }: MemoriesPanelProps) {
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const visible = searchMemories(memories, query)
  const groups = groupMemories(visible)

  const submitEdit = (event: FormEvent<HTMLFormElement>, memory: Memory) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    onUpdate(memory.id, {
      title: String(formData.get('title') || memory.title).trim(),
      content: String(formData.get('content') || '').trim(),
      category: String(formData.get('category') || memory.category),
    })
    setEditingId(null)
  }

  return (
    <section className="section-hub">
      <div className="hub-header">
        <div>
          <p className="eyebrow">LO QUE AURA RECUERDA</p>
          <h1>Memoria</h1>
          <p>Contexto personal para que tus decisiones no empiecen de cero.</p>
        </div>
        <button className="primary-action" onClick={() => setFormOpen(true)}>+ Guardar memoria</button>
      </div>

      <div className="hub-toolbar">
        <input
          className="hub-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar en tus memorias…"
          aria-label="Buscar en tus memorias"
        />
        <p className="hub-summary">
          {memories.length} memoria{memories.length === 1 ? '' : 's'}
          {query ? ` · ${visible.length} coincidencia${visible.length === 1 ? '' : 's'}` : ''}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="hub-empty">
          <strong>{memories.length === 0 ? 'AURA todavía no sabe nada de ti' : 'Sin coincidencias'}</strong>
          <p>{memories.length === 0 ? 'Guarda cómo trabajas, tus sitios habituales o lo que no quieres olvidar; el asistente lo usará al proponerte horarios.' : 'Prueba con otra palabra.'}</p>
        </div>
      ) : (
        [...groups.entries()].map(([category, list]) => (
          <div className="memory-group" key={category}>
            <h2 className="memory-group-title">{category}</h2>
            <div className="memory-list">
              {list.map((memory) => (
                <article className="memory-card" key={memory.id}>
                  <div className="memory-symbol">⌁</div>
                  {editingId === memory.id ? (
                    <form className="memory-edit" onSubmit={(event) => submitEdit(event, memory)}>
                      <input name="title" defaultValue={memory.title} required placeholder="Título" />
                      <textarea name="content" defaultValue={memory.content} placeholder="Contenido" />
                      <select name="category" defaultValue={memory.category} aria-label="Categoría">
                        {MEMORY_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <div className="project-edit-actions">
                        <button type="button" className="secondary-action" onClick={() => setEditingId(null)}>Cancelar</button>
                        <button type="submit" className="primary-action">Guardar</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div>
                        <span>{memory.category}</span>
                        <h2>{memory.title}</h2>
                        <p>{memory.content}</p>
                      </div>
                      <div className="memory-actions">
                        <button onClick={() => setEditingId(memory.id)}>Editar</button>
                        <button className="danger-link" onClick={() => onRemove(memory.id)} aria-label={`Eliminar ${memory.title}`}>Eliminar</button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          </div>
        ))
      )}

      {formOpen && (
        <form className="inline-form memory-form" onSubmit={(event) => { event.preventDefault(); onCreate(new FormData(event.currentTarget)) }}>
          <div><p className="eyebrow">NUEVA MEMORIA</p><h2>¿Qué debería recordar AURA?</h2></div>
          <input name="title" autoFocus required placeholder="Título" />
          <textarea name="content" placeholder="Escribe el contexto que quieres conservar…" />
          <label className="hub-field">Categoría
            <select name="category" defaultValue="General">
              {MEMORY_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div>
            <button type="button" className="secondary-action" onClick={() => setFormOpen(false)}>Cancelar</button>
            <button className="primary-action" type="submit">Guardar memoria</button>
          </div>
        </form>
      )}
    </section>
  )
}
