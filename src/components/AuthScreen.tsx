import { type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { supabase } from '../supabase'

export type AuthMode = 'signin' | 'signup'

type AuthScreenProps = {
  authMode: AuthMode
  setAuthMode: Dispatch<SetStateAction<AuthMode>>
  email: string
  setEmail: Dispatch<SetStateAction<string>>
  password: string
  setPassword: Dispatch<SetStateAction<string>>
  authBusy: boolean
  authMessage: string
  setAuthMessage: Dispatch<SetStateAction<string>>
  signInWithGoogle: () => Promise<void>
  submitAuth: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setLocalMode: Dispatch<SetStateAction<boolean>>
}

// Pantalla de acceso: correo/contraseña, Google o modo solo en este dispositivo.
export function AuthScreen({
  authMode, setAuthMode, email, setEmail, password, setPassword, authBusy, authMessage,
  setAuthMessage, signInWithGoogle, submitAuth, setLocalMode,
}: AuthScreenProps) {
  return (
    <div className="auth-screen"><section className="auth-panel"><div className="auth-brand"><span className="brand-mark">a</span><div><strong>AURA</strong><small>Tu agenda, contigo</small></div></div><p className="eyebrow">CUENTA PERSONAL</p><h1>{supabase ? authMode === 'signin' ? 'Inicia sesión' : 'Crea tu cuenta' : 'Guarda tu agenda'}</h1><p className="auth-description">{supabase ? 'Accede a tus eventos, proyectos y memorias desde tus dispositivos.' : 'Configura Supabase para activar cuentas y sincronización. También puedes continuar guardando todo en este dispositivo.'}</p>
    <button className="google-signin" type="button" disabled={authBusy} onClick={() => { void signInWithGoogle() }}><span aria-hidden="true">G</span>Continuar con Google</button>
    {supabase && <form className="auth-form" onSubmit={(event) => { void submitAuth(event) }}><label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label><label>Contraseña<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" /></label><button className="auth-submit" disabled={authBusy} type="submit">{authBusy ? 'Un momento…' : authMode === 'signin' ? 'Entrar' : 'Crear cuenta'}</button><button className="auth-mode-button" type="button" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthMessage('') }}>{authMode === 'signin' ? 'Crear una cuenta' : 'Ya tengo cuenta'}</button></form>}
    {!supabase && <button className="auth-submit" type="button" onClick={() => setLocalMode(true)}>Continuar en este dispositivo</button>}
    {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
    {supabase && <button className="auth-mode-button" type="button" onClick={() => setLocalMode(true)}>Usar solo este dispositivo</button>}
  </section></div>
  )
}
