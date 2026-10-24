import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { GoogleCalendarController } from '../hooks/useGoogleCalendar'
import type { UserProfile } from '../lib/profile'
import { GoogleCalendarMenu } from './GoogleCalendarMenu'

function Avatar({ user, large = false }: { user: UserProfile; large?: boolean }) {
  const [broken, setBroken] = useState(false)
  const className = `avatar${large ? ' avatar-large' : ''}`
  if (user.avatarUrl && !broken) return <img className={className} src={user.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  return <span className={className} aria-hidden="true">{user.initials}</span>
}

type UserMenuProps = {
  user: UserProfile
  google: GoogleCalendarController
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  onSignOut: () => void
}

// Botón con el nombre del usuario y su menú: cuenta, Google Calendar y cerrar/iniciar sesión.
export function UserMenu({ user, google, open, setOpen, onSignOut }: UserMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  // Se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => { if (!wrapRef.current?.contains(event.target as Node)) setOpen(false) }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('mousedown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open, setOpen])

  return (
    <div className="profile-wrap" ref={wrapRef}>
      <button className="user-chip" aria-label={`Menú de usuario: ${user.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Avatar user={user} />
        <span className="user-chip-name">{user.firstName}</span>
        <span className="user-chip-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="profile-menu" role="menu">
          <div className="user-card">
            <Avatar user={user} large />
            <div>
              <strong>{user.name}</strong>
              {user.email && <span>{user.email}</span>}
              <em className="user-badge">{user.signedIn ? 'Cuenta sincronizada' : 'Solo en este dispositivo'}</em>
            </div>
          </div>
          <GoogleCalendarMenu google={google} onClose={() => setOpen(false)} />
          <button onClick={() => { setOpen(false); onSignOut() }}>{user.signedIn ? 'Cerrar sesión' : 'Iniciar sesión'}</button>
        </div>
      )}
    </div>
  )
}
