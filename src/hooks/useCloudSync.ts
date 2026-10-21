import { useEffect, useRef } from 'react'
import { snapshotForCloud } from '../lib/snapshot'
import type { AppSnapshot } from '../types'

// Sincroniza el snapshot con la nube (con debounce) cuando hay una función de guardado.
export function useCloudSync(
  snapshot: AppSnapshot,
  onSaveSnapshot: ((data: AppSnapshot) => Promise<void>) | undefined,
  notify: (text: string) => void,
) {
  const { events, projects, memories, aiSettings, conversationSessions, activeConversationId, darkMode, selectedDateKey, calendarView } = snapshot
  const notifyRef = useRef(notify)
  useEffect(() => { notifyRef.current = notify })

  useEffect(() => {
    if (!onSaveSnapshot) return
    const timer = window.setTimeout(() => {
      void onSaveSnapshot(snapshotForCloud({ events, projects, memories, aiSettings, conversationSessions, activeConversationId, darkMode, selectedDateKey, calendarView }))
        .catch(() => notifyRef.current('No se pudieron sincronizar los datos. Comprueba la conexión.'))
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [onSaveSnapshot, events, projects, memories, aiSettings, conversationSessions, activeConversationId, darkMode, selectedDateKey, calendarView])
}
