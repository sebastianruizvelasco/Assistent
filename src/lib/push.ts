import { supabase } from '../supabase'

// Notificaciones Web Push: la app se suscribe y el bot (que está siempre encendido) envía los
// recordatorios aunque la pestaña esté cerrada.

const vapidPublicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() || ''
export const PUSH_PUBLIC_KEY = vapidPublicKey

export type PushState = 'unsupported' | 'unconfigured' | 'off' | 'on' | 'denied'

export const pushSupported = () => typeof navigator !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && typeof Notification !== 'undefined'

const urlBase64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

const registration = async () => {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js')
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

export const getPushState = async (): Promise<PushState> => {
  if (!pushSupported()) return 'unsupported'
  if (!PUSH_PUBLIC_KEY) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  const active = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await active?.pushManager.getSubscription()
  return subscription ? 'on' : 'off'
}

export const enablePush = async () => {
  if (!pushSupported()) throw new Error('Este navegador no admite notificaciones push.')
  if (!PUSH_PUBLIC_KEY) throw new Error('Falta VITE_VAPID_PUBLIC_KEY en el archivo .env: sin ella el bot no puede firmar los avisos.')
  if (!supabase) throw new Error('Inicia sesión para activar los recordatorios.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('No diste permiso para las notificaciones.')
  const worker = await registration()
  const existing = await worker.pushManager.getSubscription()
  const subscription = existing || await worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY),
  })
  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    created_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (error) throw new Error(`No pude guardar la suscripción: ${error.message}. ¿Ejecutaste supabase/migrations/0004_push.sql?`)
}

export const disablePush = async () => {
  const worker = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await worker?.pushManager.getSubscription()
  if (!subscription) return
  if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}
