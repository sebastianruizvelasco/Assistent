import { dateFromKey, dateKeyFromDate } from './dates'
import { durationToMinutes, reminderToMinutes } from './schedule'
import type { EventItem, GoogleLink } from '../types'

/* ---------- Tipos de la API de Google Calendar (solo lo que usamos) ---------- */

export type GoogleEvent = {
  id: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  eventType?: string
  summary?: string
  location?: string
  updated?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
  reminders?: { useDefault?: boolean; overrides?: Array<{ method: string; minutes: number }> }
  extendedProperties?: { private?: Record<string, string> }
}

// Campos de un evento de AURA que se pueden importar desde Google.
export type ImportedFields = Pick<EventItem, 'title' | 'date' | 'time' | 'duration' | 'place' | 'category' | 'accent' | 'priority' | 'tag'> & { reminder?: string }

export type SyncPlan = {
  pushNew: EventItem[]
  pushUpdate: Array<{ event: EventItem; googleId: string }>
  pushDelete: string[]
  pullNew: Array<{ g: GoogleEvent; fields: ImportedFields }>
  pullUpdate: Array<{ eventId: number; g: GoogleEvent; fields: ImportedFields; merged: EventItem }>
  pullDelete: Array<{ id: number; googleId: string }>
  // Ids de Google que ya no existen en ningún lado y hay que quitar de la lista de vinculados.
  forget: string[]
  // Eventos que solo necesitan (re)vincularse: { evento local, evento de Google, ¿coinciden ya sus datos? }
  link: Array<{ event: EventItem; g: GoogleEvent }>
  conflicts: number
  skippedUnsupported: number
}

export type SyncOutcome = {
  links: Map<number, GoogleLink>
  patches: Map<number, Partial<EventItem>>
  deleteLocal: number[]
  additions: Array<{ fields: ImportedFields; link: GoogleLink; preferredId?: number }>
  knownIds: string[]
  stats: { created: number; updated: number; deleted: number; imported: number; pulled: number; removedLocal: number; conflicts: number; skipped: number }
  errors: string[]
}

export const SYNC_WINDOW_PAST_DAYS = 30
export const SYNC_WINDOW_FUTURE_DAYS = 400
// Si un sync borraría más eventos que esto (en Google o en AURA) se exige confirmación manual.
export const BULK_DELETE_LIMIT = 5

/* ---------- Conversión de formatos ---------- */

export const minutesToDuration = (minutes: number) => (minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`)

export const reminderFromMinutes = (minutes: number) => {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? 'hora' : 'horas'} antes`
  return `${minutes} minutos antes`
}

// Huella de los campos que se sincronizan: si cambia, el evento cambió localmente.
export const eventHash = (event: Pick<EventItem, 'title' | 'date' | 'time' | 'duration' | 'reminder'>) =>
  [event.title, event.date, event.time, event.duration, event.reminder ?? ''].join('\u241f')

const pad = (value: number) => String(value).padStart(2, '0')
const localIso = (date: Date) => `${dateKeyFromDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`

export const eventEnd = (event: Pick<EventItem, 'date' | 'time' | 'duration'>) => {
  const [hours, minutes] = event.time.split(':').map(Number)
  const start = dateFromKey(event.date)
  start.setHours(hours, minutes, 0, 0)
  return new Date(start.getTime() + Math.max(durationToMinutes(event.duration), 5) * 60_000)
}

export const toGoogleBody = (event: EventItem, timeZone: string) => {
  const [hours, minutes] = event.time.split(':').map(Number)
  const start = dateFromKey(event.date)
  start.setHours(hours, minutes, 0, 0)
  const body: Record<string, unknown> = {
    summary: event.title,
    start: { dateTime: localIso(start), timeZone },
    end: { dateTime: localIso(eventEnd(event)), timeZone },
    extendedProperties: { private: { auraId: String(event.id), auraManaged: '1' } },
  }
  if (event.reminder === 'Sin recordatorio') body.reminders = { useDefault: false, overrides: [] }
  else if (event.reminder) body.reminders = { useDefault: false, overrides: [{ method: 'popup', minutes: Math.min(Math.max(reminderToMinutes(event.reminder), 0), 40320) }] }
  return body
}

// Devuelve null si el evento no se puede representar en AURA (día completo, multidía, sin fechas).
export const fromGoogleEvent = (g: GoogleEvent): ImportedFields | null => {
  if (g.eventType === 'workingLocation') return null
  if (!g.start?.dateTime || !g.end?.dateTime) return null
  const start = new Date(g.start.dateTime)
  const end = new Date(g.end.dateTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  if (minutes > 24 * 60) return null
  const fields: ImportedFields = {
    title: g.summary?.trim() || '(Sin título)',
    date: dateKeyFromDate(start),
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    duration: minutesToDuration(minutes > 0 ? minutes : 30),
    place: g.location?.trim() || 'Google Calendar',
    category: 'personal',
    accent: 'blue',
    priority: 'media',
    tag: 'Google',
  }
  if (g.reminders && !g.reminders.useDefault) {
    const popup = g.reminders.overrides?.find((item) => item.method === 'popup') ?? g.reminders.overrides?.[0]
    fields.reminder = popup ? reminderFromMinutes(popup.minutes) : 'Sin recordatorio'
  }
  return fields
}

export const syncWindow = (now = new Date()) => {
  const min = new Date(now.getFullYear(), now.getMonth(), now.getDate() - SYNC_WINDOW_PAST_DAYS)
  const max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + SYNC_WINDOW_FUTURE_DAYS)
  return { minKey: dateKeyFromDate(min), maxKey: dateKeyFromDate(max), timeMin: min.toISOString(), timeMax: max.toISOString() }
}

// Cambia solo cuando cambia algo que se sincroniza (no los vínculos), para no entrar en bucles.
export const syncSignature = (events: EventItem[]) => events.map((event) => `${event.id}|${eventHash(event)}`).join('\n')

/* ---------- Planificación (pura): qué hay que hacer en cada lado ---------- */

type PlanInput = { local: EventItem[]; remote: GoogleEvent[]; known: string[]; account: string; minKey: string; maxKey: string }

export const planSync = ({ local, remote, known, account, minKey, maxKey }: PlanInput): SyncPlan => {
  const plan: SyncPlan = { pushNew: [], pushUpdate: [], pushDelete: [], pullNew: [], pullUpdate: [], pullDelete: [], forget: [], link: [], conflicts: 0, skippedUnsupported: 0 }
  const inWindow = (key: string) => key >= minKey && key <= maxKey
  const alive = new Map<string, GoogleEvent>()
  const cancelled = new Set<string>()
  const byAura = new Map<string, GoogleEvent>()
  for (const g of remote) {
    if (g.status === 'cancelled') { cancelled.add(g.id); continue }
    alive.set(g.id, g)
    const auraId = g.extendedProperties?.private?.auraId
    if (auraId) byAura.set(auraId, g)
  }

  // Vínculos válidos: de esta cuenta y sin repetir (si dos eventos reclaman el mismo, solo el primero lo conserva).
  const claimed = new Set<string>()
  const linkOf = new Map<number, GoogleLink>()
  for (const event of local) {
    const link = event.google
    if (link && link.account === account && !claimed.has(link.id)) { claimed.add(link.id); linkOf.set(event.id, link) }
  }
  const locallyDeleted = new Set(known.filter((id) => !claimed.has(id)))
  const taken = new Set<string>(claimed)

  for (const event of local) {
    const link = linkOf.get(event.id)
    if (!link) continue
    const g = alive.get(link.id)
    if (g) {
      const fields = fromGoogleEvent(g)
      if (!fields) { plan.skippedUnsupported += 1; continue }
      const remoteChanged = (g.updated ?? '') !== link.updated
      const localChanged = eventHash(event) !== link.hash
      if (remoteChanged) {
        const merged: EventItem = { ...event, title: fields.title, date: fields.date, time: fields.time, duration: fields.duration, ...(fields.reminder !== undefined ? { reminder: fields.reminder } : {}) }
        if (localChanged && eventHash(merged) !== eventHash(event)) plan.conflicts += 1
        if (eventHash(merged) !== eventHash(event)) plan.pullUpdate.push({ eventId: event.id, g, fields, merged })
        else plan.link.push({ event, g })
      } else if (localChanged) plan.pushUpdate.push({ event, googleId: link.id })
    } else if (cancelled.has(link.id) || inWindow(event.date)) {
      plan.pullDelete.push({ id: event.id, googleId: link.id })
    }
  }

  for (const event of local) {
    if (linkOf.has(event.id) || !inWindow(event.date)) continue
    const match = byAura.get(String(event.id))
    if (match && !taken.has(match.id) && !locallyDeleted.has(match.id)) {
      taken.add(match.id)
      const fields = fromGoogleEvent(match)
      if (fields && eventHash({ ...event, ...fields, reminder: fields.reminder ?? event.reminder }) !== eventHash(event)) plan.pushUpdate.push({ event, googleId: match.id })
      else plan.link.push({ event, g: match })
      continue
    }
    plan.pushNew.push(event)
  }

  for (const id of locallyDeleted) (alive.has(id) ? plan.pushDelete : plan.forget).push(id)

  for (const [id, g] of alive) {
    if (taken.has(id) || locallyDeleted.has(id)) continue
    const fields = fromGoogleEvent(g)
    if (!fields) { plan.skippedUnsupported += 1; continue }
    plan.pullNew.push({ g, fields })
  }
  return plan
}

export const planNeedsConfirmation = (plan: SyncPlan) => plan.pushDelete.length > BULK_DELETE_LIMIT || plan.pullDelete.length > BULK_DELETE_LIMIT

export const planIsEmpty = (plan: SyncPlan) => !plan.pushNew.length && !plan.pushUpdate.length && !plan.pushDelete.length && !plan.pullNew.length && !plan.pullUpdate.length && !plan.pullDelete.length && !plan.forget.length && !plan.link.length

/* ---------- Cliente de la API ---------- */

export class GoogleAuthError extends Error {}

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// 429/5xx y los 403 por límite de cuota se reintentan; un 403 de permisos (p. ej. evento de otra persona) no.
const isTemporary = async (response: Response) => {
  if (response.status === 429 || response.status >= 500) return true
  if (response.status !== 403) return false
  try { return /rateLimit|quotaExceeded/i.test(JSON.stringify(await response.clone().json())) } catch { return false }
}

async function request<T>(token: string, url: string, init: RequestInit = {}): Promise<T | null> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } })
    if (response.status === 401) throw new GoogleAuthError('La conexión con Google caducó.')
    if (response.status === 404 || response.status === 410) return null
    if (attempt < 3 && await isTemporary(response)) { await sleep(400 * 2 ** attempt); continue }
    if (!response.ok) {
      let detail = ''
      try { detail = ((await response.json()) as { error?: { message?: string } }).error?.message || '' } catch { detail = '' }
      throw new Error(`Google Calendar respondió ${response.status}${detail ? `: ${detail}` : ''}`)
    }
    return response.status === 204 ? null : ((await response.json()) as T)
  }
}

export const fetchAccountEmail = async (token: string) => {
  const info = await request<{ email?: string }>(token, 'https://www.googleapis.com/oauth2/v3/userinfo')
  if (!info?.email) throw new Error('No pude identificar la cuenta de Google.')
  return info.email.toLowerCase()
}

export const listRemoteEvents = async (token: string, timeMin: string, timeMax: string) => {
  const events: GoogleEvent[] = []
  let pageToken = ''
  do {
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', showDeleted: 'true', maxResults: '250', ...(pageToken ? { pageToken } : {}) })
    const page = await request<{ items?: GoogleEvent[]; nextPageToken?: string }>(token, `${API}?${params}`)
    events.push(...(page?.items ?? []))
    pageToken = page?.nextPageToken ?? ''
  } while (pageToken)
  return events
}

const mapLimit = async <T,>(items: T[], limit: number, work: (item: T) => Promise<void>) => {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const item = items[next]; next += 1; await work(item) }
  }))
}

/* ---------- Ejecución del plan ---------- */

export const executePlan = async (plan: SyncPlan, token: string, account: string, timeZone: string, previouslyKnown: string[]): Promise<SyncOutcome> => {
  const outcome: SyncOutcome = { links: new Map(), patches: new Map(), deleteLocal: [], additions: [], knownIds: [], stats: { created: 0, updated: 0, deleted: 0, imported: 0, pulled: 0, removedLocal: 0, conflicts: plan.conflicts, skipped: plan.skippedUnsupported }, errors: [] }
  const known = new Set(previouslyKnown)
  const makeLink = (g: { id: string; updated?: string }, hash: string): GoogleLink => ({ id: g.id, account, hash, updated: g.updated ?? '' })
  const guard = async (label: string, work: () => Promise<void>) => {
    try { await work() } catch (error) {
      if (error instanceof GoogleAuthError) throw error
      outcome.errors.push(`${label}: ${(error as Error).message}`)
    }
  }

  for (const { event, g } of plan.link) { outcome.links.set(event.id, makeLink(g, eventHash(event))); known.add(g.id) }

  for (const { eventId, g, fields, merged } of plan.pullUpdate) {
    outcome.patches.set(eventId, { title: fields.title, date: fields.date, time: fields.time, duration: fields.duration, ...(fields.reminder !== undefined ? { reminder: fields.reminder } : {}) })
    outcome.links.set(eventId, makeLink(g, eventHash(merged)))
    known.add(g.id)
    outcome.stats.pulled += 1
  }

  for (const { g, fields } of plan.pullNew) {
    const auraId = Number(g.extendedProperties?.private?.auraId)
    const hash = eventHash({ ...fields, reminder: fields.reminder })
    outcome.additions.push({ fields, link: makeLink(g, hash), preferredId: Number.isInteger(auraId) && auraId > 0 ? auraId : undefined })
    known.add(g.id)
    outcome.stats.imported += 1
  }

  for (const { id, googleId } of plan.pullDelete) { outcome.deleteLocal.push(id); known.delete(googleId) }
  for (const id of plan.forget) known.delete(id)
  outcome.stats.removedLocal = plan.pullDelete.length

  await mapLimit(plan.pushNew, 4, (event) => guard(`Crear «${event.title}»`, async () => {
    const created = await request<GoogleEvent>(token, API, { method: 'POST', body: JSON.stringify(toGoogleBody(event, timeZone)) })
    if (!created) return
    outcome.links.set(event.id, makeLink(created, eventHash(event)))
    known.add(created.id)
    outcome.stats.created += 1
  }))

  await mapLimit(plan.pushUpdate, 4, ({ event, googleId }) => guard(`Actualizar «${event.title}»`, async () => {
    const updated = await request<GoogleEvent>(token, `${API}/${encodeURIComponent(googleId)}`, { method: 'PATCH', body: JSON.stringify(toGoogleBody(event, timeZone)) })
    if (!updated) { outcome.errors.push(`Actualizar «${event.title}»: el evento ya no existe en Google.`); return }
    outcome.links.set(event.id, makeLink(updated, eventHash(event)))
    known.add(updated.id)
    outcome.stats.updated += 1
  }))

  await mapLimit(plan.pushDelete, 4, (googleId) => guard('Borrar evento', async () => {
    await request<null>(token, `${API}/${encodeURIComponent(googleId)}`, { method: 'DELETE' })
    known.delete(googleId)
    outcome.stats.deleted += 1
  }))

  outcome.knownIds = [...known]
  return outcome
}

/* ---------- Aplicación del resultado al estado actual (tolera ediciones hechas durante el sync) ---------- */

export const applyOutcome = (current: EventItem[], outcome: SyncOutcome): EventItem[] => {
  const removed = new Set(outcome.deleteLocal)
  const next = current
    .filter((event) => !removed.has(event.id))
    .map((event) => {
      const patch = outcome.patches.get(event.id)
      const link = outcome.links.get(event.id)
      return patch || link ? { ...event, ...patch, ...(link ? { google: link } : {}) } : event
    })
  const used = new Set(next.map((event) => event.id))
  let nextId = Math.max(0, ...next.map((event) => event.id), ...current.map((event) => event.id)) + 1
  for (const { fields, link, preferredId } of outcome.additions) {
    let id = preferredId && !used.has(preferredId) && !current.some((event) => event.id === preferredId) ? preferredId : nextId
    if (id === nextId) nextId += 1
    used.add(id)
    next.push({ ...fields, id, google: link })
  }
  return next
}
