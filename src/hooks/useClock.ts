import { useEffect, useState } from 'react'
import { formatLocalTime } from '../lib/dates'

export function useClock() {
  const [localTime, setLocalTime] = useState(() => formatLocalTime(new Date()))
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

  useEffect(() => {
    const updateClock = () => {
      setLocalTime(formatLocalTime(new Date()))
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    }
    const timer = window.setInterval(updateClock, 1000)
    return () => window.clearInterval(timer)
  }, [])

  return { localTime, timeZone }
}
