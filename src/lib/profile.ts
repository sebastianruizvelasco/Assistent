// Datos que AURA muestra del usuario (nombre, foto, iniciales), sacados de la cuenta de Supabase/Google.

export type UserProfile = {
  name: string
  firstName: string
  initials: string
  email?: string
  avatarUrl?: string
  signedIn: boolean
}

type UserLike = { email?: string | null; user_metadata?: Record<string, unknown> | null }

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

// «sebas.ruiz92» → «Sebas Ruiz»: solo se usa cuando la cuenta no trae nombre (correo y contraseña).
const nameFromEmail = (email: string) => {
  const local = email.split('@')[0]
  const words = local.replace(/\d+$/, '').split(/[._\-+]+/).filter(Boolean)
  const base = words.length ? words : [local]
  return base.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

const initialsOf = (name: string) => {
  const words = name.split(/\s+/).filter(Boolean)
  const first = words[0]?.charAt(0) ?? '?'
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : ''
  return (first + last).toUpperCase()
}

export const profileFromUser = (user?: UserLike | null): UserProfile => {
  if (!user) return { name: 'Invitado', firstName: 'Invitado', initials: 'IN', signedIn: false }
  const meta = user.user_metadata ?? {}
  const email = text(user.email) || undefined
  const given = [text(meta.given_name), text(meta.family_name)].filter(Boolean).join(' ')
  const name = text(meta.full_name) || text(meta.name) || given || (email ? nameFromEmail(email) : '') || 'Usuario'
  const avatar = text(meta.avatar_url) || text(meta.picture)
  return {
    name,
    firstName: name.split(/\s+/)[0],
    initials: initialsOf(name),
    email,
    avatarUrl: /^https:\/\//i.test(avatar) ? avatar : undefined,
    signedIn: true,
  }
}
