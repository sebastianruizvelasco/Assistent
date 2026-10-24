import type { GoogleCalendarController } from '../hooks/useGoogleCalendar'
<<<<<<< HEAD
import type { UserProfile } from '../lib/profile'
import { UserMenu } from './UserMenu'
=======
import { GoogleCalendarMenu } from './GoogleCalendarMenu'
import { Logo } from './Logo'
import { MoonIcon, SearchIcon, SunIcon } from './Icons'
>>>>>>> Rediseño de la interfaz: logo, tokens de diseño y panel del asistente
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
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'AU'
  return (
    <header className="topbar">
<<<<<<< HEAD
        <div className="brand"><span className="brand-mark">a</span><span className="brand-copy"><strong>AURA</strong><small>Autonomous Unified Routine Assistant</small></span></div>
        <nav>{['Mi día', 'Proyectos', 'Memoria'].map((section) => <button key={section} className={`nav-link ${activeSection === section ? 'active' : ''}`} onClick={() => { setActiveSection(section); showNotice(`${section}: vista seleccionada.`) }}>{section}</button>)}</nav>
        <div className="top-actions">{searchOpen && <input autoFocus className="top-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en tu día" />}<button className="icon-button" aria-label="Buscar" onClick={() => { setSearchOpen((current) => !current); if (searchOpen) setSearch('') }}>⌕</button><button className="theme-button" aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'} onClick={toggleTheme}>{darkMode ? '☀' : '☾'}</button><UserMenu user={user} google={google} open={profileOpen} setOpen={setProfileOpen} onSignOut={() => { if (onSignOut) void persistBeforeSignOut(); else showNotice('Sesión local activa.') }} /></div>
      </header>

=======
      <Logo />
      <nav aria-label="Secciones">
        {['Mi día', 'Proyectos', 'Memoria'].map((section) => (
          <button
            key={section}
            className={`nav-link ${activeSection === section ? 'active' : ''}`}
            aria-current={activeSection === section ? 'page' : undefined}
            onClick={() => { setActiveSection(section); showNotice(`${section}: vista seleccionada.`) }}
          >
            {section}
          </button>
        ))}
      </nav>
      <div className="top-actions">
        {searchOpen && <input autoFocus className="top-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en tu día" />}
        <button className="icon-button" aria-label="Buscar" onClick={() => { setSearchOpen((current) => !current); if (searchOpen) setSearch('') }}><SearchIcon /></button>
        <button className="icon-button theme-button" aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'} onClick={toggleTheme}>{darkMode ? <SunIcon /> : <MoonIcon />}</button>
        <div className="profile-wrap">
          <button className="avatar" aria-label="Abrir perfil" aria-expanded={profileOpen} onClick={() => setProfileOpen((current) => !current)}>{initials}</button>
          {profileOpen && (
            <div className="profile-menu">
              <strong>{userEmail || 'Modo local'}</strong>
              <span>{userEmail ? 'Cuenta sincronizada' : 'Plan local'}</span>
              <GoogleCalendarMenu google={google} onClose={() => setProfileOpen(false)} />
              {onSignOut
                ? <button onClick={() => { setProfileOpen(false); void persistBeforeSignOut() }}>Cerrar sesión</button>
                : <button onClick={() => { setProfileOpen(false); showNotice('Sesión local activa.') }}>Cerrar menú</button>}
            </div>
          )}
        </div>
      </div>
    </header>
>>>>>>> Rediseño de la interfaz: logo, tokens de diseño y panel del asistente
  )
}
