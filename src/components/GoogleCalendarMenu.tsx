import type { GoogleCalendarController } from '../hooks/useGoogleCalendar'

const formatTime = (iso: string) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '')

// Controles de Google Calendar dentro del menú de perfil: conectar, sincronizar y desconectar.
export function GoogleCalendarMenu({ google, onClose }: { google: GoogleCalendarController; onClose: () => void }) {
  const { status, syncing, account, lastSync, connect, disconnect, syncNow } = google
  const label = status === 'unconfigured' ? 'Sin configurar: falta VITE_GOOGLE_CLIENT_ID'
    : status === 'disconnected' ? 'No conectado'
    : status === 'expired' ? `${account} · conexión caducada`
    : `${account}${lastSync ? ` · sincronizado ${formatTime(lastSync)}` : ''}`
  return (
    <div className="google-menu">
      <strong>Google Calendar</strong>
      <span>{label}</span>
      {status === 'connected' && <button disabled={syncing} onClick={() => { onClose(); syncNow() }}>{syncing ? 'Sincronizando…' : 'Sincronizar ahora'}</button>}
      {(status === 'disconnected' || status === 'expired') && <button onClick={() => { onClose(); connect() }}>{status === 'expired' ? 'Reconectar Google Calendar' : 'Conectar Google Calendar'}</button>}
      {(status === 'connected' || status === 'expired') && <button onClick={() => { onClose(); disconnect() }}>Desconectar</button>}
      {status === 'unconfigured' && <button onClick={() => { onClose(); connect() }}>Cómo configurarlo</button>}
    </div>
  )
}
