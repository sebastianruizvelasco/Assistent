import { useEffect, useState } from 'react'

export function useWeather() {
  const [temperature, setTemperature] = useState<number | null>(null)
  const [city, setCity] = useState('Ubicación no disponible')
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((position) => {
      setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude })
    }, () => setCity('Ubicación no disponible'))
  }, [])

  useEffect(() => {
    if (!coordinates) return
    const updateWeather = async () => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=temperature_2m&timezone=auto`)
        if (!response.ok) return
        const data = await response.json() as { current?: { temperature_2m?: number } }
        if (typeof data.current?.temperature_2m === 'number') setTemperature(Math.round(data.current.temperature_2m))
      } catch {
        return
      }
    }
    updateWeather()
    const timer = window.setInterval(updateWeather, 10 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [coordinates])

  useEffect(() => {
    if (!coordinates) return
    const loadCity = async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates.latitude}&lon=${coordinates.longitude}&zoom=10`)
        if (!response.ok) return
        const data = await response.json() as { address?: { city?: string; town?: string; village?: string; municipality?: string } }
        const address = data.address
        setCity(address?.city || address?.town || address?.village || address?.municipality || 'Ubicación actual')
      } catch {
        setCity('Ubicación actual')
      }
    }
    loadCity()
  }, [coordinates])

  return { temperature, city }
}
