import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { AuthScreen } from './components/AuthScreen'
import type { AuthMode, OAuthProvider } from './components/AuthScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { PlannerApp } from './components/PlannerApp'
import { profileFromUser } from './lib/profile'
import { createLinkCode, LINK_CODE_TTL_MS } from './lib/discord'
import { createEmptyAppSnapshot, mergeAiSettings, readLocalAppSnapshot, snapshotForCloud } from './lib/snapshot'
import { mergeSnapshots } from './lib/snapshot-merge'
import { normalizeSnapshot } from './lib/validate'
import type { AppSnapshot } from './types'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(!supabase)
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [localMode, setLocalMode] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    let active = true
    const client = supabase
    void client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionReady(true)
    })
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setSessionReady(true)
      setAuthMessage('')
      if (!nextSession) setSnapshot(null)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user.id) return
    let active = true
    const client = supabase
    const userId = session.user.id
    const loadSnapshot = async () => {
      try {
        const { data, error } = await client.from('aura_user_data').select('data').eq('user_id', userId).maybeSingle()
        if (error) throw error
        const apiKeyStorageKey = `aura-ai-settings:${userId}`
        // La marca de migración es por cuenta: antes era global del navegador y la segunda
        // cuenta que entraba en el mismo equipo no migraba sus datos locales.
        const migrationKey = `aura-cloud-migration-complete:${userId}`
        const legacyMigration = !data && !localStorage.getItem(migrationKey)
        // Se valida y limpia lo que llega: una fila con JSON raro no debe romper la agenda.
        const fromCloud = normalizeSnapshot(data?.data)
        let loaded = fromCloud ?? (legacyMigration ? readLocalAppSnapshot() : createEmptyAppSnapshot())
        if (legacyMigration) {
          const legacySettings = localStorage.getItem('aura-ai-settings')
          if (legacySettings && !localStorage.getItem(apiKeyStorageKey)) localStorage.setItem(apiKeyStorageKey, legacySettings)
          localStorage.removeItem('aura-ai-settings')
        }
        if (!data) {
          const { error: migrationError } = await client.from('aura_user_data').upsert({ user_id: userId, data: snapshotForCloud(loaded), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          if (migrationError) throw migrationError
        }
        if (!active) return
        localStorage.setItem(migrationKey, 'true')
        loaded = { ...loaded, aiSettings: mergeAiSettings(loaded.aiSettings, apiKeyStorageKey) }
        setSnapshot(loaded)
      } catch (error) {
        if (active) setAuthMessage(error instanceof Error ? error.message : 'No se pudieron cargar tus datos. Revisa el esquema de almacenamiento.')
      }
    }
    void loadSnapshot()
    return () => { active = false }
  }, [session?.user.id])

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setAuthBusy(true)
    setAuthMessage('')
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        if (data.session) setSession(data.session)
        else setAuthMessage('Cuenta creada. Revisa tu correo para confirmar el registro y luego inicia sesión.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        setSession(data.session)
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'No se pudo autenticar la cuenta.')
    } finally {
      setAuthBusy(false)
    }
  }

  const signInWithProvider = async (provider: OAuthProvider) => {
    if (!supabase) { setAuthMessage('Para activar Google o Discord, configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env y reinicia la app.'); return }
    setAuthBusy(true)
    setAuthMessage('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
      if (error) throw error
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : `No se pudo iniciar sesión con ${provider === 'discord' ? 'Discord' : 'Google'}.`)
      setAuthBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) { setLocalMode(false); return }
    const { error } = await supabase.auth.signOut()
    if (error) setAuthMessage(error.message)
    else ['aura-events', 'aura-projects', 'aura-memories', 'aura-conversations', 'aura-active-conversation', 'aura-conversation'].forEach((key) => localStorage.removeItem(key))
  }

  const saveSnapshot = async (data: AppSnapshot) => {
    if (!supabase || !session?.user.id) return
    const userId = session.user.id
    const payload = snapshotForCloud(data)
    // Lee lo último antes de escribir: el bot de Discord (u otro dispositivo) puede haber añadido
    // eventos mientras esta pestaña estaba abierta, y el documento se guarda completo.
    const { data: current, error: readError } = await supabase.from('aura_user_data').select('data').eq('user_id', userId).maybeSingle()
    if (readError) throw readError
    const remote = normalizeSnapshot(current?.data)
    const merged = mergeSnapshots(payload, remote)
    const { error } = await supabase.from('aura_user_data').upsert({ user_id: userId, data: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) throw error
  }

  // Crea un código de un solo uso que la persona escribe en Discord con /vincular.
  const linkDiscord = async () => {
    if (!supabase || !session?.user.id) throw new Error('Inicia sesión para vincular tu cuenta de Discord.')
    const code = createLinkCode()
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString()
    await supabase.from('discord_link_codes').delete().eq('user_id', session.user.id)
    const { error } = await supabase.from('discord_link_codes').insert({ code, user_id: session.user.id, expires_at: expiresAt })
    if (error) throw new Error(`No pude crear el código: ${error.message}. ¿Ejecutaste supabase/discord.sql?`)
    return { code, expiresAt }
  }

  if (localMode) return <PlannerApp onSignOut={() => setLocalMode(false)} />
  if (!sessionReady) return <LoadingScreen title="Comprobando sesión…" />
  if (session && !snapshot && !authMessage) return <LoadingScreen title="Cargando tu agenda…" />
  if (session && snapshot) return <PlannerApp key={session.user.id} snapshot={snapshot} user={profileFromUser(session.user)} localApiKeyStorageKey={`aura-ai-settings:${session.user.id}`} onSignOut={() => { void signOut() }} onSaveSnapshot={saveSnapshot} onLinkDiscord={linkDiscord} />
  if (session && authMessage) return <div className="auth-screen"><div className="auth-panel"><p className="eyebrow">AURA · SINCRONIZACIÓN</p><h1>No se pudo cargar la cuenta</h1><p className="auth-description">{authMessage}</p><button type="button" className="auth-submit" onClick={() => setLocalMode(true)}>Continuar en este dispositivo</button><button type="button" className="auth-mode-button" onClick={() => { void signOut() }}>Cerrar sesión</button></div></div>

  return <AuthScreen authMode={authMode} setAuthMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} authBusy={authBusy} authMessage={authMessage} setAuthMessage={setAuthMessage} signInWithProvider={signInWithProvider} submitAuth={submitAuth} setLocalMode={setLocalMode} />
}

export default App
