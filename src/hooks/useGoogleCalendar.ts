import { useEffect, useRef, useState } from 'react'
import { applyOutcome, executePlan, fetchAccountEmail, GoogleAuthError, listRemoteEvents, planIsEmpty, planNeedsConfirmation, planSync, syncSignature, syncWindow } from '../lib/googleCalendar'
import type { SyncOutcome, SyncPlan } from '../lib/googleCalendar'
import { googleClientId, loadGoogleScript, requestGoogleToken, revokeGoogleToken } from '../lib/googleAuth'
import type { GoogleToken } from '../lib/googleAuth'
import type { EventItem } from '../types'

export type GoogleStatus = 'unconfigured' | 'disconnected' | 'connected' | 'expired'

export type GoogleCalendarController = {
  status: GoogleStatus
  syncing: boolean
  account: string
  lastSync: string
  connect: () => void
  disconnect: () => void
  syncNow: () => void
}

type Params = {
  events: EventItem[]
  setEvents: (update: (current: EventItem[]) => EventItem[]) => void
  showNotice: (text: string) => void
  confirmAction: (message: string, action: () => void) => void
  timeZone: string
}

type Mode = 'auto' | 'manual' | 'confirmed'

const SESSION_KEY = 'aura-google-session'
const LAST_SYNC_KEY = 'aura-google-last-sync'
const knownKey = (account: string) => `aura-google-known:${account}`
const AUTO_DELAY_MS = 4000
const POLL_MS = 5 * 60 * 1000

const readJson = <T,>(key: string): T | null => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null } catch { return null }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

const describeOutcome = (outcome: SyncOutcome) => {
  const s = outcome.stats
  const parts: Array<[number, string]> = [
    [s.created, 'enviados a Google'], [s.updated, 'actualizados en Google'], [s.deleted, 'borrados en Google'],
    [s.imported, 'importados'], [s.pulled, 'actualizados desde Google'], [s.removedLocal, 'borrados aquí'],
  ]
  return parts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`).join(' · ')
}

const confirmationMessage = (plan: SyncPlan, first: boolean) => {
  const bits: string[] = []
  if (plan.pushNew.length) bits.push(`enviar ${plural(plan.pushNew.length, 'evento', 'eventos')} de AURA a Google`)
  if (plan.pullNew.length) bits.push(`importar ${plural(plan.pullNew.length, 'evento', 'eventos')} de Google`)
  if (plan.pushDelete.length) bits.push(`borrar ${plural(plan.pushDelete.length, 'evento', 'eventos')} en Google Calendar`)
  if (plan.pullDelete.length) bits.push(`borrar ${plural(plan.pullDelete.length, 'evento', 'eventos')} de AURA que ya no están en Google`)
  return `${first ? 'Primera sincronización con Google Calendar' : 'Sincronización grande'}: se va a ${bits.join(', ')}. ¿Continuar?`
}

// Sincronización de dos vías con Google Calendar (calendario principal).
export function useGoogleCalendar({ events, setEvents, showNotice, confirmAction, timeZone }: Params): GoogleCalendarController {
  const configured = Boolean(googleClientId)
  const savedAccount = readJson<{ account: string }>(SESSION_KEY)?.account || ''
  const [status, setStatus] = useState<GoogleStatus>(!configured ? 'unconfigured' : savedAccount ? 'expired' : 'disconnected')
  const [account, setAccount] = useState(savedAccount)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(() => localStorage.getItem(LAST_SYNC_KEY) || '')

  const tokenRef = useRef<GoogleToken | null>(null)
  const accountRef = useRef(savedAccount)
  const eventsRef = useRef(events)
  const syncingRef = useRef(false)
  const queuedRef = useRef(false)
  const announcedRef = useRef(false)
  const runSyncRef = useRef<(mode: Mode) => Promise<void>>(async () => {})
  useEffect(() => { eventsRef.current = events })

  const markExpired = () => { tokenRef.current = null; setStatus((current) => (current === 'connected' ? 'expired' : current)) }

  const runSync = async (mode: Mode) => {
    if (syncingRef.current) { queuedRef.current = true; return }
    const token = tokenRef.current
    const who = accountRef.current
    if (!token || !who || Date.now() > token.expiresAt - 30_000) {
      markExpired()
      if (mode !== 'auto') showNotice('La conexión con Google caducó. Abre tu perfil y pulsa «Reconectar Google Calendar».')
      return
    }
    syncingRef.current = true
    setSyncing(true)
    try {
      const range = syncWindow()
      const remote = await listRemoteEvents(token.accessToken, range.timeMin, range.timeMax)
      const known = readJson<string[]>(knownKey(who))
      const first = known === null
      const plan = planSync({ local: eventsRef.current, remote, known: known ?? [], account: who, minKey: range.minKey, maxKey: range.maxKey })

      if (mode !== 'confirmed' && (first || planNeedsConfirmation(plan)) && !planIsEmpty(plan)) {
        if (mode === 'auto') {
          if (!announcedRef.current) { announcedRef.current = true; showNotice('Google Calendar: hay cambios grandes pendientes. Abre tu perfil y pulsa «Sincronizar ahora».') }
        } else confirmAction(confirmationMessage(plan, first), () => { void runSyncRef.current('confirmed') })
        return
      }

      const outcome = planIsEmpty(plan) ? null : await executePlan(plan, token.accessToken, who, timeZone, known ?? [])
      if (outcome) setEvents((current) => applyOutcome(current, outcome))
      localStorage.setItem(knownKey(who), JSON.stringify(outcome ? outcome.knownIds : known ?? []))
      const stamp = new Date().toISOString()
      localStorage.setItem(LAST_SYNC_KEY, stamp)
      setLastSync(stamp)
      announcedRef.current = false

      const summary = outcome ? describeOutcome(outcome) : ''
      if (outcome?.errors.length) showNotice(`Google Calendar: ${summary ? `${summary}. ` : ''}${plural(outcome.errors.length, 'error', 'errores')} — ${outcome.errors[0]}`)
      else if (summary) showNotice(`Google Calendar: ${summary}.`)
      else if (mode !== 'auto') showNotice('Google Calendar: todo está al día.')
    } catch (error) {
      if (error instanceof GoogleAuthError) {
        markExpired()
        if (mode !== 'auto') showNotice('La conexión con Google caducó. Reconecta desde tu perfil.')
      } else if (mode !== 'auto') showNotice(`Google Calendar: ${(error as Error).message}`)
    } finally {
      syncingRef.current = false
      setSyncing(false)
      if (queuedRef.current) { queuedRef.current = false; window.setTimeout(() => { void runSyncRef.current('auto') }, AUTO_DELAY_MS) }
    }
  }
  useEffect(() => { runSyncRef.current = runSync })

  const connect = () => {
    if (!configured) { showNotice('Falta configurar VITE_GOOGLE_CLIENT_ID. Mira el README para crearlo.'); return }
    void (async () => {
      try {
        const token = await requestGoogleToken({ hint: accountRef.current || undefined })
        const email = await fetchAccountEmail(token.accessToken)
        tokenRef.current = token
        accountRef.current = email
        setAccount(email)
        localStorage.setItem(SESSION_KEY, JSON.stringify({ account: email }))
        setStatus('connected')
        await runSyncRef.current('manual')
      } catch (error) {
        showNotice(`Google Calendar: ${(error as Error).message}`)
      }
    })()
  }

  const disconnect = () => {
    const token = tokenRef.current
    if (token) void revokeGoogleToken(token.accessToken)
    if (accountRef.current) localStorage.removeItem(knownKey(accountRef.current))
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(LAST_SYNC_KEY)
    tokenRef.current = null
    accountRef.current = ''
    setAccount('')
    setLastSync('')
    setStatus('disconnected')
    showNotice('Google Calendar desconectado. Tus eventos siguen en AURA y en Google.')
  }

  // Precarga el script para que el botón «Conectar» abra la ventana de Google sin demora.
  useEffect(() => { if (configured) void loadGoogleScript().catch(() => undefined) }, [configured])

  // Aviso cuando el token (dura ~1 h) está a punto de caducar.
  useEffect(() => {
    if (status !== 'connected' || !tokenRef.current) return
    const timer = window.setTimeout(markExpired, Math.max(tokenRef.current.expiresAt - Date.now() - 30_000, 0))
    return () => window.clearTimeout(timer)
  }, [status])

  // Sincroniza poco después de que cambie algo sincronizable, y cada 5 minutos para traer cambios de Google.
  const signature = syncSignature(events)
  useEffect(() => {
    if (status !== 'connected') return
    const timer = window.setTimeout(() => { void runSyncRef.current('auto') }, AUTO_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [signature, status])
  useEffect(() => {
    if (status !== 'connected') return
    const timer = window.setInterval(() => { void runSyncRef.current('auto') }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [status])

  return { status, syncing, account, lastSync, connect, disconnect, syncNow: () => { void runSync('manual') } }
}
