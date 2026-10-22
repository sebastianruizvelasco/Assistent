// Autorización con Google Identity Services (flujo de token en el navegador, sin servidor ni secreto).

export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email'
export const googleClientId: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || ''

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string }
type TokenClient = { requestAccessToken: (options?: { prompt?: string; hint?: string }) => void }
type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        hint?: string
        callback: (response: TokenResponse) => void
        error_callback?: (error: { type: string }) => void
      }) => TokenClient
      hasGrantedAllScopes: (response: TokenResponse, ...scopes: string[]) => boolean
      revoke: (token: string, done?: () => void) => void
    }
  }
}

declare global {
  interface Window { google?: GoogleIdentity }
}

export type GoogleToken = { accessToken: string; expiresAt: number }

let scriptPromise: Promise<void> | null = null

export const loadGoogleScript = () => {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => { scriptPromise = null; reject(new Error('No se pudo cargar el servicio de acceso de Google. Revisa tu conexión.')) }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export async function requestGoogleToken(options: { hint?: string } = {}): Promise<GoogleToken> {
  if (!googleClientId) throw new Error('Falta VITE_GOOGLE_CLIENT_ID en el archivo .env.')
  await loadGoogleScript()
  const oauth2 = window.google!.accounts.oauth2
  return new Promise<GoogleToken>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: googleClientId,
      scope: GOOGLE_SCOPES,
      ...(options.hint ? { hint: options.hint } : {}),
      callback: (response) => {
        if (!response.access_token) { reject(new Error(response.error_description || 'Google no concedió el acceso.')); return }
        if (!oauth2.hasGrantedAllScopes(response, ...GOOGLE_SCOPES.split(' '))) { reject(new Error('Faltó marcar el permiso de Calendar al autorizar. Inténtalo de nuevo y deja todas las casillas marcadas.')); return }
        resolve({ accessToken: response.access_token, expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 })
      },
      error_callback: (error) => reject(new Error(
        error.type === 'popup_closed' ? 'Cerraste la ventana de Google antes de terminar.'
        : error.type === 'popup_failed_to_open' ? 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio.'
        : 'No se pudo conectar con Google.')),
    })
    client.requestAccessToken({ prompt: '', ...(options.hint ? { hint: options.hint } : {}) })
  })
}

export const revokeGoogleToken = (token: string) => new Promise<void>((resolve) => {
  const timer = window.setTimeout(resolve, 1500)
  try { window.google?.accounts.oauth2.revoke(token, () => { window.clearTimeout(timer); resolve() }) } catch { window.clearTimeout(timer); resolve() }
})
