import { describe, expect, it } from 'vitest'
import { averageProgress, clampProgress, dueStatus, filterProjects, formatDue, groupMemories, projectStatus, searchMemories } from '../src/lib/projects'
import { dayInsight } from '../src/lib/insight'

const project = (overrides = {}) => ({
  id: 1,
  name: 'Lanzamiento',
  description: 'Producto',
  progress: 0,
  color: 'blue',
  due: '',
  ...overrides,
})

describe('clampProgress', () => {
  it('acota entre 0 y 100 y redondea', () => {
    expect(clampProgress(-20)).toBe(0)
    expect(clampProgress(150)).toBe(100)
    expect(clampProgress(42.6)).toBe(43)
    expect(clampProgress(Number.NaN)).toBe(0)
  })
})

describe('projectStatus', () => {
  it('distingue sin empezar, en curso y completado', () => {
    expect(projectStatus(project({ progress: 0 }))).toBe('todo')
    expect(projectStatus(project({ progress: 30 }))).toBe('active')
    expect(projectStatus(project({ progress: 100 }))).toBe('done')
  })
})

describe('filterProjects', () => {
  const list = [project({ id: 1, progress: 0 }), project({ id: 2, progress: 50 }), project({ id: 3, progress: 100 })]
  it('separa completados del resto', () => {
    expect(filterProjects(list, 'completados').map((item) => item.id)).toEqual([3])
    expect(filterProjects(list, 'en-curso').map((item) => item.id)).toEqual([1, 2])
    expect(filterProjects(list, 'todos')).toHaveLength(3)
  })
})

describe('averageProgress', () => {
  it('calcula la media y evita dividir por cero', () => {
    expect(averageProgress([])).toBe(0)
    expect(averageProgress([project({ progress: 0 }), project({ progress: 100 })])).toBe(50)
  })
})

describe('formatDue', () => {
  it('formatea fechas ISO y respeta el texto libre', () => {
    expect(formatDue('2026-11-18')).toMatch(/18/)
    expect(formatDue('18 sep.')).toBe('18 sep.')
  })
})

describe('dueStatus', () => {
  const now = new Date('2026-10-28T10:00:00')
  it('marca vencido, próximo y lejano', () => {
    expect(dueStatus('2026-10-20', now)).toBe('overdue')
    expect(dueStatus('2026-11-01', now)).toBe('soon')
    expect(dueStatus('2026-12-20', now)).toBe('later')
    expect(dueStatus('', now)).toBe('none')
  })
})

describe('searchMemories', () => {
  const memories = [
    { id: 1, title: 'Cómo trabajo mejor', content: 'Bloques por la mañana', category: 'Preferencias' },
    { id: 2, title: 'Lugares', content: 'Casa Bonay para almuerzos', category: 'Contexto' },
  ]
  it('busca sin acentos ni mayúsculas', () => {
    expect(searchMemories(memories, 'manana')).toHaveLength(1)
    expect(searchMemories(memories, 'bonay')).toHaveLength(1)
  })
  it('devuelve todo si no hay consulta', () => {
    expect(searchMemories(memories, '  ')).toHaveLength(2)
  })
})

describe('groupMemories', () => {
  it('agrupa por categoría conservando el orden', () => {
    const groups = groupMemories([
      { id: 1, title: 'A', content: '', category: 'Rutinas' },
      { id: 2, title: 'B', content: '', category: 'Contexto' },
      { id: 3, title: 'C', content: '', category: 'Rutinas' },
    ])
    expect([...groups.keys()]).toEqual(['Rutinas', 'Contexto'])
    expect(groups.get('Rutinas')).toHaveLength(2)
  })
})

describe('dayInsight', () => {
  const base = { id: 1, date: '2026-10-28', time: '09:00', title: 'Reunión', place: '', category: 'focus' as const, duration: '1 h', accent: 'blue' }

  it('avisa cuando el día está vacío', () => {
    expect(dayInsight([], '2026-10-28')).toMatch(/nada agendado/i)
  })

  it('calcula el hueco libre', () => {
    expect(dayInsight([base], '2026-10-28')).toMatch(/libres/i)
  })

  it('avisa cuando hay más horas que un día', () => {
    const long = Array.from({ length: 14 }, (_, index) => ({ ...base, id: index + 1, duration: '1 h' }))
    expect(dayInsight(long, '2026-10-28')).toMatch(/más de las que caben/i)
  })
})
