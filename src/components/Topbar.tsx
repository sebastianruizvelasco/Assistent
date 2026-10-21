import { type Dispatch, type SetStateAction } from 'react'

type TopbarProps = {
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
  userEmail: string | undefined
  onSignOut: (() => void) | undefined
  persistBeforeSignOut: () => Promise<void>
}

export function Topbar({
  activeSection, setActiveSection, showNotice, searchOpen, search, setSearch, setSearchOpen,
  darkMode, toggleTheme, setProfileOpen, profileOpen, userEmail, onSignOut, persistBeforeSignOut
}: TopbarProps) {
  return (
    <header className="topbar">
        <div className="brand"><span className="brand-mark">a</span><span className="brand-copy"><strong>AURA</strong><small>Autonomous Unified Routine Assistant</small></span></div>
        <nav>{['Mi día', 'Proyectos', 'Memoria'].map((section) => <button key={section} className={`nav-link ${activeSection === section ? 'active' : ''}`} onClick={() => { setActiveSection(section); showNotice(`${section}: vista seleccionada.`) }}>{section}</button>)}</nav>
        <div className="top-actions">{searchOpen && <input autoFocus className="top-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en tu día" />}<button className="icon-button" aria-label="Buscar" onClick={() => { setSearchOpen((current) => !current); if (searchOpen) setSearch('') }}>⌕</button><button className="theme-button" aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'} onClick={toggleTheme}>{darkMode ? '☀' : '☾'}</button><div className="profile-wrap"><button className="avatar" aria-label="Abrir perfil" onClick={() => setProfileOpen((current) => !current)}>AL</button>{profileOpen && <div className="profile-menu"><strong>{userEmail || 'Modo local'}</strong><span>{userEmail ? 'Cuenta sincronizada' : 'Plan local'}</span>{onSignOut ? <button onClick={() => { setProfileOpen(false); void persistBeforeSignOut() }}>Cerrar sesión</button> : <button onClick={() => { setProfileOpen(false); showNotice('Sesión local activa.') }}>Cerrar menú</button>}</div>}</div></div>
      </header>

  )
}
