import type { GoogleCalendarController } from '../hooks/useGoogleCalendar'
import type { UserProfile } from '../lib/profile'
import { GoogleCalendarMenu } from './GoogleCalendarMenu'
import { Logo } from './Logo'
import { MoonIcon, SearchIcon, SunIcon } from './Icons'
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
  onLinkDiscord?: () => void
}

export function Topbar({
  google,
  activeSection,
  setActiveSection,
  showNotice,
  searchOpen,
  search,
  setSearch,
  setSearchOpen,
  darkMode,
  toggleTheme,
  setProfileOpen,
  profileOpen,
  user,
  onSignOut,
  persistBeforeSignOut,
  onLinkDiscord,
}: TopbarProps) {
  const userEmail = user.email
  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : 'AU'

  return (
    <header className="topbar">
      <Logo />

      <nav aria-label="Secciones">
        {['Mi día', 'Proyectos', 'Memoria'].map((section) => (
          <button
            key={section}
            className={`nav-link ${
              activeSection === section ? 'active' : ''
            }`}
            aria-current={
              activeSection === section ? 'page' : undefined
            }
            onClick={() => {
              setActiveSection(section)
              showNotice(`${section}: vista seleccionada.`)
            }}
          >
            {section}
          </button>
        ))}
      </nav>

      <div className="top-actions">
        {searchOpen && (
          <input
            autoFocus
            className="top-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar en tu día"
          />
        )}

        <button
          className="icon-button"
          aria-label="Buscar"
          onClick={() => {
            setSearchOpen((current) => !current)

            if (searchOpen) {
              setSearch('')
            }
          }}
        >
          <SearchIcon />
        </button>

        <button
          className="icon-button theme-button"
          aria-label={
            darkMode
              ? 'Activar modo claro'
              : 'Activar modo oscuro'
          }
          onClick={toggleTheme}
        >
          {darkMode ? <SunIcon /> : <MoonIcon />}
        </button>

        <div className="profile-wrap">
          <button
            className="avatar"
            aria-label="Abrir perfil"
            aria-expanded={profileOpen}
            onClick={() =>
              setProfileOpen((current) => !current)
            }
          >
            {initials}
          </button>

          {profileOpen && (
            <div className="profile-menu">
              <strong>{userEmail || 'Modo local'}</strong>

              <span>
                {userEmail
                  ? 'Cuenta sincronizada'
                  : 'Plan local'}
              </span>

              <GoogleCalendarMenu
                google={google}
                onClose={() => setProfileOpen(false)}
              />

              {onLinkDiscord && (
                <button
                  onClick={() => {
                    setProfileOpen(false)
                    onLinkDiscord()
                  }}
                >
                  Vincular Discord
                </button>
              )}

              {onSignOut ? (
                <button
                  onClick={() => {
                    setProfileOpen(false)
                    void persistBeforeSignOut()
                  }}
                >
                  Cerrar sesión
                </button>
              ) : (
                <button
                  onClick={() => {
                    setProfileOpen(false)
                    showNotice('Sesión local activa.')
                  }}
                >
                  Cerrar menú
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}