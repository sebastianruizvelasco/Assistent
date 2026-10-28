// Envío de notificaciones Web Push con las claves VAPID del bot.

import webpush from 'web-push'

const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || ''
const privateKey = process.env.VAPID_PRIVATE_KEY || ''
const subject = process.env.VAPID_SUBJECT || 'mailto:aura@example.com'

export const pushConfigured = Boolean(publicKey && privateKey)

if (pushConfigured) {
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

// Devuelve 'ok', 'gone' (suscripción caducada: hay que borrarla) o el mensaje de error.
export const sendPush = async (subscription, payload) => {
  if (!pushConfigured) return { status: 'unconfigured' }
  try {
    await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload), { TTL: 600 })
    return { status: 'ok' }
  } catch (error) {
    const code = error?.statusCode
    if (code === 404 || code === 410) return { status: 'gone' }
    return { status: 'error', message: error?.body || error?.message || 'error desconocido' }
  }
}
