type DiscordLinkModalProps = {
  link: { code: string; expiresAt: string } | null
  onClose: () => void
  showNotice: (text: string) => void
}

// Muestra el código que hay que escribir en Discord para vincular la cuenta.
export function DiscordLinkModal({ link, onClose, showNotice }: DiscordLinkModalProps) {
  if (!link) return null
  // Solo se formatea la hora de caducidad: no se lee el reloj durante el render.
  const expiresAt = new Date(link.expiresAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  const command = `/vincular codigo:${link.code}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      showNotice('Comando copiado. Pégalo en Discord.')
    } catch {
      showNotice('No pude copiar al portapapeles; escribe el código a mano.')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="discord-link-modal" role="dialog" aria-modal="true" aria-labelledby="discord-link-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">DISCORD</p>
            <h2 id="discord-link-title">Vincula tu cuenta</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <p className="discord-link-steps">En Discord, en cualquier canal donde esté el bot, escribe este comando:</p>
        <code className="link-code">{command}</code>
        <p className="discord-link-hint">Caduca a las {expiresAt} y solo sirve una vez. A partir de ahí el bot usará tu agenda y tu clave de IA, no las del servidor.</p>
        <div className="discord-link-actions">
          <button type="button" className="secondary-action" onClick={() => { void copy() }}>Copiar comando</button>
          <button type="button" className="primary-action" onClick={onClose}>Hecho</button>
        </div>
      </div>
    </div>
  )
}
