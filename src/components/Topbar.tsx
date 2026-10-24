import type { GoogleCalendarController } from '../hooks/useGoogleCalendar'
import type { UserProfile } from '../lib/profile'
import { UserMenu } from './UserMenu'
import { type Dispatch, type SetStateAction } from 'react'

type TopbarProps = {
  google: GoogleCalendarController
  activeSection: string
  setActiveSection: Dispatch<SetStateAction<string>>
  showNotice: (text: string) => void
  searchOpen: boolean
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  setSearchOpen: Dispatch<SetStateAction<boolean>>
  darkMode: boolean
  toggleTheme: () => void
  setProfileOpen: Dispatch<SetStateAction<boolean>>
  profileOpen: boolean
  user: UserProfile
  onSignOut: (() => void) | undefined
  persistBeforeSignOut: () => Promise<void>
}

export function Topbar({
  google,
  activeSection, setActiveSection, showNotice, searchOpen, search, setSearch, setSearchOpen,
  darkMode, toggleTheme, setProfileOpen, profileOpen, user, onSignOut, persistBeforeSignOut
}: TopbarProps) {
  return (
    <header className="topbar">
        <div className="brand"><span className="brand-mark">a</span><span className="brand-copy"><strong>AURA</strong><small>Autonomous Unified Routine Assistant</small></span></div>
        <nav>{['Mi día', 'Proyectos', 'Memoria'].map((section) => <button key={section} className={`nav-link ${activeSection === section ? 'active' : ''}`} onClick={() => { setActiveSection(section); showNotice(`${section}: vista seleccionada.`) }}>{section}</button>)}</nav>
        <div className="top-actions">{searchOpen && <input autoFocus className="top-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en tu día" />}<button className="icon-button" aria-label="Buscar" onClick={() => { setSearchOpen((current) => !current); if (searchOpen) setSearch('') }}>⌕</button><button className="theme-button" aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'} onClick={toggleTheme}>{darkMode ? '☀' : '☾'}</button><UserMenu user={user} google={google} open={profileOpen} setOpen={setProfileOpen} onSignOut={() => { if (onSignOut) void persistBeforeSignOut(); else showNotice('Sesión local activa.') }} /></div>
      </header>

  )
}
