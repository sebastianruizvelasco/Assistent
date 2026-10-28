// Service worker mínimo: recibe los recordatorios que envía el bot y abre AURA al tocarlos.
// No cachea nada (todavía no hay uso sin conexión).

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = { body: event.data ? event.data.text() : '' } }
  const title = payload.title || 'AURA'
  const options = {
    body: payload.body || 'Tienes un recordatorio.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'aura-recordatorio',
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})
